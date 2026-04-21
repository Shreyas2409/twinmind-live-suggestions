import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Settings,
  DEFAULT_SUGGESTION_PROMPT,
  DEFAULT_DETAIL_PROMPT,
  DEFAULT_CHAT_PROMPT,
  DEFAULT_SUGGESTION_CONTEXT_WINDOW,
  DEFAULT_CHAT_CONTEXT_WINDOW,
} from "./settings";

// Separate store for the API key (NOT persisted)
interface ApiKeyStore {
  groqApiKey: string;
  setApiKey: (key: string) => void;
}

export const useApiKeyStore = create<ApiKeyStore>((set) => ({
  groqApiKey: "",
  setApiKey: (key: string) => set({ groqApiKey: key }),
}));

// Settings store (persisted to localStorage, WITHOUT the API key)
interface PersistedSettings {
  suggestionPrompt: string;
  detailPrompt: string;
  chatPrompt: string;
  suggestionContextWindow: number;
  chatContextWindow: number;
}

interface SettingsStore extends PersistedSettings {
  updateSettings: (settings: Partial<PersistedSettings>) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
      detailPrompt: DEFAULT_DETAIL_PROMPT,
      chatPrompt: DEFAULT_CHAT_PROMPT,
      suggestionContextWindow: DEFAULT_SUGGESTION_CONTEXT_WINDOW,
      chatContextWindow: DEFAULT_CHAT_CONTEXT_WINDOW,
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
      resetToDefaults: () =>
        set({
          suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
          detailPrompt: DEFAULT_DETAIL_PROMPT,
          chatPrompt: DEFAULT_CHAT_PROMPT,
          suggestionContextWindow: DEFAULT_SUGGESTION_CONTEXT_WINDOW,
          chatContextWindow: DEFAULT_CHAT_CONTEXT_WINDOW,
        }),
    }),
    {
      name: "twinmind-settings",
    }
  )
);

// Helper function for non-React code (API routes won't use this, but components can)
export function getFullSettings(): Settings {
  const apiKey = useApiKeyStore.getState().groqApiKey;
  const settings = useSettingsStore.getState();
  return {
    groqApiKey: apiKey,
    suggestionPrompt: settings.suggestionPrompt,
    detailPrompt: settings.detailPrompt,
    chatPrompt: settings.chatPrompt,
    suggestionContextWindow: settings.suggestionContextWindow,
    chatContextWindow: settings.chatContextWindow,
  };
}
