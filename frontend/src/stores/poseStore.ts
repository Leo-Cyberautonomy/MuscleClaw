/**
 * PoseStore — manages latest pose landmark data.
 *
 * Stores the most recent MediaPipe detection results so that
 * components (BodyPanel, Canvas renderers) can access landmarks
 * without prop-drilling through the component tree.
 */
import { create } from 'zustand';
import type { Landmark } from '../cv/types';
import type { PostureReport } from '../cv/postureScanner';

interface PoseState {
  landmarks: Landmark[] | null;
  handLandmarks: any[] | null;
  canvasSize: { w: number; h: number };
  postureReport: PostureReport | null;
  postureScanning: boolean;

  setLandmarks: (lm: Landmark[] | null) => void;
  setHandLandmarks: (lm: any[] | null) => void;
  setCanvasSize: (w: number, h: number) => void;
  setPostureReport: (report: PostureReport | null) => void;
  setPostureScanning: (scanning: boolean) => void;
}

export const usePoseStore = create<PoseState>((set) => ({
  landmarks: null,
  handLandmarks: null,
  canvasSize: { w: 0, h: 0 },
  postureReport: null,
  postureScanning: false,

  setLandmarks: (landmarks) => set({ landmarks }),
  setHandLandmarks: (handLandmarks) => set({ handLandmarks }),
  setCanvasSize: (w, h) => set({ canvasSize: { w, h } }),
  setPostureReport: (postureReport) => set({ postureReport }),
  setPostureScanning: (postureScanning) => set({ postureScanning }),
}));
