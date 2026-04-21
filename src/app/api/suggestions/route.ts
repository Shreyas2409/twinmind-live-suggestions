import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }
    const { transcript, apiKey, systemPrompt, previousSuggestions } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key." },
        { status: 401 }
      );
    }

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: "No transcript provided." },
        { status: 400 }
      );
    }

    let userContent = `Here is the recent transcript:\n\n${transcript}`;

    if (previousSuggestions) {
      userContent += `\n\nPREVIOUS SUGGESTIONS (do NOT repeat these topics): ${previousSuggestions}`;
    }

    userContent += `\n\nCRITICAL FORMATTING RULES:\n1. Respond with ONLY a raw JSON array — no markdown, no code fences, no explanation\n2. Each object must have exactly these 3 keys: "type", "title", "preview"\n3. Each object MUST have a DIFFERENT "type" value\n4. Example format: [{"type":"question","title":"Ask about X","preview":"This would help clarify..."},{"type":"fact_check","title":"Verify Y claim","preview":"The speaker said..."},{"type":"talking_point","title":"Discuss Z","preview":"An important angle..."}]`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    const response = await chatCompletion(messages, apiKey, {
      temperature: 0.6,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "";
    console.log("Suggestions raw response:", rawContent.substring(0, 1000));

    const VALID_TYPES = [
      "question",
      "talking_point",
      "fact_check",
      "clarification",
      "answer",
      "action_item",
    ];

    const normalize = (s: Record<string, unknown>) => {
      let type = String(
        s.type || s.category || s.kind || s.suggestion_type || "question"
      ).toLowerCase().replace(/[\s-]/g, "_");
      if (!VALID_TYPES.includes(type)) {
        if (["summary", "overview", "recap", "insight", "observation"].includes(type)) {
          type = "talking_point";
        } else if (["example", "analogy", "illustration"].includes(type)) {
          type = "clarification";
        } else if (["verify", "check", "validate"].includes(type)) {
          type = "fact_check";
        } else if (["action", "todo", "task", "followup", "follow_up"].includes(type)) {
          type = "action_item";
        } else if (["ask", "probe", "explore"].includes(type)) {
          type = "question";
        } else if (["respond", "reply", "explain"].includes(type)) {
          type = "answer";
        } else {
          type = "talking_point";
        }
      }
      const title = String(
        s.title || s.name || s.heading || s.label || s.topic || s.subject || "Suggestion"
      );
      const preview = String(
        s.preview || s.description || s.content || s.text || s.summary ||
        s.detail || s.details || s.body || s.explanation || ""
      );
      return { type, title, preview };
    };

    // Parse JSON from the response using multiple extraction strategies
    let suggestions;
    try {
      let jsonStr = rawContent.trim();

      // Strategy 1: Strip markdown code fences if present
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      // Strategy 2: Find the JSON array anywhere in the response
      if (!jsonStr.startsWith("[")) {
        const arrayStart = jsonStr.indexOf("[");
        const arrayEnd = jsonStr.lastIndexOf("]");
        if (arrayStart !== -1 && arrayEnd > arrayStart) {
          jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
        }
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Strategy 3: The model may have returned a single object, or an
        // object wrapping the array (e.g. {"suggestions": [...]})
        const objStart = jsonStr.indexOf("{");
        const objEnd = jsonStr.lastIndexOf("}");
        if (objStart !== -1 && objEnd > objStart) {
          const objStr = jsonStr.substring(objStart, objEnd + 1);
          parsed = JSON.parse(objStr);
        } else {
          throw new Error("No JSON object or array found in response");
        }
      }

      // Unwrap common container shapes
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.suggestions)) {
          parsed = obj.suggestions;
        } else if (Array.isArray(obj.data)) {
          parsed = obj.data;
        } else if (Array.isArray(obj.items)) {
          parsed = obj.items;
        } else if (obj.type || obj.title || obj.preview) {
          // Single suggestion object — wrap it
          parsed = [obj];
        }
      }

      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }

      suggestions = parsed
        .slice(0, 3)
        .map((s) => normalize((s ?? {}) as Record<string, unknown>));

      if (suggestions.length === 0) {
        throw new Error("Empty suggestions array");
      }
    } catch (parseErr) {
      console.error(
        "Failed to parse suggestions JSON. Raw response:",
        rawContent.substring(0, 500)
      );
      console.error("Parse error:", parseErr);

      // Better fallback: try to extract any recognizable suggestion objects
      // from the raw text using a loose regex before giving up.
      const salvaged: Record<string, unknown>[] = [];
      const objRegex = /\{[^{}]*"(?:type|title|preview)"[^{}]*\}/g;
      const matches = rawContent.match(objRegex) || [];
      for (const m of matches) {
        try {
          const obj = JSON.parse(m);
          if (obj && typeof obj === "object") {
            salvaged.push(obj);
          }
        } catch {
          // ignore unparseable fragments
        }
        if (salvaged.length >= 3) break;
      }

      if (salvaged.length > 0) {
        suggestions = salvaged.map((s) => normalize(s));
      } else {
        suggestions = [
          {
            type: "question",
            title: "Could not parse suggestions",
            preview:
              "The AI response was not in the expected format. Try refreshing.",
          },
        ];
      }
    }

    // Enforce type variety — if all same type, reassign
    if (suggestions.length >= 3) {
      const types = suggestions.map((s) => s.type);
      const uniqueTypes = new Set(types);
      if (uniqueTypes.size === 1) {
        // Force variety by reassigning types based on content
        const availableTypes = [
          "question",
          "talking_point",
          "fact_check",
          "clarification",
          "answer",
          "action_item",
        ];
        suggestions[1].type =
          availableTypes.find((t) => t !== suggestions[0].type) ||
          "talking_point";
        suggestions[2].type =
          availableTypes.find(
            (t) => t !== suggestions[0].type && t !== suggestions[1].type
          ) || "fact_check";
      } else if (uniqueTypes.size === 2 && suggestions.length === 3) {
        // Find the duplicate and reassign one of them
        const typeCounts: Record<string, number> = {};
        types.forEach((t) => (typeCounts[t] = (typeCounts[t] || 0) + 1));
        const duplicateType = Object.entries(typeCounts).find(
          ([, count]) => count > 1
        )?.[0];
        if (duplicateType) {
          const availableTypes = [
            "question",
            "talking_point",
            "fact_check",
            "clarification",
            "answer",
            "action_item",
          ];
          const usedTypes = new Set(types);
          const newType = availableTypes.find((t) => !usedTypes.has(t));
          // Find the second occurrence of the duplicate and reassign it
          let found = false;
          for (let i = 0; i < suggestions.length; i++) {
            if (suggestions[i].type === duplicateType) {
              if (found) {
                suggestions[i].type = newType || "talking_point";
                break;
              }
              found = true;
            }
          }
        }
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggestions route error:", error);
    return NextResponse.json(
      { error: "Internal server error generating suggestions." },
      { status: 500 }
    );
  }
}
