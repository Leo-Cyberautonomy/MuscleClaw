/**
 * BodyCard — frosted-glass card floating over camera view.
 * Connected to body landmark anchor point.
 * Per acceptance criteria 1.4-1.6.
 */
interface BodyCardProps {
  part: string;
  label: string;
  exercise: string;
  maxWeight: number;
  recoveryStatus: 'recovered' | 'recovering' | 'fresh';
  lastTrained: string | null;
  x: number;
  y: number;
  /** Index for stagger animation delay */
  index?: number;
}

const RECOVERY_COLOR: Record<string, string> = {
  recovered: '#34C759',
  recovering: '#FF9500',
  fresh: '#5AC8FA',
};

const RECOVERY_LABEL: Record<string, string> = {
  recovered: 'Ready',
  recovering: 'Recovering',
  fresh: 'Fresh',
};

export function BodyCard({ label, exercise, maxWeight, recoveryStatus, x, y, index = 0 }: BodyCardProps) {
  const color = RECOVERY_COLOR[recoveryStatus] ?? '#888';

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
      background: 'rgba(10, 12, 20, 0.65)',
      backdropFilter: 'blur(16px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
      border: `1px solid rgba(255,255,255,0.1)`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 110,
      pointerEvents: 'none',
      animation: `fadeUp 0.4s ease-out ${index * 0.1}s both`,
      boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 8px ${color}20`,
      transition: 'left 0.15s ease-out, top 0.15s ease-out',
    }}>
      {/* Part name */}
      <div style={{
        fontSize: 13, fontWeight: 700, color: '#fff',
        letterSpacing: '.03em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }} />
        {label}
      </div>

      {/* Exercise + weight */}
      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {exercise}
        {maxWeight > 0 && (
          <span style={{ color: '#fff', fontWeight: 700, marginLeft: 4 }}>
            {maxWeight}kg
          </span>
        )}
      </div>

      {/* Recovery status */}
      <div style={{
        fontSize: 10, color, marginTop: 4,
        fontWeight: 600, letterSpacing: '.04em',
      }}>
        {RECOVERY_LABEL[recoveryStatus] ?? recoveryStatus}
      </div>
    </div>
  );
}
