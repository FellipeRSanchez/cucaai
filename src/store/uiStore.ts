import { create } from 'zustand';

export type ViewType = 'CHAT' | 'AGENTS' | 'DOCUMENTS' | 'MEMORIES' | 'GRAPH' | 'SETTINGS';

interface UIState {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  isUploadModalOpen: boolean;
  setUploadModalOpen: (open: boolean) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'CHAT',
  setActiveView: (view) => set({ activeView: view }),
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  isUploadModalOpen: false,
  setUploadModalOpen: (open) => set({ isUploadModalOpen: open }),
  webSearchEnabled: false,
  setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
}));
