import { useState, useEffect, useRef } from 'react';
import { setAirTouchCallbacks, simulateClickAt } from '../cv/airTouch';

/**
 * AirCursor — renders a glowing cursor that follows the user's index finger.
 * Shows ripple animation on dwell-click.
 */
export function AirCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);
  const [clicking, setClicking] = useState(false);
  const rippleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAirTouchCallbacks(
      // On click
      (x, y) => {
        setClicking(true);
        simulateClickAt(x, y);
        setTimeout(() => setClicking(false), 400);
      },
      // On cursor move
      (x, y, isPointing) => {
        setPos({ x, y });
        setVisible(isPointing);
      },
    );
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      left: pos.x - 16,
      top: pos.y - 16,
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: clicking
        ? 'rgba(94,92,230,0.5)'
        : 'rgba(94,92,230,0.25)',
      border: '2px solid rgba(94,92,230,0.6)',
      boxShadow: clicking
        ? '0 0 24px rgba(94,92,230,0.6), 0 0 48px rgba(94,92,230,0.3)'
        : '0 0 12px rgba(94,92,230,0.3)',
      pointerEvents: 'none',
      zIndex: 9999,
      transition: clicking
        ? 'transform 0.15s ease-out, background 0.15s, box-shadow 0.15s'
        : 'left 0.05s linear, top 0.05s linear',
      transform: clicking ? 'scale(1.8)' : 'scale(1)',
      opacity: clicking ? 0 : 1,
    }}>
      {/* Inner dot */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 6, height: 6,
        borderRadius: '50%',
        background: 'rgba(94,92,230,0.8)',
      }} />

      {/* Ripple on click */}
      {clicking && (
        <div ref={rippleRef} style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 60, height: 60,
          borderRadius: '50%',
          border: '2px solid rgba(94,92,230,0.4)',
          animation: 'ripple 0.4s ease-out forwards',
        }} />
      )}
    </div>
  );
}
