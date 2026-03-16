import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTrainingStore } from '../stores/trainingStore';
import { usePoseStore } from '../stores/poseStore';
import { PostureReport } from './PostureReport';
import { TrainingPlanCard } from './TrainingPlanCard';
import { adkClient } from '../ws/adkClient';

/* ── Constants ─────────────────────────────────────────────── */

const PART_NAMES: Record<string, string> = {
  chest: '胸', shoulders: '肩', back: '背', legs: '腿', core: '核心', arms: '手臂',
};

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#FF2D55', back: '#007AFF', shoulders: '#FF9500',
  legs: '#30D158', core: '#FFD60A', arms: '#AF52DE',
};

const EXERCISE_NAMES: Record<string, string> = {
  bench_press: '卧推', squat: '深蹲', deadlift: '硬拉',
  ohp: '推举', barbell_row: '划船', barbell_curl: '弯举', plank: '平板支撑',
};

const MODE_TITLE: Record<string, string> = {
  idle: 'MuscleClaw',
  dashboard: 'Dashboard',
  body_scan: 'Dashboard',
  planning: "Today's Plan",
  training: 'Training',
  posture: 'Posture',
  showcase: 'Showcase',
};

const MODE_SUB: Record<string, string> = {
  idle: 'AI fitness coach ready',
  dashboard: 'Recovery analysis · 6 muscle groups',
  body_scan: 'Recovery analysis · 6 muscle groups',
  planning: 'AI-generated workout protocol',
  training: 'Live tracking in progress',
  posture: 'Postural alignment analysis',
  showcase: 'Image enhancement mode',
};

const DEFAULT_BODY_PROFILE: Record<string, any> = {
  chest: { exercise: 'bench_press', max_weight: 0, recovery_status: 'recovered', last_trained: '', recovery_hours: 72 },
  shoulders: { exercise: 'ohp', max_weight: 0, recovery_status: 'recovered', last_trained: '', recovery_hours: 48 },
  back: { exercise: 'barbell_row', max_weight: 0, recovery_status: 'recovered', last_trained: '', recovery_hours: 72 },
  legs: { exercise: 'squat', max_weight: 0, recovery_status: 'recovered', last_trained: '', recovery_hours: 96 },
  core: { exercise: 'plank', max_weight: 0, recovery_status: 'recovered', last_trained: '', recovery_hours: 24 },
  arms: { exercise: 'barbell_curl', max_weight: 0, recovery_status: 'recovered', last_trained: '', recovery_hours: 48 },
};

/* ── Activity Ring SVG ─────────────────────────────────────── */

function ActivityRing({ percent, size = 48 }: { percent: number; size?: number }) {
  const r = size * 0.43;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  const color = percent >= 90 ? '#34c759' : percent >= 50 ? '#ff9500' : '#ff3b30';

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f2f2f7" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 3px ${color})`, transition: 'stroke-dashoffset 0.8s cubic-bezier(.34,1.56,.64,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color,
      }}>
        {percent}%
      </div>
    </div>
  );
}

/* ── Recovery percentage calculation ───────────────────────── */

function getRecoveryPercent(data: any): number {
  if (data.recovery_status === 'recovered') return 100;
  if (!data.last_trained) return 100;
  const hoursElapsed = (Date.now() - new Date(data.last_trained).getTime()) / 3600000;
  const pct = Math.min(100, Math.round((hoursElapsed / (data.recovery_hours || 72)) * 100));
  return pct;
}

function getLastTrainedLabel(dateStr: string): string {
  if (!dateStr) return '未记录';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  return `${days}天前`;
}

/* ── Main Component ────────────────────────────────────────── */

