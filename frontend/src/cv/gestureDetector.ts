import type { CVEvent } from './types';

const THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_TIP = 12, RING_TIP = 16, PINKY_TIP = 20;
const THUMB_MCP = 2, INDEX_MCP = 5, MIDDLE_MCP = 9, RING_MCP = 13, PINKY_MCP = 17;

let lastGestureTime = 0;

export function detectGesture(handLandmarks: any[]): CVEvent | null {
  if (!handLandmarks || handLandmarks.length === 0) return null;

  const hand = handLandmarks[0];
  const now = performance.now();
  if (now - lastGestureTime < 1500) return null;

  // Thumbs up: thumb tip above thumb MCP, other fingers curled
  const thumbUp = hand[THUMB_TIP].y < hand[THUMB_MCP].y;
  const fingersCurled =
    hand[INDEX_TIP].y > hand[INDEX_MCP].y &&
    hand[MIDDLE_TIP].y > hand[MIDDLE_MCP].y &&
    hand[RING_TIP].y > hand[RING_MCP].y &&
    hand[PINKY_TIP].y > hand[PINKY_MCP].y;

  if (thumbUp && fingersCurled) {
    lastGestureTime = now;
    return { type: 'gesture', gesture: 'thumbs_up' };
  }

  // OK gesture: thumb tip close to index tip
  const thumbIndexDist = Math.sqrt(
    (hand[THUMB_TIP].x - hand[INDEX_TIP].x) ** 2 +
    (hand[THUMB_TIP].y - hand[INDEX_TIP].y) ** 2
  );
  if (thumbIndexDist < 0.05) {
    lastGestureTime = now;
    return { type: 'gesture', gesture: 'ok' };
  }

  return null;
}
