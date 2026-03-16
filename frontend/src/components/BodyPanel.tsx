/**
 * BodyPanel — 6 floating frosted-glass cards anchored to body parts.
 *
 * Positions cards based on MediaPipe landmark coordinates,
 * offset to avoid overlapping the body silhouette.
 * Only visible in body_scan mode.
 */
import { useAppStore } from '../stores/appStore';
import { BodyCard } from './BodyCard';
import type { Landmark } from '../cv/types';
import { POSE } from '../cv/types';

const PART_CONFIG: {
  part: string;
  label: string;
  /** Landmark index to anchor to. */
  anchor: number;
  /** Offset from anchor in normalized coords. */
  offsetX: number;
  offsetY: number;
}[] = [
  { part: 'chest', label: 'Chest', anchor: POSE.LEFT_SHOULDER, offsetX: -0.18, offsetY: 0.05 },
  { part: 'shoulders', label: 'Shoulders', anchor: POSE.RIGHT_SHOULDER, offsetX: 0.18, offsetY: -0.04 },
  { part: 'back', label: 'Back', anchor: POSE.LEFT_SHOULDER, offsetX: -0.20, offsetY: 0.15 },
  { part: 'arms', label: 'Arms', anchor: POSE.LEFT_ELBOW, offsetX: -0.16, offsetY: 0 },
  { part: 'core', label: 'Core', anchor: POSE.LEFT_HIP, offsetX: -0.18, offsetY: 0 },
  { part: 'legs', label: 'Legs', anchor: POSE.LEFT_KNEE, offsetX: -0.16, offsetY: 0 },
];

const PART_NAMES_EXERCISE: Record<string, string> = {
  chest: 'Bench Press', shoulders: 'OHP', back: 'Row',
  legs: 'Squat', core: 'Plank', arms: 'Curl',
};

interface BodyPanelProps {
  landmarks: Landmark[] | null;
  canvasWidth: number;
  canvasHeight: number;
}

export function BodyPanel({ landmarks, canvasWidth, canvasHeight }: BodyPanelProps) {
  const mode = useAppStore((s) => s.mode);
  const bodyProfile = useAppStore((s) => s.bodyProfile);

  if ((mode !== 'body_scan' && mode !== 'dashboard') || !landmarks || canvasWidth === 0) return null;

  return (
    <>
      {/* CT-scan sweep line animation */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.3), rgba(0,210,255,0.6), rgba(0,210,255,0.3), transparent)',
          boxShadow: '0 0 20px rgba(0,210,255,0.3)',
          animation: 'scanSweep 3s ease-in-out 1',
        }} />
        <style>{`
          @keyframes scanSweep {
            0% { top: 0%; opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `}</style>
      </div>
      {PART_CONFIG.map(({ part, label, anchor, offsetX, offsetY }, idx) => {
        const lm = landmarks[anchor];
        if (!lm || (lm.visibility !== undefined && lm.visibility < 0.5)) return null;

        // Mirror x because video is flipped
        const x = (1 - lm.x + offsetX) * canvasWidth;
        const y = (lm.y + offsetY) * canvasHeight;

        const data = bodyProfile?.[part] ?? {};

        return (
          <BodyCard
            key={part}
            part={part}
            label={label}
            exercise={data.exercise ?? PART_NAMES_EXERCISE[part] ?? part}
            maxWeight={data.max_weight ?? 0}
            recoveryStatus={data.recovery_status ?? 'fresh'}
            lastTrained={data.last_trained ?? null}
            x={x}
            y={y}
            index={idx}
          />
        );
      })}
    </>
  );
}
