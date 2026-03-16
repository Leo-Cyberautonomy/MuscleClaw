/**
 * BodyCard — Jarvis HUD style floating holographic card.
 * Iron Man aesthetic: corner brackets, scan lines, holographic glow,
 * grid pattern, data flicker, connecting line anchor point.
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
  index?: number;
}

const HUD_COLORS: Record<string, { primary: string; glow: string; accent: string; rgb: string }> = {
  recovered: { primary: '#00D2FF', glow: 'rgba(0,210,255,0.5)', accent: '#00FFFF', rgb: '0,210,255' },
  recovering: { primary: '#FF9500', glow: 'rgba(255,149,0,0.5)', accent: '#FFAA22', rgb: '255,149,0' },
  fresh: { primary: '#5AC8FA', glow: 'rgba(90,200,250,0.5)', accent: '#7FE0FF', rgb: '90,200,250' },
};

const RECOVERY_LABEL: Record<string, string> = {
  recovered: 'READY',
  recovering: 'RECOVERING',
  fresh: 'STANDBY',
};

export function BodyCard({ label, exercise, maxWeight, recoveryStatus, x, y, index = 0 }: BodyCardProps) {
  const c = HUD_COLORS[recoveryStatus] ?? HUD_COLORS.fresh;

  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-50%, -50%)',
      minWidth: 130, pointerEvents: 'none',
      transition: 'left 0.12s ease-out, top 0.12s ease-out',
      animation: `fadeUp 0.5s ease-out ${index * 0.12}s both`,
    }}>
      {/* ── Main HUD Card ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        // Grid pattern + frosted glass
        background: `
          repeating-linear-gradient(0deg, rgba(${c.rgb},0.015) 0px, rgba(${c.rgb},0.015) 1px, transparent 1px, transparent 3px),
          repeating-linear-gradient(90deg, rgba(${c.rgb},0.015) 0px, rgba(${c.rgb},0.015) 1px, transparent 1px, transparent 3px),
          rgba(8,10,18,0.72)
        `,
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: `1px solid rgba(${c.rgb},0.15)`,
        borderLeft: `3px solid ${c.primary}`,
        borderRadius: 6,
        padding: '10px 12px 8px',
        boxShadow: `
          0 0 20px rgba(${c.rgb},0.25),
          0 0 40px rgba(${c.rgb},0.08),
          0 4px 16px rgba(0,0,0,0.5),
          inset 0 1px 1px rgba(255,255,255,0.06),
          inset 3px 0 12px rgba(${c.rgb},0.06)
        `,
      }}>

        {/* Corner brackets — top-left */}
        <svg width="14" height="14" viewBox="0 0 14 14" style={{
          position: 'absolute', top: -1, left: -1, opacity: 0.6,
        }}>
          <path d="M7 0 L0 0 L0 7" fill="none" stroke={c.primary}
            strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Corner brackets — top-right */}
        <svg width="14" height="14" viewBox="0 0 14 14" style={{
          position: 'absolute', top: -1, right: -1, opacity: 0.6,
        }}>
          <path d="M7 0 L14 0 L14 7" fill="none" stroke={c.primary}
            strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Corner brackets — bottom-left */}
        <svg width="14" height="14" viewBox="0 0 14 14" style={{
          position: 'absolute', bottom: -1, left: -1, opacity: 0.4,
        }}>
          <path d="M0 7 L0 14 L7 14" fill="none" stroke={c.primary}
            strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Corner brackets — bottom-right */}
        <svg width="14" height="14" viewBox="0 0 14 14" style={{
          position: 'absolute', bottom: -1, right: -1, opacity: 0.4,
        }}>
          <path d="M14 7 L14 14 L7 14" fill="none" stroke={c.primary}
            strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* ── Part Name Row ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 700, color: '#fff',
          letterSpacing: '.06em', textTransform: 'uppercase',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {/* Animated status dot */}
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: c.primary, flexShrink: 0,
            boxShadow: `0 0 4px ${c.primary}, 0 0 10px ${c.glow}`,
            animation: 'hudPulse 2s ease-in-out infinite',
          }} />
          {label}
          {/* Status badge */}
          <span style={{
            marginLeft: 'auto', fontSize: 8, fontWeight: 600,
            color: c.primary, opacity: 0.7, letterSpacing: '.08em',
          }}>
            {RECOVERY_LABEL[recoveryStatus]}
          </span>
        </div>

        {/* ── Data Row ── */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 4,
          marginTop: 6, fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            {exercise}
          </span>
          {maxWeight > 0 && (
            <span style={{
              fontSize: 16, fontWeight: 800, color: c.accent,
              textShadow: `0 0 8px ${c.glow}`,
              letterSpacing: '-.02em',
              animation: 'dataFlicker 3s ease-in-out infinite',
            }}>
              {maxWeight}<span style={{ fontSize: 9, opacity: 0.6 }}>kg</span>
            </span>
          )}
        </div>

        {/* ── Scan Line ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
          overflow: 'hidden', borderRadius: 6,
        }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent, rgba(${c.rgb},0.4), transparent)`,
            boxShadow: `0 0 6px rgba(${c.rgb},0.3)`,
            animation: 'scanPass 4s ease-in-out infinite',
            animationDelay: `${index * 0.5}s`,
          }} />
        </div>

        {/* ── Interlace Lines ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
          background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px)',
          borderRadius: 6,
        }} />
      </div>

      {/* ── Keyframe Styles ── */}
      <style>{`
        @keyframes hudPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px ${c.primary}, 0 0 10px ${c.glow}; }
          50% { opacity: 0.5; box-shadow: 0 0 2px ${c.primary}, 0 0 6px ${c.glow}; }
        }
        @keyframes scanPass {
          0% { top: -2px; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: calc(100% + 2px); opacity: 0; }
        }
        @keyframes dataFlicker {
          0%, 100% { opacity: 1; }
          8% { opacity: 0.7; }
          16% { opacity: 0.95; }
          24% { opacity: 0.8; }
          32% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
