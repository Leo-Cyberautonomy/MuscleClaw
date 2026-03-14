/**
 * PostureScanner — static posture analysis for body scan mode.
 *
 * Captures a snapshot of landmark positions and runs rule-based
 * analysis for common postural issues:
 * - Shoulder tilt (左右肩不平)
 * - Anterior pelvic tilt (骨盆前倾)
 * - Forward head posture (头部前移)
 * - Scoliosis indicators (脊柱侧弯)
 */
import { distance } from '../utils/math';
import type { Landmark } from './types';
import { POSE } from './types';

export interface PostureIssue {
  type: 'shoulder_tilt' | 'pelvic_tilt' | 'forward_head' | 'scoliosis';
  severity: 'ok' | 'mild' | 'moderate' | 'severe';
  value: number;
  description: string;
}

export interface PostureReport {
  issues: PostureIssue[];
  shoulderTiltDeg: number;
  pelvisTiltDeg: number;
  headForwardRatio: number;
  spineDeviationRatio: number;
  overallScore: number; // 0-100, higher is better
  timestamp: number;
}

// ── Averaging buffer for stable readings ──────────────────────────

const BUFFER_SIZE = 30; // ~1 second at 30fps
let landmarkBuffer: Landmark[][] = [];

export function resetPostureScanner() {
  landmarkBuffer = [];
}

/**
 * Feed a frame's landmarks into the buffer.
 * Returns true when buffer is full and ready for analysis.
 */
export function feedFrame(landmarks: Landmark[]): boolean {
  landmarkBuffer.push(landmarks.map(l => ({ ...l })));
  if (landmarkBuffer.length > BUFFER_SIZE) landmarkBuffer.shift();
  return landmarkBuffer.length >= BUFFER_SIZE;
}

/**
 * Analyze the buffered landmark data and produce a posture report.
 * Call only when `feedFrame` returns true.
 */
