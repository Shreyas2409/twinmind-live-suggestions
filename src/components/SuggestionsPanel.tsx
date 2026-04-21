"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TranscriptChunk } from "@/components/TranscriptPanel";
import { getFullSettings } from "@/lib/store";

export interface Suggestion {
  type: "question" | "talking_point" | "fact_check" | "clarification" | "answer" | "action_item";
  title: string;
  preview: string;
}

export interface SuggestionBatch {
  id: string;
  suggestions: Suggestion[];
  timestamp: number;
}

interface SuggestionsPanelProps {
  chunks: TranscriptChunk[];
  onSuggestionClick?: (suggestion: Suggestion) => void;
  onBatchesUpdate?: (batches: SuggestionBatch[]) => void;
  isRecording?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; classes: string }> = {
  question: { label: "Question", classes: "bg-blue-500/20 text-blue-400" },
  talking_point: { label: "Talking Point", classes: "bg-purple-500/20 text-purple-400" },
  fact_check: { label: "Fact Check", classes: "bg-amber-500/20 text-amber-400" },
  clarification: { label: "Clarification", classes: "bg-teal-500/20 text-teal-400" },
  answer: { label: "Answer", classes: "bg-green-500/20 text-green-400" },
  action_item: { label: "Action Item", classes: "bg-rose-500/20 text-rose-400" },
};

const AUTO_REFRESH_SECONDS = 30;

export default function SuggestionsPanel({ chunks, onSuggestionClick, onBatchesUpdate, isRecording }: SuggestionsPanelProps) {
  const [batches, setBatches] = useState<SuggestionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const lastChunkCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onBatchesUpdateRef = useRef(onBatchesUpdate);
  onBatchesUpdateRef.current = onBatchesUpdate;
  const batchesRef = useRef<SuggestionBatch[]>([]);
  batchesRef.current = batches;

  const fetchSuggestions = useCallback(async () => {
    const settings = getFullSettings();
    if (!settings.groqApiKey) {
      setError("No API key set. Open Settings to configure.");
      return;
    }

    const fullText = chunks
      .map((c) => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        return `[${time}] ${c.text}`;
      })
      .join("\n");
    if (!fullText.trim()) return;

    // Apply context windowing
    const windowSize = settings.suggestionContextWindow;
    const windowedText = fullText.length > windowSize
      ? fullText.slice(-windowSize)
      : fullText;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    const prevBatches = batchesRef.current;
    const prevBatchTitles =
      prevBatches.length > 0
        ? prevBatches[0].suggestions.map((s) => s.title).join(", ")
        : "";

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: windowedText,
          apiKey: settings.groqApiKey,
          systemPrompt: settings.suggestionPrompt,
          previousSuggestions: prevBatchTitles,
        }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch suggestions.");
        return;
      }

      const batch: SuggestionBatch = {
        id: `batch-${Date.now()}`,
        suggestions: data.suggestions,
        timestamp: Date.now(),
      };

      setBatches((prev) => [batch, ...prev]);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Network error fetching suggestions.");
    } finally {
      setIsLoading(false);
    }
  }, [chunks]);

  const fetchSuggestionsRef = useRef(fetchSuggestions);
  fetchSuggestionsRef.current = fetchSuggestions;

  // Notify parent when batches change (outside render phase)
  useEffect(() => {
    onBatchesUpdateRef.current?.(batches);
  }, [batches]);

  // Auto-fetch when new chunks arrive
  useEffect(() => {
    if (chunks.length > lastChunkCountRef.current && chunks.length > 0) {
      lastChunkCountRef.current = chunks.length;
      fetchSuggestionsRef.current();
    }
  }, [chunks]);

  // Auto-refresh timer when recording
  useEffect(() => {
    if (!isRecording || chunks.length === 0) {
      setCountdown(AUTO_REFRESH_SECONDS);
      return;
    }
    setCountdown(AUTO_REFRESH_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchSuggestionsRef.current();
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, chunks.length]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getTypeConfig = (type: string) =>
    TYPE_CONFIG[type] || { label: type, classes: "bg-zinc-500/20 text-zinc-400" };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          2. Live Suggestions
        </h2>
        <div className="flex items-center gap-3">
          {isRecording && chunks.length > 0 && (
            <span className="text-xs text-zinc-500">
              auto-refresh in {countdown}s
            </span>
          )}
          <span className="text-xs text-zinc-500">
            {batches.length} {batches.length === 1 ? "BATCH" : "BATCHES"}
          </span>
          <button
            onClick={() => { fetchSuggestionsRef.current(); setCountdown(AUTO_REFRESH_SECONDS); }}
            disabled={isLoading || chunks.length === 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Loading..." : "↻ Reload suggestions"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 text-sm bg-red-900/20 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && batches.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
            <span className="animate-spin h-4 w-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full" />
            Generating suggestions...
          </div>
        )}

        {!isLoading && batches.length === 0 && (
          <p className="text-sm text-zinc-500 text-center mt-8">
            Suggestions appear here once recording starts.
          </p>
        )}

        {batches.map((batch) => (
          <div key={batch.id} className="space-y-2">
            <p className="text-xs text-zinc-500">{formatTime(batch.timestamp)}</p>
            {batch.suggestions.map((suggestion, idx) => {
              const cfg = getTypeConfig(suggestion.type);
              return (
                <button
                  key={`${batch.id}-${idx}`}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="w-full text-left rounded-lg bg-zinc-800 hover:bg-zinc-750 hover:ring-1 hover:ring-zinc-600 p-3 transition-all group"
                >
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${cfg.classes}`}>
                    {cfg.label}
                  </span>
                  <p className="text-sm font-medium text-zinc-200 mb-1">{suggestion.title}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{suggestion.preview}</p>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