export function Sidebar() {
  const mode = useAppStore((s) => s.mode);
  const connected = useAppStore((s) => s.connected);
  const bodyProfile = useAppStore((s) => s.bodyProfile);
  const transcript = useAppStore((s) => s.transcript);
  const trainingPlan = useTrainingStore((s) => s.trainingPlan);
  const training = useTrainingStore();
  const postureReport = usePoseStore((s) => s.postureReport);
  const postureScanning = usePoseStore((s) => s.postureScanning);

  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const profile = bodyProfile || DEFAULT_BODY_PROFILE;

  // Find recommended parts (recovered)
  const readyParts = Object.entries(profile)
    .filter(([, d]: [string, any]) => getRecoveryPercent(d) >= 90)
    .map(([k]) => k);

  const isDashboard = mode === 'dashboard' || mode === 'body_scan';

  // Data-driven auto-navigation: when new plan arrives, switch to planning
  useEffect(() => {
    if (trainingPlan && (mode === 'idle' || mode === 'dashboard' || mode === 'body_scan')) {
      useAppStore.getState().setMode('planning');
    }
  }, [trainingPlan]);

  // When new posture report arrives, switch to posture
  useEffect(() => {
    if (postureReport && (mode === 'idle' || mode === 'dashboard' || mode === 'body_scan')) {
      useAppStore.getState().setMode('posture');
    }
  }, [postureReport]);

  return (
    <div className="sidebar-scroll" style={{
      width: 'var(--sidebar-width)', height: '100vh', flexShrink: 0,
      background: 'var(--bg-sidebar)',
      backdropFilter: 'blur(40px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
      borderLeft: '1px solid var(--border-light)',
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.3s var(--ease-out)',
    }}>
      {/* ── Sticky Header ────────────────────────────────── */}
      <div style={{
        padding: '20px 20px 16px',
        background: 'rgba(242,242,247,.98)',
        position: 'sticky', top: 0, zIndex: 10,
        borderBottom: '1px solid rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
            {MODE_TITLE[mode] || mode}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: connected ? '#34c759' : '#ff3b30',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: connected ? '#34c759' : '#ff3b30',
              boxShadow: connected ? '0 0 6px rgba(52,199,89,.4)' : '0 0 6px rgba(255,59,48,.4)',
            }} />
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 500 }}>
          {MODE_SUB[mode] || ''}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ═══ IDLE ═══ */}
        {mode === 'idle' && (
          <>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-card)', padding: 18,
              animation: 'scaleIn 0.5s var(--spring) both',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Welcome back
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                MuscleClaw AI 健身教练就绪。用下方输入框或语音开始对话。
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Dashboard', desc: '查看各部位恢复状态' },
                  { label: 'Training Plan', desc: '生成今日训练方案' },
                  { label: 'Start Training', desc: '实时计数和动作纠正' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-mini)',
                    background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', transition: 'background .2s',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-purple)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {transcript.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 4px 8px' }}>
                  Recent
                </div>
                {transcript.slice(-6).map((t, i) => (
                  <div key={i} className="stagger" style={{
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-mini)',
                    padding: '10px 14px', marginBottom: 6,
                    boxShadow: '0 1px 2px rgba(0,0,0,.03)',
                    borderLeft: t.role === 'model' ? '3px solid var(--brand-purple)' : '3px solid #e5e5ea',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.role === 'model' ? 'var(--brand-purple)' : 'var(--text-tertiary)', marginBottom: 3 }}>
                      {t.role === 'model' ? 'AI' : 'You'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{t.text}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ DASHBOARD ═══ */}
        {isDashboard && (
          <>
            {/* AI Hero */}
            <div style={{
              background: 'var(--brand-gradient)', borderRadius: 'var(--radius-hero)',
              padding: '18px 20px', color: '#fff',
              boxShadow: 'var(--shadow-hero)',
              animation: 'scaleIn 0.5s var(--spring) both',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', opacity: .75, textTransform: 'uppercase' }}>
                AI Recommendation
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6, letterSpacing: '-.01em' }}>
                推荐今日: {readyParts.slice(0, 2).map(p => PART_NAMES[p]).join(' + ') || '休息日'}
              </div>
              <div style={{ fontSize: 13, marginTop: 5, opacity: .8, lineHeight: 1.45, fontWeight: 500 }}>
                {readyParts.length >= 2
                  ? `${PART_NAMES[readyParts[0]]}超量恢复完成，${PART_NAMES[readyParts[1]]}已就绪`
                  : readyParts.length === 1
                    ? `${PART_NAMES[readyParts[0]]}已恢复，可以开始训练`
                    : '所有部位正在恢复中，建议今天休息'}
              </div>
              {readyParts.length > 0 && (
                <div
                  onClick={() => adkClient.sendText(`帮我制定${readyParts.slice(0, 2).map(p => PART_NAMES[p]).join('和')}的训练计划`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginTop: 12, padding: '9px 18px',
                    background: 'rgba(255,255,255,.22)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,.3)',
                    borderRadius: 'var(--radius-mini)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    transition: 'all .25s var(--spring)',
                  }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  开始今日训练
                </div>
              )}
            </div>

            {/* Section: Muscle Groups */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 4px 0' }}>
              Muscle Groups
            </div>

            {Object.entries(profile).map(([part, data]: [string, any]) => {
              const pct = getRecoveryPercent(data);
              const isRecommended = readyParts.includes(part);
              const isExpanded = expandedPart === part;
              const exerciseName = EXERCISE_NAMES[data.exercise] || data.exercise;

              return (
                <div key={part} className="stagger" style={{
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
                  boxShadow: isRecommended
                    ? '0 2px 8px rgba(94,92,230,.1), 0 4px 16px rgba(94,92,230,.06)'
                    : 'var(--shadow-card)',
                  border: isRecommended ? '1px solid rgba(94,92,230,.12)' : '1px solid transparent',
                  overflow: 'hidden', cursor: 'pointer',
                  transition: 'all .3s var(--spring)',
                }}
                  onClick={() => setExpandedPart(isExpanded ? null : part)}
                >
                  {/* Main row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 14 }}>
                    <ActivityRing percent={pct} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: MUSCLE_COLOR[part],
                          boxShadow: `0 0 6px ${MUSCLE_COLOR[part]}60`,
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{PART_NAMES[part]}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{exerciseName}</span>
                        {' · '}{getLastTrainedLabel(data.last_trained)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
                        {data.max_weight > 0 ? data.max_weight : '—'}
                        {data.max_weight > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>kg</span>}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 'var(--radius-badge)', marginTop: 4,
                        ...(pct >= 90
                          ? { color: '#34c759', background: 'rgba(52,199,89,.1)' }
                          : { color: '#ff9500', background: 'rgba(255,149,0,.1)' }),
                      }}>
                        {pct >= 90 ? 'READY' : `${Math.max(1, Math.round((data.recovery_hours || 72) * (1 - pct / 100)))}h left`}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      padding: '0 16px 16px', borderTop: '1px solid var(--border-separator)',
                      animation: 'fadeUp 0.3s var(--spring) both',
                    }}>
                      {/* PR Records */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                          Personal Records
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', padding: '7px 0',
                          borderBottom: '1px solid #f8f8f8',
                        }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', width: 65, fontWeight: 500 }}>{exerciseName}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, flex: 1 }}>
                            {data.max_weight > 0 ? `${data.max_weight}kg` : '—'}
                          </span>
                          {data.max_weight > 0 && (
                            <span style={{
                              background: 'linear-gradient(135deg, #FFD60A, #FF9F0A)',
                              color: '#fff', fontSize: 9, fontWeight: 800,
                              padding: '2px 6px', borderRadius: 4, letterSpacing: '.03em',
                            }}>PR</span>
                          )}
                        </div>
                      </div>

                      {/* Form Quality */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                          Form Quality
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {[
                            { label: 'ROM Avg', value: '—', trend: '' },
                            { label: 'Symmetry', value: '—', trend: '' },
                          ].map(({ label, value, trend }) => (
                            <div key={label} style={{
                              textAlign: 'center', padding: '12px 8px',
                              background: 'var(--bg-subtle)', borderRadius: 'var(--radius-mini)',
                            }}>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                                {label}
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, marginTop: 3 }}>
                                {value}
                              </div>
                              {trend && (
                                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: '#34c759' }}>{trend}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Overview Calendar */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 4px 0' }}>
              Overview
            </div>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
              padding: 16, boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Training Calendar
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {Array.from({ length: 30 }, (_, i) => {
                  const v = [2,1,0,3,2,0,0,1,2,0,3,1,0,0,2,1,3,0,0,1,2,0,0,3,1,2,0,0,1,3][i];
                  const bg = v === 0 ? '#f2f2f7'
                    : v === 1 ? 'rgba(94,92,230,.12)'
                    : v === 2 ? 'rgba(94,92,230,.28)'
                    : 'rgba(191,90,242,.45)';
                  return (
                    <div key={i} style={{
                      width: 15, height: 15, borderRadius: 4, background: bg,
                      transition: 'transform .2s var(--spring)', cursor: 'default',
                      boxShadow: v === 3 ? '0 0 4px rgba(191,90,242,.2)' : 'none',
                    }} />
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                <span>本月 <b style={{ color: 'var(--text-primary)' }}>12 次</b></span>
                <span>连续 <b style={{ color: 'var(--text-primary)' }}>3 天</b></span>
                <span>最长 <b style={{ color: 'var(--text-primary)' }}>8 天</b></span>
              </div>
            </div>
          </>
        )}

        {/* ═══ PLANNING + TRAINING ═══ */}
        {(mode === 'planning' || mode === 'training') && (
          <>
            {trainingPlan ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 4px 0' }}>
                  {trainingPlan.target_parts?.map((p: string) => PART_NAMES[p] || p).join(' + ')}
                  {' · '}{trainingPlan.exercises?.length ?? 0} exercises
                </div>
                {trainingPlan.exercises?.map((ex: any, i: number) => (
                  <div key={i} className="stagger">
                    <TrainingPlanCard
                      exercise={ex} index={i}
                      activeIndex={training.activeExerciseIndex}
                      currentSet={training.setNumber}
                      setResults={training.exerciseResults[i] ?? []}
                    />
                  </div>
                ))}
                {mode === 'training' && Object.keys(training.exerciseResults).length > 0 && (
                  <div style={{
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
                    padding: 16, boxShadow: 'var(--shadow-card)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                  }}>
                    {[
                      { label: 'Sets', value: `${Object.values(training.exerciseResults).reduce((s, r) => s + r.length, 0)}/${trainingPlan.exercises?.reduce((s: number, e: any) => s + (e.target_sets ?? 4), 0) ?? 0}` },
                      { label: 'Volume', value: `${Object.values(training.exerciseResults).reduce((s, sets) => s + sets.reduce((ss, r) => ss + r.weight * r.reps, 0), 0).toLocaleString()}kg` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '10px 0', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-mini)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, marginTop: 2 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-card)', padding: 18,
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  {mode === 'planning'
                    ? '说 "帮我制定训练计划" 或点击下方按钮'
                    : '请先制定训练计划再开始训练'}
                </div>
                <button
                  onClick={() => adkClient.sendText('帮我制定训练计划')}
                  style={{
                    width: '100%', padding: 12, border: 'none',
                    borderRadius: 'var(--radius-mini)',
                    background: 'var(--brand-gradient)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    boxShadow: 'var(--shadow-brand)',
                    transition: 'all .25s var(--spring)',
                  }}
                >
                  生成训练计划
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══ POSTURE ═══ */}
        {mode === 'posture' && (
          <PostureReport report={postureReport} scanning={postureScanning} />
        )}
      </div>

      {/* ── Sticky CTA (Dashboard only) ──────────────────── */}
      {isDashboard && readyParts.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0,
          padding: '12px 16px 20px',
          background: 'linear-gradient(0deg, rgba(242,242,247,1) 60%, rgba(242,242,247,0) 100%)',
          zIndex: 20,
        }}>
          <button style={{
            width: '100%', padding: 15, border: 'none', borderRadius: 'var(--radius-button)',
            background: 'var(--brand-gradient)',
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', boxShadow: 'var(--shadow-brand)',
            transition: 'all .25s var(--spring)',
            letterSpacing: '-.01em', fontFamily: 'var(--font-sans)',
          }}>
            开始今日训练 — {readyParts.slice(0, 2).map(p => PART_NAMES[p]).join(' + ')}
          </button>
        </div>
      )}
    </div>
  );
}
