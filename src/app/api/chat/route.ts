import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, apiKey } = body as {
      messages: { role: string; content: string }[];
      apiKey: string;
    };

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Please set your Groq API key in Settings." },
        { status: 401 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages,
          stream: true,
          temperature: 0.5,
          max_tokens: 400,
        }),
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq chat error:", errorText);
      return NextResponse.json(
        { error: `Chat completion failed (${groqResponse.status}): ${errorText}` },
        { status: groqResponse.status }
      );
    }

    // Forward the streaming response directly
    return new Response(groqResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: "Internal server error during chat completion." },
      { status: 500 }
    );
  }
}
