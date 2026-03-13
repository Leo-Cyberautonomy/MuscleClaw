import type { Landmark, CVEvent } from './types';
import { POSE } from './types';

const STALL_FRAMES = 15; // ~0.5s at 30fps
const STALL_THRESHOLD = 3; // pixels

let positionHistory: number[] = [];
let lastAlertTime = 0;

export function resetSafetyMonitor() {
  positionHistory = [];
  lastAlertTime = 0;
}

export function checkSafety(landmarks: Landmark[], canvasHeight: number): CVEvent | null {
  const shoulderY = (landmarks[POSE.LEFT_SHOULDER].y + landmarks[POSE.RIGHT_SHOULDER].y) / 2 * canvasHeight;
  positionHistory.push(shoulderY);
  if (positionHistory.length > STALL_FRAMES) positionHistory.shift();
  if (positionHistory.length < STALL_FRAMES) return null;

  const min = Math.min(...positionHistory);
  const max = Math.max(...positionHistory);
  const range = max - min;

  const now = performance.now();
  if (range < STALL_THRESHOLD && now - lastAlertTime > 10000) {
    const hipY = (landmarks[POSE.LEFT_HIP].y + landmarks[POSE.RIGHT_HIP].y) / 2 * canvasHeight;
    if (shoulderY > hipY * 0.8) {
      lastAlertTime = now;
      return {
        type: 'safety_alert',
        alert: 'barbell_stall',
        confidence: 0.75,
      };
    }
  }

  return null;
}
