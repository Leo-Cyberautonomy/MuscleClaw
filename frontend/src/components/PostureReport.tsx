/**
 * PostureReport — Apple Fitness+ style posture analysis
 */
import type { PostureReport as PostureReportData } from '../cv/postureScanner';

interface PostureReportProps {
  report: PostureReportData | null;
  scanning: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  ok: '#34c759', mild: '#ff9500', moderate: '#ff9500', severe: '#ff3b30',
};

const SEVERITY_LABEL: Record<string, string> = {
  ok: 'Normal', mild: 'Mild', moderate: 'Moderate', severe: 'Alert',
};

function ScoreGauge({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#34c759' : score >= 60 ? '#ff9500' : '#ff3b30';

  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#f2f2f7" strokeWidth={5} />
        <circle cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 65 65)"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 1s cubic-bezier(.34,1.56,.64,1)' }}
        />
        <text x="65" y="58" textAnchor="middle" dominantBaseline="central"
          fill="var(--text-primary)" fontFamily="var(--font-mono)" fontSize="36" fontWeight="800">
          {score}
        </text>
        <text x="65" y="82" textAnchor="middle"
          fill="var(--text-tertiary)" fontFamily="var(--font-sans)" fontSize="10" fontWeight="600"
          letterSpacing=".05em" style={{ textTransform: 'uppercase' }}>
          POSTURE SCORE
        </text>
      </svg>
    </div>
  );
}

export function PostureReport({ report, scanning }: PostureReportProps) {
  if (scanning && !report) {
    return (
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: 28, textAlign: 'center',
      }}>
        <div style={{ position: 'relative', width: 48, height: 48, margin: '0 auto 16px' }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: '3px solid transparent', borderTopColor: 'var(--brand-purple)',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 8,
            border: '2px solid transparent', borderBottomColor: 'var(--brand-violet)',
            borderRadius: '50%', animation: 'spin 1.5s linear infinite reverse',
          }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Analyzing...</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
          请保持正面站立，双手自然下垂
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: 18,
        fontSize: 13, color: 'var(--text-secondary)',
      }}>
        切换到体态评估模式，面对摄像头站立即可开始扫描
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Score gauge */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: 8,
        animation: 'scaleIn 0.5s var(--spring) both',
      }}>
        <ScoreGauge score={report.overallScore} />
      </div>

      {/* Issues */}
      {report.issues.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)', padding: 16, textAlign: 'center',
          fontSize: 13, fontWeight: 600, color: '#34c759',
        }}>
          All Clear — No Issues Detected
        </div>
      ) : (
        report.issues.map((issue, i) => (
          <div key={i} className="stagger" style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)', padding: '12px 16px',
            borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity]}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{issue.description}</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: SEVERITY_COLOR[issue.severity],
                background: `${SEVERITY_COLOR[issue.severity]}18`,
                padding: '3px 8px', borderRadius: 'var(--radius-badge)',
              }}>
                {SEVERITY_LABEL[issue.severity]}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'var(--border-separator)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${Math.min(100, issue.value * 5)}%`,
                background: SEVERITY_COLOR[issue.severity],
                transition: 'width .6s var(--spring)',
              }} />
            </div>
          </div>
        ))
      )}

      {/* Measurements */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)', padding: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          Measurements
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Shoulder', value: `${report.shoulderTiltDeg}°`, warn: Math.abs(report.shoulderTiltDeg) > 5 },
            { label: 'Pelvis', value: `${report.pelvisTiltDeg}°`, warn: Math.abs(report.pelvisTiltDeg) > 10 },
            { label: 'Head Fwd', value: `${(report.headForwardRatio * 100).toFixed(0)}%`, warn: report.headForwardRatio > 0.15 },
            { label: 'Spine', value: `${(report.spineDeviationRatio * 100).toFixed(0)}%`, warn: report.spineDeviationRatio > 0.05 },
          ].map(({ label, value, warn }) => (
            <div key={label} style={{
              textAlign: 'center', padding: '10px 0',
              background: 'var(--bg-subtle)', borderRadius: 'var(--radius-mini)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, marginTop: 3,
                color: warn ? '#ff9500' : 'var(--text-primary)',
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
