import { TranscriptChunk } from "@/components/TranscriptPanel";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestionType?: string;
}

/**
 * Build transcript context string from chunks, limited by character window size.
 * Takes the most recent characters up to windowSize.
 */
export function buildSuggestionContext(
  chunks: TranscriptChunk[],
  windowSize: number
): string {
  const fullText = chunks
    .map((c) => {
      const time = new Date(c.timestamp).toLocaleTimeString();
      return `[${time}] ${c.text}`;
    })
    .join("\n");
  if (fullText.length <= windowSize) return fullText;
  return fullText.slice(-windowSize);
}

/**
 * Build messages array for free-form chat questions.
 */
export function buildChatMessages(
  transcript: string,
  chatHistory: ChatMessage[],
  systemPrompt: string,
  contextWindow: number
): { role: string; content: string }[] {
  const windowedTranscript =
    transcript.length > contextWindow
      ? transcript.slice(-contextWindow)
      : transcript;

  const messages: { role: string; content: string }[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "system",
      content: `Here is the meeting transcript so far:\n\n${windowedTranscript}`,
    },
  ];

  for (const msg of chatHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}

/**
 * Build messages array for suggestion detail requests.
 */
export function buildDetailMessages(
  transcript: string,
  suggestion: string,
  systemPrompt: string,
  contextWindow: number
): { role: string; content: string }[] {
  const windowedTranscript =
    transcript.length > contextWindow
      ? transcript.slice(-contextWindow)
      : transcript;

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "system",
      content: `Here is the meeting transcript so far:\n\n${windowedTranscript}`,
    },
    {
      role: "user",
      content: suggestion,
    },
  ];
}
