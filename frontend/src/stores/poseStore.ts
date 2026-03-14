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
  postureReport: PostureReport | null;
  postureScanning: boolean;

  setLandmarks: (lm: Landmark[] | null) => void;
  setHandLandmarks: (lm: any[] | null) => void;
  setPostureReport: (report: PostureReport | null) => void;
  setPostureScanning: (scanning: boolean) => void;
}

export const usePoseStore = create<PoseState>((set) => ({
  landmarks: null,
  handLandmarks: null,
  postureReport: null,
  postureScanning: false,

  setLandmarks: (landmarks) => set({ landmarks }),
  setHandLandmarks: (handLandmarks) => set({ handLandmarks }),
  setPostureReport: (postureReport) => set({ postureReport }),
  setPostureScanning: (postureScanning) => set({ postureScanning }),
}));
