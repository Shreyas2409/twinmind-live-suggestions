"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TranscriptChunk } from "@/components/TranscriptPanel";
import { getFullSettings } from "@/lib/store";
import {
  ChatMessage,
  buildSuggestionContext,
  buildChatMessages,
  buildDetailMessages,
} from "@/lib/prompts";

export interface SelectedSuggestion {
  title: string;
  preview: string;
  type: string;
}

interface ChatPanelProps {
  transcriptChunks: TranscriptChunk[];
  selectedSuggestion: SelectedSuggestion | null;
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

export default function ChatPanel({
  transcriptChunks,
  selectedSuggestion,
  onMessagesUpdate,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSuggestionRef = useRef<SelectedSuggestion | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onMessagesUpdateRef = useRef(onMessagesUpdate);
  onMessagesUpdateRef.current = onMessagesUpdate;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Report messages to parent for export — only when NOT streaming
  useEffect(() => {
    if (!isStreaming) {
      onMessagesUpdateRef.current?.(messages);
    }
  }, [messages, isStreaming]);

  const sendToApiRef = useRef<
    (userMsg: ChatMessage, isSuggestion: boolean) => Promise<void>
  >(() => Promise.resolve());

  // Handle suggestion clicks from middle panel
  useEffect(() => {
    if (
      selectedSuggestion &&
      selectedSuggestion !== lastSuggestionRef.current
    ) {
      lastSuggestionRef.current = selectedSuggestion;
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: `**${selectedSuggestion.title}**\n${selectedSuggestion.preview}`,
        timestamp: Date.now(),
        suggestionType: selectedSuggestion.type,
      };
      setMessages((prev) => [...prev, userMsg]);
      sendToApiRef.current(userMsg, true);
    }
  }, [selectedSuggestion]);

  const sendToApi = useCallback(
    async (userMsg: ChatMessage, isSuggestion: boolean) => {
      const settings = getFullSettings();
      if (!settings.groqApiKey) return;

      const transcript = buildSuggestionContext(
        transcriptChunks,
        settings.chatContextWindow
      );

      let apiMessages: { role: string; content: string }[];
      if (isSuggestion) {
        apiMessages = buildDetailMessages(
          transcript,
          userMsg.content,
          settings.detailPrompt,
          settings.chatContextWindow
        );
      } else {
        // Include all prior messages for context
        const priorMessages = messages.filter((m) => m.id !== userMsg.id);
        apiMessages = buildChatMessages(
          transcript,
          [...priorMessages, userMsg],
          settings.chatPrompt,
          settings.chatContextWindow
        );
      }

      // Reinforce brevity on the primary system prompt so the model doesn't ignore it
      if (apiMessages.length > 0 && apiMessages[0].role === "system") {
        const brevityNote = isSuggestion
          ? "\n\nCRITICAL: Your response must be under 120 words. Use 3-4 bullet points maximum. No tables. No section headers. Start with the key insight immediately."
          : "\n\nCRITICAL: Your response must be under 100 words. Use 3-4 bullet points maximum. No tables. No section headers. Start with the answer immediately.";
        apiMessages[0] = {
          ...apiMessages[0],
          content: apiMessages[0].content + brevityNote,
        };
      }

      const assistantId = `msg-${Date.now()}-assistant`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            apiKey: settings.groqApiKey,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${err.error || "Request failed"}` }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + delta }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Error: Failed to get response." }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [transcriptChunks, messages]
  );

  sendToApiRef.current = sendToApi;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    sendToApiRef.current(userMsg, false);
  }, [input, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Bold
      let processed = line.replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="font-semibold">$1</strong>'
      );
      // Inline code
      processed = processed.replace(
        /`([^`]+)`/g,
        '<code class="bg-zinc-700 px-1 rounded text-sm">$1</code>'
      );
      // Bullet points
      if (/^[-*]\s/.test(processed)) {
        processed = "• " + processed.slice(2);
      }
      // Numbered list
      if (/^(\d+)\.\s/.test(processed)) {
        // keep as-is
      }

      if (!processed.trim()) {
        return <br key={i} />;
      }
      return (
        <p
          key={i}
          className="mb-1"
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          3. Chat (Detailed Answers)
        </h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
          SESSION-ONLY
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 text-center mt-8">
            Click a suggestion or type a question below.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-200"
              }`}
            >
              {msg.suggestionType && (
                <span className="inline-block mb-1 text-[10px] uppercase tracking-wider opacity-70 bg-white/10 rounded px-1.5 py-0.5">
                  {msg.suggestionType}
                </span>
              )}
              <div className="leading-relaxed">
                {msg.role === "assistant"
                  ? renderMarkdown(msg.content || (isStreaming && msg.content === "" ? "" : ""))
                  : renderMarkdown(msg.content)}
              </div>
              {msg.role === "assistant" && isStreaming && msg === messages[messages.length - 1] && msg.content === "" && (
                <span className="text-xs text-zinc-400 animate-pulse">Typing...</span>
              )}
              <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-blue-200" : "text-zinc-500"}`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content !== "" && (
          <div className="flex justify-start">
            <span className="text-xs text-zinc-500 animate-pulse ml-2">●●●</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isStreaming}
            className="flex-1 bg-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
