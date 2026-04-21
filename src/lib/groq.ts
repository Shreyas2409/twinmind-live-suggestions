const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "text");

  const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq transcription failed (${response.status}): ${errorText}`
    );
  }

  const text = await response.text();
  return text.trim();
}

export async function chatCompletion(
  messages: { role: string; content: string }[],
  apiKey: string,
  options: {
    model?: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
  } = {}
): Promise<Response> {
  const {
    model = "openai/gpt-oss-120b",
    stream = false,
    temperature = 0.7,
    max_tokens = 2048,
    response_format,
  } = options;

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream,
    temperature,
    max_tokens,
  };
  if (response_format) {
    requestBody.response_format = response_format;
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq chat completion failed (${response.status}): ${errorText}`
    );
  }

  return response;
}
