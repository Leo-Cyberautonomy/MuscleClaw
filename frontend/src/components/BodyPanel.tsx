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
  { part: 'chest', label: '胸', anchor: POSE.LEFT_SHOULDER, offsetX: -0.18, offsetY: 0.05 },
  { part: 'shoulders', label: '肩', anchor: POSE.RIGHT_SHOULDER, offsetX: 0.18, offsetY: -0.04 },
  { part: 'back', label: '背', anchor: POSE.LEFT_SHOULDER, offsetX: -0.20, offsetY: 0.15 },
  { part: 'arms', label: '手臂', anchor: POSE.LEFT_ELBOW, offsetX: -0.16, offsetY: 0 },
  { part: 'core', label: '核心', anchor: POSE.LEFT_HIP, offsetX: -0.18, offsetY: 0 },
  { part: 'legs', label: '腿', anchor: POSE.LEFT_KNEE, offsetX: -0.16, offsetY: 0 },
];

const PART_NAMES_EXERCISE: Record<string, string> = {
  chest: '卧推', shoulders: '过头推举', back: '杠铃划船',
  legs: '深蹲', core: '平板支撑', arms: '弯举',
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
      {PART_CONFIG.map(({ part, label, anchor, offsetX, offsetY }) => {
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
          />
        );
      })}
    </>
  );
}
