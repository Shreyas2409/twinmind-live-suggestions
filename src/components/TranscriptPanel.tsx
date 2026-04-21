"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAudioCapture, AudioChunk } from "@/hooks/useAudioCapture";
import { loadSettings } from "@/lib/settings";

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
}

interface TranscriptPanelProps {
  onTranscriptUpdate?: (chunks: TranscriptChunk[]) => void;
  onRecordingChange?: (isRecording: boolean) => void;
}

export default function TranscriptPanel({
  onTranscriptUpdate,
  onRecordingChange,
}: TranscriptPanelProps) {
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  onTranscriptUpdateRef.current = onTranscriptUpdate;

  const transcribeAudioChunk = useCallback(async (audioChunk: AudioChunk) => {
    const settings = loadSettings();
    if (!settings.groqApiKey) {
      setTranscribeError("No API key set. Open Settings to add your Groq API key.");
      return;
    }

    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioChunk.blob, "audio.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "x-api-key": settings.groqApiKey },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setTranscribeError(data.error || "Transcription failed.");
        return;
      }

      if (data.text) {
        const newChunk: TranscriptChunk = {
          id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          text: data.text,
          timestamp: data.timestamp || audioChunk.timestamp,
        };
        setChunks((prev) => [...prev, newChunk]);
      }
    } catch {
      setTranscribeError("Network error during transcription.");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const { isRecording, startRecording, stopRecording, flushCurrentChunk, error: micError } =
    useAudioCapture({ onChunkReady: transcribeAudioChunk });

  // Notify parent when recording state changes
  const onRecordingChangeRef = useRef(onRecordingChange);
  onRecordingChangeRef.current = onRecordingChange;
  useEffect(() => {
    onRecordingChangeRef.current?.(isRecording);
  }, [isRecording]);

  // Notify parent when chunks change (outside render phase)
  useEffect(() => {
    onTranscriptUpdateRef.current?.(chunks);
  }, [chunks]);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const displayError = micError || transcribeError;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          1. Mic &amp; Transcript
        </h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isRecording
            ? "bg-red-500/20 text-red-400"
            : "bg-zinc-700 text-zinc-400"
        }`}>
          {isRecording ? "RECORDING" : "IDLE"}
        </span>
      </div>

      {/* Mic button */}
      <div className="flex flex-col items-center gap-3 p-6">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center justify-center h-16 w-16 rounded-full text-white font-medium text-sm transition-colors ${
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          {isRecording ? (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <span className="text-xs text-zinc-500">
          {isRecording ? "Click to stop" : "Click to start recording"}
        </span>
        {isRecording && (
          <button
            onClick={flushCurrentChunk}
            disabled={isTranscribing}
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors disabled:opacity-50"
            title="Transcribe buffered audio now"
          >
            ↻ Flush now
          </button>
        )}
      </div>

      {displayError && (
        <div className="mx-4 p-3 text-sm bg-red-900/20 text-red-400 rounded-lg">
          {displayError}
        </div>
      )}

      {isTranscribing && (
        <div className="mx-4 p-2 text-sm text-zinc-400 flex items-center gap-2">
          <span className="animate-spin h-4 w-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full" />
          Transcribing...
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chunks.length === 0 && !isRecording && (
          <p className="text-sm text-zinc-500 text-center mt-4">
            No transcript yet — start the mic.
          </p>
        )}
        {chunks.length === 0 && isRecording && !isTranscribing && (
          <p className="text-sm text-zinc-500 text-center mt-4">
            Listening... transcript will appear after ~30 seconds.
          </p>
        )}
        {chunks.map((chunk) => (
          <div key={chunk.id} className="border-l-2 border-emerald-400 pl-3 py-1">
            <p className="text-xs text-zinc-500 mb-1">
              {formatTime(chunk.timestamp)}
            </p>
            <p className="text-sm text-zinc-200 leading-relaxed">
              {chunk.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
