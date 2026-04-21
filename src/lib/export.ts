import { TranscriptChunk } from "@/components/TranscriptPanel";
import { SuggestionBatch } from "@/components/SuggestionsPanel";
import { ChatMessage } from "@/lib/prompts";

export interface SessionExport {
  exportedAt: string;
  session: {
    transcript: { text: string; timestamp: number }[];
    suggestions: {
      batch: { type: string; title: string; preview: string }[];
      timestamp: number;
    }[];
    chat: {
      role: string;
      content: string;
      timestamp: number;
      suggestionType?: string;
    }[];
  };
}

export function exportSession(
  transcriptChunks: TranscriptChunk[],
  suggestionBatches: SuggestionBatch[],
  chatMessages: ChatMessage[]
): void {
  const data: SessionExport = {
    exportedAt: new Date().toISOString(),
    session: {
      transcript: transcriptChunks.map((c) => ({
        text: c.text,
        timestamp: c.timestamp,
      })),
      suggestions: suggestionBatches.map((b) => ({
        batch: b.suggestions.map((s) => ({
          type: s.type,
          title: s.title,
          preview: s.preview,
        })),
        timestamp: b.timestamp,
      })),
      chat: chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.suggestionType ? { suggestionType: m.suggestionType } : {}),
      })),
    },
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `twinmind-session-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
