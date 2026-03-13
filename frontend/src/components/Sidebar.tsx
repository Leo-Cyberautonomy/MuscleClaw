import { useAppStore } from '../stores/appStore';

const PART_NAMES: Record<string, string> = {
  chest: '胸', shoulders: '肩', back: '背', legs: '腿', core: '核心', arms: '手臂',
};

export function Sidebar() {
  const { mode, bodyProfile, trainingPlan, training } = useAppStore();

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

      {mode === 'body_scan' && bodyProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(bodyProfile).map(([part, data]: [string, any]) => (
            <div key={part} style={{
              background: 'var(--color-panel)', borderRadius: 10,
              border: '1px solid var(--color-border)', padding: 12,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{PART_NAMES[part] || part}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                {data.exercise}: {data.max_weight}kg
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

      {mode === 'planning' && trainingPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                {ex.target_sets}组 × {ex.target_reps}次 @ {ex.target_weight}kg
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'training' && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 800, color: 'var(--color-brand)' }}>
            {training.reps}
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-dim)', marginTop: 4 }}>
            第 {training.setNumber} 组 · 目标: {training.targetWeight}kg × {training.targetReps}
          </div>
        </div>
      )}
    </div>
  );
}
