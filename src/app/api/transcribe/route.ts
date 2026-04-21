import { NextRequest, NextResponse } from "next/server";

// Filter out Whisper hallucinations (non-English gibberish on silence)
function isValidTranscription(text: string): boolean {
  if (!text || text.trim().length < 3) return false;
  const trimmed = text.trim();

  // Check if the text is mostly ASCII/English characters
  const asciiCount = (trimmed.match(/[a-zA-Z0-9\s.,!?\'"\-:;()]/g) || []).length;
  const ratio = asciiCount / trimmed.length;
  if (ratio < 0.6) return false;

  // Known Whisper hallucination phrases (case-insensitive)
  const hallucinationPhrases = [
    // English artifacts
    "i'm sorry",
    "thank you for watching",
    "thanks for watching",
    "please subscribe",
    "like and subscribe",
    "don't forget to subscribe",
    "see you next time",
    "bye bye",
    "goodbye",
    "thank you so much",
    "thanks for listening",
    "please like",
    "hit the bell",
    "leave a comment",
    "check out my",
    "link in the description",
    "sponsored by",
    "subtitles by",
    "captions by",
    "translated by",
    "transcribed by",
    // Scandinavian
    "skål",
    "tack för att ni tittade",
    "tack för att du tittade",
    // Indonesian / Malay
    "terima kasih",
    "jangan lupa",
    "like share dan subscribe",
    "sampai jumpa",
    "selamat tinggal",
    // Spanish
    "gracias por ver",
    "no olvides suscribirte",
    "hasta la próxima",
    // French
    "merci d'avoir regardé",
    "n'oubliez pas de vous abonner",
    // German
    "danke fürs zuschauen",
    "vergiss nicht zu abonnieren",
    // Portuguese
    "obrigado por assistir",
    "não esqueça de se inscrever",
    // Chinese (romanized)
    "xie xie",
    // Korean (romanized)
    "kamsahamnida",
    // Arabic (romanized)
    "shukran",
    // Russian (romanized)
    "spasibo",
    // Japanese
    "arigatou",
    // Common short filler that Whisper hallucinates
    "you",
    "the end",
    "...",
    "so",
    "okay",
    "um",
    "uh",
  ];

  const lower = trimmed.toLowerCase();

  // Check exact matches for very short phrases
  if (trimmed.length < 20) {
    for (const phrase of hallucinationPhrases) {
      if (lower === phrase || lower === phrase + "." || lower === phrase + "!") {
        return false;
      }
    }
  }

  // Check if the text contains any hallucination phrase (for longer strings that are JUST the phrase with punctuation)
  for (const phrase of hallucinationPhrases) {
    // If the entire text is essentially just one hallucination phrase (with minor punctuation/whitespace)
    const cleaned = lower.replace(/[^a-z\s]/g, "").trim();
    const phraseClean = phrase.replace(/[^a-z\s]/g, "").trim();
    if (cleaned === phraseClean) return false;
  }

  // Regex patterns for structured hallucinations
  const hallPatterns = [
    /^(\s*(you|thank|thanks|bye|okay|um|uh|ah)\s*[.!]?\s*)+$/i,
    /^\s*\.\s*$/,
    /^(\s*\w{1,3}\s*)+$/, // just single short words
    // YouTube-style outros in any language
    /subscribe/i,
    /like.*share/i,
    /terima\s*kasih/i,
    /jangan\s*lupa/i,
    /sk[aå]l/i,
    /gracias/i,
    /merci/i,
    /danke/i,
    /obrigad/i,
    /spasibo/i,
  ];

  for (const pattern of hallPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  // If text is very short (under 10 chars) and not clearly English words, reject
  if (trimmed.length < 10) {
    const words = trimmed.split(/\s+/);
    if (words.length <= 2) return false;
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
