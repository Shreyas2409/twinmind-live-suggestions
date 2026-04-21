"use client";

import { useCallback } from "react";
import { TranscriptChunk } from "@/components/TranscriptPanel";
import { SuggestionBatch } from "@/components/SuggestionsPanel";
import { ChatMessage } from "@/lib/prompts";
import { exportSession } from "@/lib/export";

interface ExportButtonProps {
  transcriptChunks: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chatMessages: ChatMessage[];
}

export default function ExportButton({
  transcriptChunks,
  suggestionBatches,
  chatMessages,
}: ExportButtonProps) {
  const hasData =
    transcriptChunks.length > 0 ||
    suggestionBatches.length > 0 ||
    chatMessages.length > 0;

  const handleExport = useCallback(() => {
    exportSession(transcriptChunks, suggestionBatches, chatMessages);
  }, [transcriptChunks, suggestionBatches, chatMessages]);

  return (
    <button
      onClick={handleExport}
      disabled={!hasData}
      className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-300"
      title={hasData ? "Export session as JSON" : "No data to export yet"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      Export
    </button>
  );
}
