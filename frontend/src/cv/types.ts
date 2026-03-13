export type CVEvent =
  | { type: 'person_detected'; detected: boolean }
  | { type: 'rep_complete'; exercise_id: string; rep: number; rom_degrees: number; duration_ms: number }
  | { type: 'form_issue'; exercise_id: string; issue: string; severity: 'warning' | 'danger'; details: string }
  | { type: 'safety_alert'; alert: 'barbell_stall' | 'body_collapse' | 'extended_stillness'; confidence: number }
  | { type: 'gesture'; gesture: 'thumbs_up' | 'ok' | 'wave' | 'point_click'; target?: string }
  | { type: 'set_complete'; exercise_id: string; reps: number; estimated_rpe: number };

export interface Landmark { x: number; y: number; z: number; visibility?: number; }

// MediaPipe pose landmark indices
export const POSE = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

// Skeleton connections for rendering
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], [23, 24], // torso
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
];
