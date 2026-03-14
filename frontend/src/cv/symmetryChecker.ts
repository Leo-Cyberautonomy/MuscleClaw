/**
 * SymmetryChecker — detects left/right imbalance during exercises.
 *
 * Compares matching joint angles on left and right sides.
 * Emits form_issue events when asymmetry exceeds thresholds.
 */
import { angleBetween } from '../utils/math';
import type { Landmark, CVEvent } from './types';
import { POSE } from './types';

/** Paired joints to compare for symmetry. */
interface SymmetryPair {
  name: string;
  left: { a: number; b: number; c: number };
  right: { a: number; b: number; c: number };
}

const ELBOW_PAIR: SymmetryPair = {
  name: 'elbow',
  left: { a: POSE.LEFT_SHOULDER, b: POSE.LEFT_ELBOW, c: POSE.LEFT_WRIST },
  right: { a: POSE.RIGHT_SHOULDER, b: POSE.RIGHT_ELBOW, c: POSE.RIGHT_WRIST },
};

const KNEE_PAIR: SymmetryPair = {
  name: 'knee',
  left: { a: POSE.LEFT_HIP, b: POSE.LEFT_KNEE, c: POSE.LEFT_ANKLE },
  right: { a: POSE.RIGHT_HIP, b: POSE.RIGHT_KNEE, c: POSE.RIGHT_ANKLE },
};

const SHOULDER_PAIR: SymmetryPair = {
  name: 'shoulder',
  left: { a: POSE.LEFT_ELBOW, b: POSE.LEFT_SHOULDER, c: POSE.LEFT_HIP },
  right: { a: POSE.RIGHT_ELBOW, b: POSE.RIGHT_SHOULDER, c: POSE.RIGHT_HIP },
};

/** Exercise → which joint pairs to check. */
const EXERCISE_PAIRS: Record<string, SymmetryPair[]> = {
  bench_press: [ELBOW_PAIR, SHOULDER_PAIR],
  squat: [KNEE_PAIR],
  ohp: [ELBOW_PAIR, SHOULDER_PAIR],
  barbell_row: [ELBOW_PAIR],
  barbell_curl: [ELBOW_PAIR],
};

// ── State ─────────────────────────────────────────────────────────

/** Smoothed asymmetry values per joint pair (EMA). */
const smoothedDiff: Map<string, number> = new Map();
const EMA_ALPHA = 0.3;

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 5000;

/** Latest symmetry scores for rendering. */
export let currentSymmetry: Map<string, { left: number; right: number; diff: number }> = new Map();

export function resetSymmetryChecker() {
  smoothedDiff.clear();
  currentSymmetry = new Map();
  lastAlertTime = 0;
}

/**
 * Check symmetry for the current frame.
 * Returns a form_issue CVEvent if significant asymmetry is detected.
 * Always updates `currentSymmetry` for the rendering layer.
 */
export function checkSymmetry(
  landmarks: Landmark[],
  exerciseId: string,
  threshold: number = 10,
): CVEvent | null {
  const pairs = EXERCISE_PAIRS[exerciseId] ?? [ELBOW_PAIR];

  let worstPair: string | null = null;
  let worstDiff = 0;
  let worstSide = '';

  for (const pair of pairs) {
    const leftAngle = angleBetween(
      landmarks[pair.left.a], landmarks[pair.left.b], landmarks[pair.left.c],
    );
    const rightAngle = angleBetween(
      landmarks[pair.right.a], landmarks[pair.right.b], landmarks[pair.right.c],
    );

    const rawDiff = Math.abs(leftAngle - rightAngle);

    // Apply EMA smoothing to avoid jitter
    const prev = smoothedDiff.get(pair.name) ?? rawDiff;
    const smoothed = EMA_ALPHA * rawDiff + (1 - EMA_ALPHA) * prev;
    smoothedDiff.set(pair.name, smoothed);

    currentSymmetry.set(pair.name, {
      left: Math.round(leftAngle),
      right: Math.round(rightAngle),
      diff: Math.round(smoothed),
    });

    if (smoothed > worstDiff) {
      worstDiff = smoothed;
      worstPair = pair.name;
      worstSide = leftAngle < rightAngle ? 'left' : 'right';
    }
  }

  if (worstDiff <= threshold || !worstPair) return null;

  const now = performance.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return null;
  lastAlertTime = now;

  return {
    type: 'form_issue',
    exercise_id: exerciseId,
    issue: 'asymmetry',
    severity: worstDiff > 20 ? 'danger' : 'warning',
    details: `${worstSide} ${worstPair} ${Math.round(worstDiff)}° lower`,
  };
}
