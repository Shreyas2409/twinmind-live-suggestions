import { NextRequest, NextResponse } from "next/server";

// Filter out Whisper hallucinations (non-English gibberish on silence)
function isValidTranscription(text: string): boolean {
  if (!text || text.trim().length < 3) return false;

  // Check if the text is mostly ASCII/English characters
  const asciiCount = (text.match(/[a-zA-Z0-9\s.,!?'"\-:;()]/g) || []).length;
  const ratio = asciiCount / text.length;

  // If less than 60% ASCII, likely hallucination
  if (ratio < 0.6) return false;

  // Common Whisper hallucination patterns
  const hallucinations = [
    /^(\s*(you|thank|thanks|bye|okay|um|uh|ah)\s*[.!]?\s*)+$/i,
    /^\s*\.\s*$/,
    /Быmap|vocês|спуст|предп/,
    /^(\s*\w{1,3}\s*)+$/, // just single short words
  ];

  for (const pattern of hallucinations) {
    if (pattern.test(text.trim())) return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Please set your Groq API key in Settings." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }

    // Skip empty/tiny audio chunks to avoid Groq 400 errors
    if (audioFile.size < 1000) {
      return NextResponse.json({ text: "", timestamp: Date.now(), filtered: true });
    }

    // Build form data for Groq API
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "audio.webm");
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("response_format", "text");

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqFormData,
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq transcription error:", errorText);
      return NextResponse.json(
        {
          error: `Transcription failed (${groqResponse.status}): ${errorText}`,
        },
        { status: groqResponse.status }
      );
    }

    const transcribedText = await groqResponse.text();
    const trimmed = transcribedText.trim();

    if (!isValidTranscription(trimmed)) {
      return NextResponse.json({ text: "", timestamp: Date.now(), filtered: true });
    }

    return NextResponse.json({
      text: trimmed,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Transcription route error:", error);
    return NextResponse.json(
      { error: "Internal server error during transcription." },
      { status: 500 }
    );
  }
}
