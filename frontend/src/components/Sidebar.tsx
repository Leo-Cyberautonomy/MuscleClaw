import { useAppStore } from '../stores/appStore';

const PART_NAMES: Record<string, string> = {
  chest: '胸', shoulders: '肩', back: '背', legs: '腿', core: '核心', arms: '手臂',
};

const DEFAULT_BODY_PROFILE: Record<string, any> = {
  chest: { exercise: '卧推', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  shoulders: { exercise: '过头推举', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  back: { exercise: '杠铃划船', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  legs: { exercise: '深蹲', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  core: { exercise: '平板支撑', max_weight: 0, recovery_status: 'recovered', last_trained: null },
  arms: { exercise: '弯举', max_weight: 0, recovery_status: 'recovered', last_trained: null },
};

export function Sidebar() {
  const { mode, bodyProfile, trainingPlan, training, transcript } = useAppStore();
  const profile = bodyProfile || DEFAULT_BODY_PROFILE;

  return (
    <div style={{
      width: 'var(--sidebar-width)', height: '100vh', flexShrink: 0,
      background: 'var(--color-sidebar)', backdropFilter: 'var(--blur-sidebar)',
      borderLeft: '1px solid var(--color-border)',
      padding: 20, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 16,
      animation: 'slideInRight 0.3s ease',
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
        {mode === 'body_scan' && '身体扫描'}
        {mode === 'planning' && '训练计划'}
        {mode === 'training' && '训练中'}
        {mode === 'posture' && '体态评估'}
        {mode === 'showcase' && '展示模式'}
        {mode === 'idle' && 'MuscleClaw'}
      </h2>

      {/* Idle: welcome + chat history */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--color-panel)', borderRadius: 10,
            border: '1px solid var(--color-border)', padding: 16,
          }}>
            <div style={{ fontSize: 14, color: 'var(--color-text-dim)', lineHeight: 1.6 }}>
              AI 健身教练就绪。用下方输入框或顶部按钮开始：
            </div>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.8 }}>
              <li><b style={{ color: 'var(--color-text)' }}>身体扫描</b> — 查看各部位恢复状态</li>
              <li><b style={{ color: 'var(--color-text)' }}>训练计划</b> — 生成今日训练方案</li>
              <li><b style={{ color: 'var(--color-text)' }}>开始训练</b> — 实时计数和动作纠正</li>
            </ul>
          </div>
          {/* Chat transcript */}
          {transcript.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)', fontWeight: 600 }}>对话记录</div>
              {transcript.slice(-8).map((t, i) => (
                <div key={i} style={{
                  background: t.role === 'model' ? 'rgba(0,255,240,0.06)' : 'var(--color-panel)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 13,
                  borderLeft: t.role === 'model' ? '2px solid var(--color-brand)' : '2px solid var(--color-border)',
                }}>
                  <span style={{ color: t.role === 'model' ? 'var(--color-brand)' : 'var(--color-text-dim)', fontSize: 11, fontWeight: 600 }}>
                    {t.role === 'model' ? 'AI' : '你'}
                  </span>
                  <div style={{ color: 'var(--color-text)', marginTop: 2, lineHeight: 1.5 }}>{t.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body scan */}
      {mode === 'body_scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(profile).map(([part, data]: [string, any]) => (
            <div key={part} style={{
              background: 'var(--color-panel)', borderRadius: 10,
              border: '1px solid var(--color-border)', padding: 12,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{PART_NAMES[part] || part}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                {data.exercise}{data.max_weight > 0 ? `: ${data.max_weight}kg` : ''}
              </div>
              <div style={{
                fontSize: 12, marginTop: 4,
                color: data.recovery_status === 'recovered' ? '#00ff80' : 'var(--color-warning)',
              }}>
                {data.recovery_status === 'recovered' ? '已恢复' : '恢复中'}
                {data.last_trained && ` · 上次: ${data.last_trained}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Planning */}
      {mode === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trainingPlan ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 4 }}>
                目标部位: {trainingPlan.target_parts?.map((p: string) => PART_NAMES[p] || p).join(', ')}
              </div>
              {trainingPlan.exercises?.map((ex: any, i: number) => (
                <div key={i} style={{
                  background: 'var(--color-panel)', borderRadius: 10,
                  border: '1px solid var(--color-border)', padding: 12,
                }}>
                  <div style={{ fontWeight: 600 }}>{ex.exercise_id}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                    {ex.target_sets}组 x {ex.target_reps}次 @ {ex.target_weight}kg
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{
              background: 'var(--color-panel)', borderRadius: 10,
              border: '1px solid var(--color-border)', padding: 16,
              fontSize: 13, color: 'var(--color-text-dim)',
            }}>
              在输入框中说"帮我制定训练计划"，AI 会根据你的身体状态生成方案。
            </div>
          )}
        </div>
      )}

      {/* Training */}
      {mode === 'training' && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 800, color: 'var(--color-brand)' }}>
            {training.reps}
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-dim)', marginTop: 4 }}>
            第 {training.setNumber || 1} 组
            {training.targetWeight > 0 && ` · 目标: ${training.targetWeight}kg x ${training.targetReps}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 12 }}>
            做动作时会自动计数。竖大拇指确认完成一组。
          </div>
        </div>
      )}
    </div>
  );
}
