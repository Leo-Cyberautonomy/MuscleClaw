/**
 * AirTouch — maps index finger pointing to screen cursor + dwell-click.
 *
 * Detection: index finger extended (tip above MCP), other fingers curled.
 * Cursor: smoothed via lerp (0.25 factor) to eliminate jitter.
 * Click: dwell at same position > 800ms triggers click event on nearest element.
 */

const INDEX_TIP = 8;
const INDEX_MCP = 5;
const MIDDLE_TIP = 12;
const MIDDLE_MCP = 9;
const RING_TIP = 16;
const RING_MCP = 13;
const PINKY_TIP = 20;
const PINKY_MCP = 17;

// Lerp factor for smoothing (0 = no move, 1 = instant)
const LERP = 0.25;
// Dwell time for click (ms)
const DWELL_MS = 800;
// Max distance (px) to consider "same position" for dwell
const DWELL_RADIUS = 30;

// State
let smoothX = -1;
let smoothY = -1;
let pointing = false;
let dwellStartTime = 0;
let dwellX = 0;
let dwellY = 0;
let lastClickTime = 0;

// Callback for click events
let onAirClick: ((x: number, y: number) => void) | null = null;
// Callback for cursor position updates
let onCursorMove: ((x: number, y: number, isPointing: boolean) => void) | null = null;

export function setAirTouchCallbacks(
  clickCb: (x: number, y: number) => void,
  moveCb: (x: number, y: number, isPointing: boolean) => void,
) {
  onAirClick = clickCb;
  onCursorMove = moveCb;
}

/**
 * Process hand landmarks each frame. Called from CameraView's hand detection loop.
 * @param handLandmarks - array of hand landmark arrays from MediaPipe
 * @param videoWidth - camera video width in px
 * @param videoHeight - camera video height in px
 * @param canvasRect - bounding rect of the camera canvas element
 */
export function processAirTouch(
  handLandmarks: any[] | null,
  _videoWidth: number,
  _videoHeight: number,
  canvasRect: DOMRect,
) {
  if (!handLandmarks || handLandmarks.length === 0) {
    if (pointing) {
      pointing = false;
      onCursorMove?.(smoothX, smoothY, false);
    }
    return;
  }

  const hand = handLandmarks[0];

  // Detect pointing: index extended, others curled
  const indexExtended = hand[INDEX_TIP].y < hand[INDEX_MCP].y;
  const middleCurled = hand[MIDDLE_TIP].y > hand[MIDDLE_MCP].y;
  const ringCurled = hand[RING_TIP].y > hand[RING_MCP].y;
  const pinkyCurled = hand[PINKY_TIP].y > hand[PINKY_MCP].y;

  const isPointing = indexExtended && middleCurled && ringCurled && pinkyCurled;

  if (!isPointing) {
    if (pointing) {
      pointing = false;
      dwellStartTime = 0;
      onCursorMove?.(smoothX, smoothY, false);
    }
    return;
  }

  // Map index fingertip (normalized 0-1) to screen coordinates
  // Mirror X because camera is mirrored
  const rawX = (1 - hand[INDEX_TIP].x) * canvasRect.width + canvasRect.left;
  const rawY = hand[INDEX_TIP].y * canvasRect.height + canvasRect.top;

  // Smooth with lerp
  if (smoothX < 0) {
    smoothX = rawX;
    smoothY = rawY;
  } else {
    smoothX += (rawX - smoothX) * LERP;
    smoothY += (rawY - smoothY) * LERP;
  }

  pointing = true;
  onCursorMove?.(smoothX, smoothY, true);

  // Dwell detection
  const now = performance.now();
  const dist = Math.sqrt((smoothX - dwellX) ** 2 + (smoothY - dwellY) ** 2);

  if (dist > DWELL_RADIUS) {
    // Moved too far — reset dwell
    dwellStartTime = now;
    dwellX = smoothX;
    dwellY = smoothY;
  } else if (dwellStartTime > 0 && now - dwellStartTime > DWELL_MS) {
    // Dwell complete — trigger click (with cooldown)
    if (now - lastClickTime > 1500) {
      lastClickTime = now;
      dwellStartTime = 0;
      onAirClick?.(smoothX, smoothY);
    }
  }
}

/**
 * Simulate a click at screen coordinates by finding the element and dispatching click.
 */
export function simulateClickAt(x: number, y: number) {
  const el = document.elementFromPoint(x, y);
  if (el && el instanceof HTMLElement) {
    el.click();
  }
}
