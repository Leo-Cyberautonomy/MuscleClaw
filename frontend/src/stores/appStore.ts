/**
 * AppStore — core application state.
 *
 * Manages mode, connection status, transcript history, and body profile.
 * Training, pose, and UI state are in their dedicated stores.
 *
 * Re-exports from modular stores for gradual migration of consumers.
 */
import { create } from 'zustand';

export type AppMode = 'idle' | 'dashboard' | 'body_scan' | 'planning' | 'training' | 'posture' | 'showcase';

interface AppState {
  mode: AppMode;
  connected: boolean;
  transcript: { role: 'user' | 'model'; text: string; ts: number }[];
  bodyProfile: Record<string, any> | null;

  setMode: (mode: AppMode) => void;
  setConnected: (v: boolean) => void;
  addTranscript: (role: 'user' | 'model', text: string) => void;
  setBodyProfile: (profile: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  connected: false,
  transcript: [],
  bodyProfile: null,

  setMode: (mode) => set({ mode }),
  setConnected: (connected) => set({ connected }),
  addTranscript: (role, text) => set((s) => ({
    transcript: [...s.transcript.slice(-50), { role, text, ts: Date.now() }],
  })),
  setBodyProfile: (bodyProfile) => set({ bodyProfile }),
}));

// Re-export modular stores
export { useTrainingStore } from './trainingStore';
export { usePoseStore } from './poseStore';
export { useUIStore } from './uiStore';
