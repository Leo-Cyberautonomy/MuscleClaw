import { create } from 'zustand';

export type AppMode = 'idle' | 'body_scan' | 'planning' | 'training' | 'posture' | 'showcase';

interface TrainingState {
  exerciseId: string | null;
  setNumber: number;
  reps: number;
  targetReps: number;
  targetWeight: number;
}

interface AppState {
  mode: AppMode;
  connected: boolean;
  sidebarOpen: boolean;
  safetyAlertActive: boolean;
  safetyCountdown: number;
  restTimerSeconds: number;
  transcript: { role: 'user' | 'model'; text: string; ts: number }[];
  training: TrainingState;
  bodyProfile: Record<string, any> | null;
  trainingPlan: any | null;

  setMode: (mode: AppMode) => void;
  setConnected: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setSafetyAlert: (active: boolean, countdown?: number) => void;
  setRestTimer: (seconds: number) => void;
  addTranscript: (role: 'user' | 'model', text: string) => void;
  updateTraining: (partial: Partial<TrainingState>) => void;
  setBodyProfile: (profile: any) => void;
  setTrainingPlan: (plan: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  connected: false,
  sidebarOpen: true,
  safetyAlertActive: false,
  safetyCountdown: 0,
  restTimerSeconds: 0,
  transcript: [],
  training: { exerciseId: null, setNumber: 0, reps: 0, targetReps: 0, targetWeight: 0 },
  bodyProfile: null,
  trainingPlan: null,

  setMode: (mode) => set({ mode, sidebarOpen: mode !== 'idle' }),
  setConnected: (connected) => set({ connected }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSafetyAlert: (active, countdown = 10) => set({ safetyAlertActive: active, safetyCountdown: countdown }),
  setRestTimer: (seconds) => set({ restTimerSeconds: seconds }),
  addTranscript: (role, text) => set((s) => ({
    transcript: [...s.transcript.slice(-10), { role, text, ts: Date.now() }],
  })),
  updateTraining: (partial) => set((s) => ({ training: { ...s.training, ...partial } })),
  setBodyProfile: (bodyProfile) => set({ bodyProfile }),
  setTrainingPlan: (trainingPlan) => set({ trainingPlan }),
}));
