/**
 * BodyCard — a single frosted-glass card showing body part data.
 * Designed to float over the camera view, connected to body anchors.
 */
interface BodyCardProps {
  part: string;
  label: string;
  exercise: string;
  maxWeight: number;
  recoveryStatus: 'recovered' | 'recovering' | 'fresh';
  lastTrained: string | null;
  /** Position in viewport pixels. */
  x: number;
  y: number;
}

const RECOVERY_COLOR: Record<string, string> = {
  recovered: '#00ff80',
  recovering: '#ffaa00',
  fresh: '#00ccff',
};

const RECOVERY_LABEL: Record<string, string> = {
  recovered: '已恢复',
  recovering: '恢复中',
  fresh: '就绪',
};

export function BodyCard({ label, exercise, maxWeight, recoveryStatus, lastTrained, x, y }: BodyCardProps) {
  const color = RECOVERY_COLOR[recoveryStatus] ?? '#888';

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
      background: 'rgba(10, 10, 20, 0.6)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${color}33`,
      borderRadius: 10,
      padding: '8px 14px',
      minWidth: 100,
      pointerEvents: 'none',
      animation: 'fadeIn 0.4s ease',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
        {exercise}
        {maxWeight > 0 && <span style={{ color: 'var(--color-text)', fontWeight: 600 }}> {maxWeight}kg</span>}
      </div>
      <div style={{ fontSize: 10, color, marginTop: 3, opacity: 0.8 }}>
        {RECOVERY_LABEL[recoveryStatus] ?? recoveryStatus}
        {lastTrained && ` · ${lastTrained}`}
      </div>
    </div>
  );
}
