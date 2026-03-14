/**
 * UIStore — manages UI display state.
 *
 * Controls sidebar visibility, safety alerts, and other
 * transient UI state that doesn't belong to domain stores.
 */
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  safetyAlertActive: boolean;
  safetyCountdown: number;

  setSidebarOpen: (v: boolean) => void;
  setSafetyAlert: (active: boolean, countdown?: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  safetyAlertActive: false,
  safetyCountdown: 0,

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSafetyAlert: (active, countdown = 10) => set({
    safetyAlertActive: active,
    safetyCountdown: countdown,
  }),
}));
