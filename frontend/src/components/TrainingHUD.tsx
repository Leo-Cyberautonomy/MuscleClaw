import { useTrainingStore } from '../stores/trainingStore';

export function TrainingHUD() {
  const exerciseId = useTrainingStore((s) => s.exerciseId);
  const reps = useTrainingStore((s) => s.reps);
  const setNumber = useTrainingStore((s) => s.setNumber);
  const restTimerSeconds = useTrainingStore((s) => s.restTimerSeconds);

  if (!exerciseId && restTimerSeconds <= 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 80, left: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {exerciseId && (
        <div style={{
          background: 'var(--color-panel)', backdropFilter: 'var(--blur-panel)',
          border: '1px solid var(--color-border)', borderRadius: 12,
          padding: '12px 20px',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 64, fontWeight: 800,
            color: 'var(--color-brand)', lineHeight: 1,
          }}>
            {reps}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 4 }}>
            REPS · Set {setNumber}
          </div>
        </div>
      )}
    </div>
  );
}
