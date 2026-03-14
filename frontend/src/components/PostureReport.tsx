/**
 * PostureReport — displays posture analysis results in the sidebar.
 *
 * Shows overall score, individual posture issues with severity indicators,
 * and actionable recommendations.
 */

import type { PostureReport as PostureReportData } from '../cv/postureScanner';

interface PostureReportProps {
  report: PostureReportData | null;
  scanning: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  ok: '#00ff80',
  mild: '#ffcc00',
  moderate: '#ff8800',
  severe: '#ff3333',
};

const SEVERITY_LABEL: Record<string, string> = {
  ok: '正常',
  mild: '轻微',
  moderate: '中度',
  severe: '需关注',
};

export function PostureReport({ report, scanning }: PostureReportProps) {
  if (scanning && !report) {
    return (
      <div style={{
        background: 'var(--color-panel)', borderRadius: 10,
        border: '1px solid var(--color-border)', padding: 20,
        textAlign: 'center',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid var(--color-brand)',
          borderTopColor: 'transparent', borderRadius: '50%',
          margin: '0 auto 12px',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: 14, color: 'var(--color-text)' }}>正在扫描体态...</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>
          请保持正面站立，双手自然下垂
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{
        background: 'var(--color-panel)', borderRadius: 10,
        border: '1px solid var(--color-border)', padding: 16,
        fontSize: 13, color: 'var(--color-text-dim)',
      }}>
        切换到「体态评估」模式，面对摄像头站立即可开始扫描。
      </div>
    );
  }

  const scoreColor = report.overallScore >= 80 ? '#00ff80'
    : report.overallScore >= 60 ? '#ffcc00' : '#ff4040';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Score */}
      <div style={{
        background: 'var(--color-panel)', borderRadius: 10,
        border: '1px solid var(--color-border)', padding: 16,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 48, fontWeight: 800, color: scoreColor,
          fontFamily: 'var(--font-mono)',
        }}>
          {report.overallScore}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>
          体态评分
        </div>
      </div>

      {/* Issues */}
      {report.issues.length === 0 ? (
        <div style={{
          background: 'rgba(0, 255, 128, 0.08)', borderRadius: 10,
          border: '1px solid rgba(0, 255, 128, 0.2)', padding: 14,
          fontSize: 13, color: '#00ff80', textAlign: 'center',
        }}>
          体态良好，未检测到明显问题
        </div>
      ) : (
        report.issues.map((issue, i) => (
          <div key={i} style={{
            background: 'var(--color-panel)', borderRadius: 10,
            borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity]}`,
            border: '1px solid var(--color-border)',
            padding: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                {issue.description}
              </span>
              <span style={{
                fontSize: 11, color: SEVERITY_COLOR[issue.severity],
                background: `${SEVERITY_COLOR[issue.severity]}15`,
                padding: '2px 8px', borderRadius: 4,
              }}>
                {SEVERITY_LABEL[issue.severity]}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Measurements */}
      <div style={{
        background: 'var(--color-panel)', borderRadius: 10,
        border: '1px solid var(--color-border)', padding: 12,
        fontSize: 12, color: 'var(--color-text-dim)',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <div>肩部倾斜: <b style={{ color: 'var(--color-text)' }}>{report.shoulderTiltDeg}°</b></div>
        <div>骨盆倾斜: <b style={{ color: 'var(--color-text)' }}>{report.pelvisTiltDeg}°</b></div>
        <div>头部前移: <b style={{ color: 'var(--color-text)' }}>{(report.headForwardRatio * 100).toFixed(0)}%</b></div>
        <div>脊柱偏移: <b style={{ color: 'var(--color-text)' }}>{(report.spineDeviationRatio * 100).toFixed(0)}%</b></div>
      </div>
    </div>
  );
}
