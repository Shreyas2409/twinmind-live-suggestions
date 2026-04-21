"use client";

import { useState, useCallback } from "react";
import SettingsModal from "@/components/Settings";
import TranscriptPanel, { TranscriptChunk } from "@/components/TranscriptPanel";
import SuggestionsPanel, { Suggestion, SuggestionBatch } from "@/components/SuggestionsPanel";
import ChatPanel from "@/components/ChatPanel";
import { ChatMessage } from "@/lib/prompts";
import ExportButton from "@/components/ExportButton";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const handleTranscriptUpdate = useCallback((chunks: TranscriptChunk[]) => {
    setTranscriptChunks(chunks);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
  }, []);

  const handleBatchesUpdate = useCallback((batches: SuggestionBatch[]) => {
    setSuggestionBatches(batches);
  }, []);

  const handleMessagesUpdate = useCallback((messages: ChatMessage[]) => {
    setChatMessages(messages);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-3">
        <h1 className="text-sm font-semibold text-white">
          TwinMind — Live Suggestions Web App
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 hidden sm:inline">
            3-column layout · Transcript · Live Suggestions · Chat
          </span>
          <ExportButton
            transcriptChunks={transcriptChunks}
            suggestionBatches={suggestionBatches}
            chatMessages={chatMessages}
          />
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Settings
          </button>
        </div>
      </header>

      {/* 3-Column Layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="flex w-1/3 flex-col border-r border-zinc-800">
          <TranscriptPanel
            onTranscriptUpdate={handleTranscriptUpdate}
            onRecordingChange={setIsRecording}
          />
        </div>

        {/* Middle: Suggestions */}
        <div className="flex w-1/3 flex-col border-r border-zinc-800">
          <SuggestionsPanel
            chunks={transcriptChunks}
            onSuggestionClick={handleSuggestionClick}
            onBatchesUpdate={handleBatchesUpdate}
            isRecording={isRecording}
          />
        </div>

        {/* Right: Chat */}
        <div className="flex w-1/3 flex-col">
          <ChatPanel
            transcriptChunks={transcriptChunks}
            selectedSuggestion={selectedSuggestion}
            onMessagesUpdate={handleMessagesUpdate}
          />
        </div>
      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
