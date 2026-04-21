"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings as SettingsType, loadSettings, saveSettings, getDefaultSettings } from "@/lib/settings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<SettingsType>(getDefaultSettings());

  useEffect(() => {
    if (isOpen) setSettings(loadSettings());
  }, [isOpen]);

  const handleSave = useCallback(() => {
    saveSettings(settings);
    onClose();
  }, [settings, onClose]);

  const handleReset = useCallback(() => {
    setSettings(getDefaultSettings());
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* API Key */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Groq API Key</label>
            <input
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
              placeholder="gsk_..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Context Windows */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Suggestion Context Window (chars)</label>
              <input
                type="number"
                value={settings.suggestionContextWindow}
                onChange={(e) => setSettings({ ...settings, suggestionContextWindow: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">Chat Context Window (chars)</label>
              <input
                type="number"
                value={settings.chatContextWindow}
                onChange={(e) => setSettings({ ...settings, chatContextWindow: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Suggestion Prompt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Suggestion Prompt</label>
            <textarea
              value={settings.suggestionPrompt}
              onChange={(e) => setSettings({ ...settings, suggestionPrompt: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Detail Prompt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Detail Answer Prompt</label>
            <textarea
              value={settings.detailPrompt}
              onChange={(e) => setSettings({ ...settings, detailPrompt: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Chat Prompt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Chat Prompt</label>
            <textarea
              value={settings.chatPrompt}
              onChange={(e) => setSettings({ ...settings, chatPrompt: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleReset}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
