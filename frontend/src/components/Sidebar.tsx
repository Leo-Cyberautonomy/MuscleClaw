import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useTrainingStore } from '../stores/trainingStore';
import { usePoseStore } from '../stores/poseStore';
import { PostureReport } from './PostureReport';
import { TrainingPlanCard } from './TrainingPlanCard';

const PART_NAMES: Record<string, string> = {
  chest: '胸', shoulders: '肩', back: '背', legs: '腿', core: '核心', arms: '手臂',
};

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#ff4060', back: '#4488ff', shoulders: '#ff9020',
  legs: '#00cc88', arms: '#aa66ff', core: '#ffcc00',
};

const MODE_SUBTITLE: Record<string, string> = {
  idle: 'systems ready. awaiting command.',
  body_scan: 'scanning body composition...',
  planning: 'generating training protocol...',
  training: 'tracking in progress',
  posture: 'analyzing postural alignment...',
  showcase: 'image enhancement mode',
};

const MODE_LABEL: Record<string, string> = {
  idle: 'STANDBY',
  body_scan: 'BODY SCAN',
  planning: 'MISSION BRIEF',
  training: 'COMBAT MODE',
  posture: 'POSTURE SCAN',
  showcase: 'SHOWCASE',
};

const DEFAULT_BODY_PROFILE: Record<string, any> = {
  chest: { exercise: '卧推', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  shoulders: { exercise: '推举', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  back: { exercise: '划船', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  legs: { exercise: '深蹲', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  core: { exercise: '平板支撑', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  arms: { exercise: '弯举', max_weight: 0, recovery_status: 'recovered', last_trained: null },
};

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toTimeString().slice(0, 8));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function Sidebar() {
  const mode = useAppStore((s) => s.mode);
  const connected = useAppStore((s) => s.connected);
  const bodyProfile = useAppStore((s) => s.bodyProfile);
  const transcript = useAppStore((s) => s.transcript);
  const trainingPlan = useTrainingStore((s) => s.trainingPlan);
  const training = useTrainingStore();
  const postureReport = usePoseStore((s) => s.postureReport);
  const postureScanning = usePoseStore((s) => s.postureScanning);
  const clock = useClock();

  const profile = bodyProfile || DEFAULT_BODY_PROFILE;

  return (
    <div
      className="hud-sidebar"
      style={{
        width: 'var(--sidebar-width)', height: '100vh', flexShrink: 0,
        background: 'var(--color-sidebar)',
        backdropFilter: 'var(--blur-sidebar)',
        borderLeft: '1px solid rgba(0, 255, 240, 0.08)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.3s ease, breathe 6s ease-in-out infinite',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,240,0.006) 2px, rgba(0,255,240,0.006) 4px)',
      }}
    >
      {/* ── HUD Status Bar ──────────────────────────────────── */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid rgba(0, 255, 240, 0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
        color: 'var(--color-text-dim)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? '#00ff80' : '#ff4040',
            boxShadow: connected ? '0 0 6px #00ff80' : '0 0 6px #ff4040',
            animation: 'statusBlink 2s step-end infinite',
          }} />
          <span style={{ color: connected ? '#00ff80' : '#ff4040' }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <span style={{ color: 'rgba(0, 255, 240, 0.4)' }}>{clock}</span>
      </div>

      {/* ── Mode Header ────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
          letterSpacing: '0.15em', color: 'var(--color-text)',
          textShadow: '0 0 12px rgba(0, 255, 240, 0.2)',
        }}>
          {MODE_LABEL[mode] || mode.toUpperCase()}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'rgba(0, 255, 240, 0.4)', marginTop: 4,
          letterSpacing: '0.05em',
        }}>
          {MODE_SUBTITLE[mode] || ''}
        </div>
      </div>

      {/* ── Mode Content ───────────────────────────────────── */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>

        {/* ═══ IDLE ═══ */}
        {mode === 'idle' && (
          <>
            {/* System status console */}
            <div className="hud-card hud-scanline" style={{ padding: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                color: 'var(--color-text-dim)', marginBottom: 10,
              }}>
                SYSTEM STATUS
              </div>
              {[
                { label: 'CAMERA', status: 'ONLINE', ok: true },
                { label: 'AI ENGINE', status: connected ? 'READY' : 'CONNECTING', ok: connected },
                { label: 'BODY DATA', status: bodyProfile ? 'LOADED' : 'EMPTY', ok: !!bodyProfile },
              ].map(({ label, status, ok }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 0',
                  color: 'var(--color-text-dim)',
                }}>
                  <span>{label}</span>
                  <span style={{
                    color: ok ? '#00ff80' : 'var(--color-warning)',
                    textShadow: ok ? '0 0 6px rgba(0,255,128,0.3)' : 'none',
                  }}>{status}</span>
                </div>
              ))}
            </div>

            {/* Commands */}
            <div className="hud-card" style={{ padding: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                color: 'var(--color-text-dim)', marginBottom: 8,
              }}>
                AVAILABLE COMMANDS
              </div>
              {[
                { cmd: 'BODY_SCAN', desc: '查看各部位恢复状态' },
                { cmd: 'TRAIN_PLAN', desc: '生成今日训练方案' },
                { cmd: 'START_TRAIN', desc: '实时计数和动作纠正' },
              ].map(({ cmd, desc }) => (
                <div key={cmd} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 0',
                  display: 'flex', gap: 8, alignItems: 'baseline',
                }}>
                  <span style={{ color: 'rgba(0, 255, 240, 0.6)' }}>&gt;</span>
                  <span style={{ color: 'var(--color-text)' }}>{cmd}</span>
                  <span style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>{desc}</span>
                </div>
              ))}
            </div>

            {/* Chat transcript */}
            {transcript.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                  color: 'var(--color-text-dim)',
                }}>
                  TRANSCRIPT LOG
                </div>
                {transcript.slice(-6).map((t, i) => (
                  <div key={i} className="hud-stagger" style={{
                    background: t.role === 'model' ? 'rgba(0,255,240,0.04)' : 'rgba(255,255,255,0.02)',
                    borderRadius: 6, padding: '6px 10px', fontSize: 12,
                    borderLeft: t.role === 'model'
                      ? '2px solid rgba(0, 255, 240, 0.4)'
                      : '2px solid rgba(255,255,255,0.1)',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      color: t.role === 'model' ? 'rgba(0, 255, 240, 0.5)' : 'var(--color-text-dim)',
                      letterSpacing: '0.08em', marginBottom: 2,
                    }}>
                      {t.role === 'model' ? 'AI' : 'USER'}
                    </div>
                    <div style={{ color: 'var(--color-text)', lineHeight: 1.4 }}>{t.text}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ BODY SCAN ═══ */}
        {mode === 'body_scan' && (
          <>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
              color: 'var(--color-text-dim)',
            }}>
              DIAGNOSTIC · {Object.keys(profile).length} SECTORS
            </div>
            {Object.entries(profile).map(([part, data]: [string, any]) => {
              const color = MUSCLE_COLOR[part] ?? '#888';
              const isRecovered = data.recovery_status === 'recovered';
              return (
                <div key={part} className="hud-card hud-stagger" style={{
                  padding: '10px 12px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: color,
                      boxShadow: `0 0 6px ${color}`,
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}>
                      {(PART_NAMES[part] || part).toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: 10, color: isRecovered ? '#00ff80' : 'var(--color-warning)',
                      fontFamily: 'var(--font-mono)',
                      textShadow: isRecovered ? '0 0 4px rgba(0,255,128,0.3)' : 'none',
                    }}>
                      {isRecovered ? 'READY' : 'RECOVERING'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, color: 'var(--color-text-dim)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    <span>{data.exercise}</span>
                    <span className="hud-readout" style={{
                      color: data.max_weight > 0 ? 'var(--color-text)' : 'var(--color-text-dim)',
                    }}>
                      {data.max_weight > 0 ? `${data.max_weight}kg` : '--'}
                    </span>
                  </div>
                  {/* Energy bar */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    background: 'rgba(255,255,255,0.04)',
                  }}>
                    <div className={isRecovered ? 'hud-progress-glow' : ''} style={{
                      height: '100%',
                      width: isRecovered ? '100%' : '40%',
                      background: isRecovered ? '#00ff80' : 'var(--color-warning)',
                      transition: 'width 0.8s ease-out',
                    }} />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ═══ PLANNING + TRAINING ═══ */}
        {(mode === 'planning' || mode === 'training') && (
          <>
            {trainingPlan ? (
              <>
                {/* Mission header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                  color: 'var(--color-text-dim)',
                }}>
                  <span>
                    {trainingPlan.target_parts?.map((p: string) => (PART_NAMES[p] || p).toUpperCase()).join(' + ')}
                  </span>
                  <span className="hud-readout" style={{ fontSize: 10 }}>
                    {trainingPlan.exercises?.length ?? 0} EX
                  </span>
                </div>

                {/* Exercise cards */}
                {trainingPlan.exercises?.map((ex: any, i: number) => (
                  <div key={i} className="hud-stagger">
                    <TrainingPlanCard
                      exercise={ex}
                      index={i}
                      activeIndex={training.activeExerciseIndex}
                      currentSet={training.setNumber}
                      setResults={training.exerciseResults[i] ?? []}
                    />
                  </div>
                ))}

                {/* Session Metrics */}
                {mode === 'training' && Object.keys(training.exerciseResults).length > 0 && (
                  <div className="hud-card" style={{ padding: 12 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                      color: 'var(--color-text-dim)', marginBottom: 8,
                    }}>
                      SESSION METRICS
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                    }}>
                      {[
                        {
                          label: 'SETS',
                          value: `${Object.values(training.exerciseResults).reduce((s, r) => s + r.length, 0)}/${trainingPlan.exercises?.reduce((s: number, e: any) => s + (e.target_sets ?? 4), 0) ?? 0}`,
                        },
                        {
                          label: 'VOLUME',
                          value: `${Object.values(training.exerciseResults).reduce((s, sets) => s + sets.reduce((ss, r) => ss + r.weight * r.reps, 0), 0).toLocaleString()}kg`,
                        },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 9,
                            color: 'var(--color-text-dim)', letterSpacing: '0.08em',
                          }}>{label}</div>
                          <div className="hud-readout" style={{
                            fontSize: 16, fontWeight: 700, color: 'var(--color-text)',
                            marginTop: 2,
                          }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="hud-card hud-scanline" style={{
                padding: 16, fontSize: 12, color: 'var(--color-text-dim)',
                fontFamily: 'var(--font-mono)',
              }}>
                {mode === 'planning'
                  ? '&gt; SAY "帮我制定训练计划" TO GENERATE PROTOCOL'
                  : '&gt; GENERATE TRAINING PLAN FIRST'
                }
              </div>
            )}
          </>
        )}

        {/* ═══ POSTURE ═══ */}
        {mode === 'posture' && (
          <PostureReport report={postureReport} scanning={postureScanning} />
        )}
      </div>
    </div>
  );
}
