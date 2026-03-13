import { angleBetween } from '../utils/math';
import type { Landmark, CVEvent } from './types';
import { POSE } from './types';

interface RepState {
  phase: 'idle' | 'eccentric' | 'concentric';
  maxAngle: number;
  minAngle: number;
  repCount: number;
  repStartTime: number;
  lastAngle: number;
}

const state: RepState = {
  phase: 'idle', maxAngle: 0, minAngle: 180,
  repCount: 0, repStartTime: 0, lastAngle: 0,
};

export function resetRepCounter() {
  state.phase = 'idle'; state.maxAngle = 0; state.minAngle = 180;
  state.repCount = 0; state.repStartTime = 0; state.lastAngle = 0;
}

/**
 * Process a frame's landmarks and detect rep completion.
 * Returns a CVEvent if a rep was completed, null otherwise.
 */
export function processFrame(
  landmarks: Landmark[],
  exerciseId: string,
  romThreshold: number = 140,
): CVEvent | null {
  const leftAngle = angleBetween(
    landmarks[POSE.LEFT_SHOULDER], landmarks[POSE.LEFT_ELBOW], landmarks[POSE.LEFT_WRIST]
  );
  const rightAngle = angleBetween(
    landmarks[POSE.RIGHT_SHOULDER], landmarks[POSE.RIGHT_ELBOW], landmarks[POSE.RIGHT_WRIST]
  );
  const angle = (leftAngle + rightAngle) / 2;

  state.maxAngle = Math.max(state.maxAngle, angle);
  state.minAngle = Math.min(state.minAngle, angle);

  const now = performance.now();

  if (state.phase === 'idle') {
    if (angle < state.lastAngle - 5) {
      state.phase = 'eccentric';
      state.repStartTime = now;
      state.minAngle = angle;
    }
  } else if (state.phase === 'eccentric') {
    state.minAngle = Math.min(state.minAngle, angle);
    if (angle > state.lastAngle + 10) {
      state.phase = 'concentric';
    }
  } else if (state.phase === 'concentric') {
    state.maxAngle = Math.max(state.maxAngle, angle);
    if (angle > romThreshold || (angle > state.lastAngle + 2 && angle > 120)) {
      state.repCount++;
      const rom = state.maxAngle - state.minAngle;
      const duration = now - state.repStartTime;
      state.phase = 'idle';
      state.maxAngle = 0;
      state.minAngle = 180;
      state.lastAngle = angle;

      return {
        type: 'rep_complete',
        exercise_id: exerciseId,
        rep: state.repCount,
        rom_degrees: Math.round(rom),
        duration_ms: Math.round(duration),
      };
    }
  }

  state.lastAngle = angle;
  return null;
}

export function getRepCount() { return state.repCount; }
