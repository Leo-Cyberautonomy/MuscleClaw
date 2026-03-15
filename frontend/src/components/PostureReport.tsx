/**
 * PostureReport — Jarvis HUD posture analysis with SVG arc gauge,
 * severity cards with deviation meters, and diagnostic readouts.
 */
import type { PostureReport as PostureReportData } from '../cv/postureScanner';

interface PostureReportProps {
  report: PostureReportData | null;
  scanning: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  ok: '#00ff80', mild: '#ffcc00', moderate: '#ff8800', severe: '#ff3333',
};

const SEVERITY_LABEL: Record<string, string> = {
  ok: 'NORMAL', mild: 'MILD', moderate: 'MODERATE', severe: 'ALERT',
};

function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 100;
  const offset = circumference * (1 - progress);
  const color = score >= 80 ? '#00ff80' : score >= 60 ? '#ffcc00' : '#ff4040';

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        {/* Background arc */}
        <circle cx="65" cy="65" r={radius} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {/* Score arc */}
        <circle cx="65" cy="65" r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 65 65)"
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
            transition: 'stroke-dashoffset 1s ease-out',
          }}
        />
        {/* Score number */}
        <text x="65" y="60" textAnchor="middle" dominantBaseline="central"
          fill={color} fontFamily="var(--font-mono)" fontSize="36" fontWeight="800"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
          {score}
        </text>
        <text x="65" y="82" textAnchor="middle"
          fill="rgba(255,255,255,0.4)" fontFamily="var(--font-mono)" fontSize="8"
          letterSpacing="0.15em">
          POSTURE SCORE
        </text>
      </svg>
    </div>
  );
}

export function PostureReport({ report, scanning }: PostureReportProps) {
  if (scanning && !report) {
    return (
      <div className="hud-card hud-scanline" style={{
        padding: 24, textAlign: 'center',
      }}>
        {/* Dual-arc spinner */}
        <div style={{ position: 'relative', width: 48, height: 48, margin: '0 auto 16px' }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid transparent',
            borderTopColor: 'rgba(0, 255, 240, 0.6)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 6,
            border: '2px solid transparent',
            borderBottomColor: 'rgba(0, 255, 240, 0.3)',
            borderRadius: '50%',
            animation: 'spin 1.5s linear infinite reverse',
          }} />
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'rgba(0, 255, 240, 0.6)', letterSpacing: '0.1em',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          ANALYZING...
        </div>
        <div style={{
          fontSize: 11, color: 'var(--color-text-dim)', marginTop: 6,
        }}>
          请保持正面站立，双手自然下垂
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="hud-card" style={{
        padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--color-text-dim)', letterSpacing: '0.03em',
      }}>
        <span style={{ color: 'rgba(0, 255, 240, 0.5)' }}>&gt;</span> SWITCH TO POSTURE MODE TO BEGIN SCAN
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Score gauge */}
      <div className="hud-card" style={{
        padding: 8, animation: 'fadeInScale 0.6s ease-out',
      }}>
        <ScoreGauge score={report.overallScore} />
      </div>

      {/* Issues */}
      {report.issues.length === 0 ? (
        <div className="hud-card" style={{
          padding: 14, textAlign: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: '#00ff80', letterSpacing: '0.08em',
          textShadow: '0 0 6px rgba(0,255,128,0.3)',
        }}>
          ALL CLEAR — NO ISSUES DETECTED
        </div>
      ) : (
        report.issues.map((issue, i) => (
          <div key={i} className="hud-card hud-stagger" style={{
            padding: '10px 12px',
            borderLeftColor: `${SEVERITY_COLOR[issue.severity]}40`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
              }}>
                {issue.description}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                color: SEVERITY_COLOR[issue.severity],
                background: `${SEVERITY_COLOR[issue.severity]}15`,
                padding: '2px 6px', borderRadius: 3,
              }}>
                {SEVERITY_LABEL[issue.severity]}
              </span>
            </div>
            {/* Deviation meter */}
            <div style={{
              height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${Math.min(100, issue.value * 5)}%`,
                background: SEVERITY_COLOR[issue.severity],
                transition: 'width 0.6s ease-out',
                boxShadow: `0 0 4px ${SEVERITY_COLOR[issue.severity]}60`,
              }} />
            </div>
          </div>
        ))
      )}

      {/* Measurements */}
      <div className="hud-card" style={{ padding: 12 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
          color: 'var(--color-text-dim)', marginBottom: 8,
        }}>
          MEASUREMENTS
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {[
            { label: 'SHOULDER', value: `${report.shoulderTiltDeg}°`, warn: Math.abs(report.shoulderTiltDeg) > 5 },
            { label: 'PELVIS', value: `${report.pelvisTiltDeg}°`, warn: Math.abs(report.pelvisTiltDeg) > 10 },
            { label: 'HEAD FWD', value: `${(report.headForwardRatio * 100).toFixed(0)}%`, warn: report.headForwardRatio > 0.15 },
            { label: 'SPINE', value: `${(report.spineDeviationRatio * 100).toFixed(0)}%`, warn: report.spineDeviationRatio > 0.05 },
          ].map(({ label, value, warn }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: 'var(--color-text-dim)', letterSpacing: '0.08em',
              }}>{label}</div>
              <div className="hud-readout" style={{
                fontSize: 16, fontWeight: 700, marginTop: 2,
                color: warn ? 'var(--color-warning)' : 'var(--color-text)',
                animation: warn ? 'pulse 2s ease-in-out infinite' : 'none',
              }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
