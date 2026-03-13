import type { Landmark } from '../cv/types';
import { POSE_CONNECTIONS } from '../cv/types';

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  issueJoints?: Set<number>,
) {
  // Glow layer
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b];
    if (!la || !lb) continue;
    const isIssue = issueJoints?.has(a) || issueJoints?.has(b);
    ctx.strokeStyle = isIssue ? 'rgba(255,60,60,0.3)' : 'rgba(0,255,180,0.15)';
    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }

  // Sharp line layer
  ctx.lineWidth = 2;
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b];
    if (!la || !lb) continue;
    const isIssue = issueJoints?.has(a) || issueJoints?.has(b);
    ctx.strokeStyle = isIssue ? 'rgba(255,60,60,0.9)' : 'rgba(0,255,180,0.7)';
    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }

  // Joint dots
  for (let i = 0; i < landmarks.length; i++) {
    const l = landmarks[i];
    if (!l || (l.visibility !== undefined && l.visibility < 0.5)) continue;
    const isIssue = issueJoints?.has(i);
    ctx.fillStyle = isIssue ? 'rgba(255,60,60,0.9)' : 'rgba(0,255,180,0.8)';
    ctx.beginPath();
    ctx.arc(l.x * width, l.y * height, isIssue ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
