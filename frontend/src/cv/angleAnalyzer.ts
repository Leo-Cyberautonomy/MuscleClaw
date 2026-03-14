/**
 * AngleAnalyzer — real-time joint angle analysis for form correction.
 *
 * Computes key joint angles each frame and emits form_issue events
 * when angles deviate from exercise-specific thresholds.
 */
import { angleBetween } from '../utils/math';
import type { Landmark, CVEvent } from './types';
import { POSE } from './types';

/** Joint angle definition: three landmark indices forming the angle at the middle point. */
interface JointDef {
  name: string;
  a: number;
  b: number; // vertex
  c: number;
}

/** Per-exercise form rules. */
interface FormRule {
  joints: JointDef[];
  /** Min acceptable angle at full extension (degrees). */
  extensionMin?: number;
  /** Max acceptable angle at full flexion (degrees). */
  flexionMax?: number;
  /** Custom check function for exercise-specific form issues. */
  check?: (angles: Map<string, number>, landmarks: Landmark[]) => CVEvent | null;
}

// ── Joint definitions ─────────────────────────────────────────────

const LEFT_ELBOW: JointDef = { name: 'left_elbow', a: POSE.LEFT_SHOULDER, b: POSE.LEFT_ELBOW, c: POSE.LEFT_WRIST };
const RIGHT_ELBOW: JointDef = { name: 'right_elbow', a: POSE.RIGHT_SHOULDER, b: POSE.RIGHT_ELBOW, c: POSE.RIGHT_WRIST };
const LEFT_SHOULDER: JointDef = { name: 'left_shoulder', a: POSE.LEFT_ELBOW, b: POSE.LEFT_SHOULDER, c: POSE.LEFT_HIP };
const RIGHT_SHOULDER: JointDef = { name: 'right_shoulder', a: POSE.RIGHT_ELBOW, b: POSE.RIGHT_SHOULDER, c: POSE.RIGHT_HIP };
const LEFT_KNEE: JointDef = { name: 'left_knee', a: POSE.LEFT_HIP, b: POSE.LEFT_KNEE, c: POSE.LEFT_ANKLE };
const RIGHT_KNEE: JointDef = { name: 'right_knee', a: POSE.RIGHT_HIP, b: POSE.RIGHT_KNEE, c: POSE.RIGHT_ANKLE };
const LEFT_HIP: JointDef = { name: 'left_hip', a: POSE.LEFT_SHOULDER, b: POSE.LEFT_HIP, c: POSE.LEFT_KNEE };
const RIGHT_HIP: JointDef = { name: 'right_hip', a: POSE.RIGHT_SHOULDER, b: POSE.RIGHT_HIP, c: POSE.RIGHT_KNEE };

// ── Exercise-specific form rules ──────────────────────────────────

const FORM_RULES: Record<string, FormRule> = {
  bench_press: {
    joints: [LEFT_ELBOW, RIGHT_ELBOW, LEFT_SHOULDER, RIGHT_SHOULDER],
    extensionMin: 150,
    check: (angles, _landmarks) => {
      // Elbow flare: shoulder angle > 80° indicates elbows too wide
      const leftShoulderAngle = angles.get('left_shoulder') ?? 0;
      const rightShoulderAngle = angles.get('right_shoulder') ?? 0;
      const avgShoulderAngle = (leftShoulderAngle + rightShoulderAngle) / 2;
      if (avgShoulderAngle > 80) {
        return {
          type: 'form_issue',
          exercise_id: 'bench_press',
          issue: 'elbow_flare',
          severity: avgShoulderAngle > 90 ? 'danger' : 'warning',
          details: `Elbow flare ${Math.round(avgShoulderAngle)}° (keep <75°)`,
        };
      }
      return null;
    },
  },
  squat: {
    joints: [LEFT_KNEE, RIGHT_KNEE, LEFT_HIP, RIGHT_HIP],
    flexionMax: 50,
    check: (angles, landmarks) => {
      // Knee cave: check if knees track inside feet
      const leftKneeX = landmarks[POSE.LEFT_KNEE].x;
      const leftAnkleX = landmarks[POSE.LEFT_ANKLE].x;
      const rightKneeX = landmarks[POSE.RIGHT_KNEE].x;
      const rightAnkleX = landmarks[POSE.RIGHT_ANKLE].x;

      // In a normalized coordinate system, left knee should be >= left ankle x
      // and right knee should be <= right ankle x (mirror)
      const leftCave = leftAnkleX - leftKneeX;
      const rightCave = rightKneeX - rightAnkleX;

      if (leftCave > 0.03 || rightCave > 0.03) {
        return {
          type: 'form_issue',
          exercise_id: 'squat',
          issue: 'knee_cave',
          severity: 'warning',
          details: `Knee valgus detected (L: ${(leftCave * 100).toFixed(1)}%, R: ${(rightCave * 100).toFixed(1)}%)`,
        };
      }

      // Forward lean: hip angle too acute indicates excessive forward lean
      const leftHipAngle = angles.get('left_hip') ?? 180;
      const rightHipAngle = angles.get('right_hip') ?? 180;
      const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;
      if (avgHipAngle < 45) {
        return {
          type: 'form_issue',
          exercise_id: 'squat',
          issue: 'forward_lean',
          severity: avgHipAngle < 30 ? 'danger' : 'warning',
          details: `Excessive forward lean (hip angle ${Math.round(avgHipAngle)}°)`,
        };
      }
      return null;
    },
  },
  ohp: {
    joints: [LEFT_ELBOW, RIGHT_ELBOW, LEFT_SHOULDER, RIGHT_SHOULDER],
    extensionMin: 160,
  },
  barbell_row: {
    joints: [LEFT_ELBOW, RIGHT_ELBOW, LEFT_HIP, RIGHT_HIP],
  },
  barbell_curl: {
    joints: [LEFT_ELBOW, RIGHT_ELBOW],
    extensionMin: 150,
  },
};

// ── Debounce state ────────────────────────────────────────────────

let lastIssueTime = 0;
const DEBOUNCE_MS = 3000; // Don't spam form issues faster than every 3s

// ── Exported state for rendering ──────────────────────────────────

/** Latest computed joint angles for the rendering layer. */
export let currentAngles: Map<string, number> = new Map();

export function resetAngleAnalyzer() {
  currentAngles = new Map();
  lastIssueTime = 0;
}

/**
 * Analyze joint angles for the current frame.
 * Returns a form_issue CVEvent if a problem is detected, null otherwise.
 * Always updates `currentAngles` for the rendering layer.
 */
export function analyzeAngles(
  landmarks: Landmark[],
  exerciseId: string,
): CVEvent | null {
  const rule = FORM_RULES[exerciseId];
  const joints = rule?.joints ?? [LEFT_ELBOW, RIGHT_ELBOW, LEFT_KNEE, RIGHT_KNEE];

  // Compute all joint angles
  const angles = new Map<string, number>();
  for (const j of joints) {
    const deg = angleBetween(landmarks[j.a], landmarks[j.b], landmarks[j.c]);
    angles.set(j.name, deg);
  }
  currentAngles = angles;

  if (!rule) return null;

  const now = performance.now();
  if (now - lastIssueTime < DEBOUNCE_MS) return null;

  // Run exercise-specific check
  if (rule.check) {
    const issue = rule.check(angles, landmarks);
    if (issue) {
      lastIssueTime = now;
      return issue;
    }
  }

  return null;
}
