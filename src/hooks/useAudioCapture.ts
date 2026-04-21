"use client";

import { useState, useRef, useCallback } from "react";

export interface AudioChunk {
  blob: Blob;
  timestamp: number;
}

interface UseAudioCaptureOptions {
  chunkIntervalMs?: number;
  onChunkReady?: (chunk: AudioChunk) => void;
}

interface UseAudioCaptureReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  flushCurrentChunk: () => void;
  error: string | null;
}

export function useAudioCapture(
  options: UseAudioCaptureOptions = {}
): UseAudioCaptureReturn {
  const { chunkIntervalMs = 15000, onChunkReady } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChunkReadyRef = useRef(onChunkReady);
  const isStoppingRef = useRef(false);
  onChunkReadyRef.current = onChunkReady;

  const createRecorder = useCallback((stream: MediaStream): MediaRecorder => {
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size > 0) {
          onChunkReadyRef.current?.({ blob, timestamp: Date.now() });
        }
      }

      if (!isStoppingRef.current && streamRef.current && streamRef.current.active) {
        try {
          const newRecorder = createRecorder(streamRef.current);
          mediaRecorderRef.current = newRecorder;
          newRecorder.start();
        } catch (err) {
          console.error("Failed to restart recorder:", err);
        }
      }
    };

    return recorder;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    isStoppingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = createRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      intervalRef.current = setInterval(() => {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state === "recording") {
          rec.stop();
        }
      }, chunkIntervalMs);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied. Please allow mic permission.");
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError("Failed to start recording.");
      }
    }
  }, [chunkIntervalMs, createRecorder]);

  const stopRecording = useCallback(() => {
    isStoppingRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  const flushCurrentChunk = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop();
    }
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    flushCurrentChunk,
    error,
  };
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}
