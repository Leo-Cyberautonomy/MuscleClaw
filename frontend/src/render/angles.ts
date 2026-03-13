import { angleBetween } from '../utils/math';
import type { Landmark } from '../cv/types';

export function drawAngle(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  a: number, b: number, c: number,
  width: number, height: number,
  threshold?: number,
) {
  const la = landmarks[a], lb = landmarks[b], lc = landmarks[c];
  if (!la || !lb || !lc) return;

  const angle = angleBetween(la, lb, lc);
  const bx = lb.x * width, by = lb.y * height;
  const isOk = !threshold || angle >= threshold;

  // Draw arc
  const startAngle = Math.atan2(la.y - lb.y, la.x - lb.x);
  const endAngle = Math.atan2(lc.y - lb.y, lc.x - lb.x);
  ctx.strokeStyle = isOk ? 'rgba(255,255,255,0.4)' : 'rgba(255,60,60,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bx, by, 25, startAngle, endAngle);
  ctx.stroke();

  // Draw angle text
  ctx.fillStyle = isOk ? 'rgba(255,255,255,0.8)' : 'rgba(255,60,60,1)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`${Math.round(angle)}°`, bx + 30, by - 5);
}