export function analyzePosture(): PostureReport {
  // Average landmarks across buffer for stability
  const avg = averageLandmarks(landmarkBuffer);
  const issues: PostureIssue[] = [];

  // 1. Shoulder tilt — compare y positions of left and right shoulder
  const shoulderDiffY = avg[POSE.LEFT_SHOULDER].y - avg[POSE.RIGHT_SHOULDER].y;
  // Normalize by torso height (shoulder to hip distance)
  const torsoHeight = (
    distance(avg[POSE.LEFT_SHOULDER], avg[POSE.LEFT_HIP]) +
    distance(avg[POSE.RIGHT_SHOULDER], avg[POSE.RIGHT_HIP])
  ) / 2;
  const shoulderTiltRatio = torsoHeight > 0 ? shoulderDiffY / torsoHeight : 0;
  const shoulderTiltDeg = shoulderTiltRatio * 45; // rough deg conversion

  if (Math.abs(shoulderTiltDeg) > 2) {
    const side = shoulderTiltDeg > 0 ? '右' : '左';
    const sev = Math.abs(shoulderTiltDeg) > 8 ? 'severe'
      : Math.abs(shoulderTiltDeg) > 5 ? 'moderate' : 'mild';
    issues.push({
      type: 'shoulder_tilt',
      severity: sev,
      value: Math.round(Math.abs(shoulderTiltDeg) * 10) / 10,
      description: `${side}肩偏高 ${Math.abs(shoulderTiltDeg).toFixed(1)}°`,
    });
  }

  // 2. Pelvic tilt — angle between hip-shoulder line and vertical
  // Anterior pelvic tilt: hips are pushed forward relative to shoulders
  const hipMidX = (avg[POSE.LEFT_HIP].x + avg[POSE.RIGHT_HIP].x) / 2;
  const hipMidY = (avg[POSE.LEFT_HIP].y + avg[POSE.RIGHT_HIP].y) / 2;
  const shoulderMidX = (avg[POSE.LEFT_SHOULDER].x + avg[POSE.RIGHT_SHOULDER].x) / 2;
  const shoulderMidY = (avg[POSE.LEFT_SHOULDER].y + avg[POSE.RIGHT_SHOULDER].y) / 2;

  const torsoAngleRad = Math.atan2(shoulderMidX - hipMidX, hipMidY - shoulderMidY);
  const pelvisTiltDeg = torsoAngleRad * (180 / Math.PI);

  if (Math.abs(pelvisTiltDeg) > 5) {
    const sev = Math.abs(pelvisTiltDeg) > 15 ? 'severe'
      : Math.abs(pelvisTiltDeg) > 10 ? 'moderate' : 'mild';
    issues.push({
      type: 'pelvic_tilt',
      severity: sev,
      value: Math.round(Math.abs(pelvisTiltDeg) * 10) / 10,
      description: `骨盆${pelvisTiltDeg > 0 ? '前' : '后'}倾 ${Math.abs(pelvisTiltDeg).toFixed(1)}°`,
    });
  }

  // 3. Forward head posture detection
  // Positive ratio means head is forward in side view
  // But in frontal view this measures lateral offset
  // Use ear-to-shoulder horizontal distance as proxy
  const earMidY = (avg[POSE.LEFT_EAR].y + avg[POSE.RIGHT_EAR].y) / 2;
  const headForwardProxy = shoulderMidY - earMidY; // negative means head is forward of shoulders
  const headForwardNorm = torsoHeight > 0 ? Math.abs(headForwardProxy) / torsoHeight : 0;

  if (headForwardNorm > 0.15) {
    const sev = headForwardNorm > 0.3 ? 'severe'
      : headForwardNorm > 0.2 ? 'moderate' : 'mild';
    issues.push({
      type: 'forward_head',
      severity: sev,
      value: Math.round(headForwardNorm * 100),
      description: `头部前移 ${(headForwardNorm * 100).toFixed(0)}%`,
    });
  }

  // 4. Scoliosis indicator — midpoint of shoulders vs midpoint of hips lateral offset
  const spineDeviationRatio = torsoHeight > 0
    ? Math.abs(shoulderMidX - hipMidX) / torsoHeight
    : 0;

  if (spineDeviationRatio > 0.05) {
    const side = shoulderMidX > hipMidX ? '右' : '左';
    const sev = spineDeviationRatio > 0.15 ? 'severe'
      : spineDeviationRatio > 0.1 ? 'moderate' : 'mild';
    issues.push({
      type: 'scoliosis',
      severity: sev,
      value: Math.round(spineDeviationRatio * 100),
      description: `脊柱向${side}偏移 ${(spineDeviationRatio * 100).toFixed(0)}%`,
    });
  }

  // Overall score: start at 100, deduct for each issue
  const deductions: Record<string, number> = { mild: 5, moderate: 15, severe: 30 };
  let score = 100;
  for (const issue of issues) {
    score -= deductions[issue.severity] ?? 0;
  }
  score = Math.max(0, score);

  return {
    issues,
    shoulderTiltDeg: Math.round(shoulderTiltDeg * 10) / 10,
    pelvisTiltDeg: Math.round(pelvisTiltDeg * 10) / 10,
    headForwardRatio: Math.round(headForwardNorm * 100) / 100,
    spineDeviationRatio: Math.round(spineDeviationRatio * 100) / 100,
    overallScore: score,
    timestamp: Date.now(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function averageLandmarks(buffer: Landmark[][]): Landmark[] {
  const n = buffer.length;
  const count = buffer[0].length;
  const result: Landmark[] = [];

  for (let i = 0; i < count; i++) {
    let sx = 0, sy = 0, sz = 0, sv = 0;
    for (let f = 0; f < n; f++) {
      sx += buffer[f][i].x;
      sy += buffer[f][i].y;
      sz += buffer[f][i].z;
      sv += buffer[f][i].visibility ?? 1;
    }
    result.push({ x: sx / n, y: sy / n, z: sz / n, visibility: sv / n });
  }

  return result;
}
