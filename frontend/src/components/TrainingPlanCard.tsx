/**
 * TrainingPlanCard — Jarvis HUD exercise card with corner brackets,
 * scan lines, energy progress bars, and three visual states.
 */

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#ff4060', back: '#4488ff', shoulders: '#ff9020',
  legs: '#00cc88', arms: '#aa66ff', core: '#ffcc00',
};

const MUSCLE_LABEL: Record<string, string> = {
  chest: '胸', back: '背', shoulders: '肩',
  legs: '腿', arms: '臂', core: '核心',
};

interface Exercise {
  exercise_id: string;
  name: string;
  name_en: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  target_sets: number;
  target_reps: number;
  target_weight: number;
  completed_sets: number;
}

interface TrainingPlanCardProps {
  exercise: Exercise;
  index: number;
  activeIndex: number;
  currentSet: number;
  setResults: { reps: number; weight: number }[];
}

export function TrainingPlanCard({
  exercise, index, activeIndex, currentSet, setResults,
}: TrainingPlanCardProps) {
  const isActive = index === activeIndex;
  const isCompleted = setResults.length >= exercise.target_sets;
  const isPending = activeIndex >= 0 && index > activeIndex;

  const primaryColor = MUSCLE_COLOR[exercise.primary_muscles[0]] ?? '#888';
  const allMuscles = [
    ...exercise.primary_muscles.map(m => MUSCLE_LABEL[m] ?? m),
    ...exercise.secondary_muscles.map(m => MUSCLE_LABEL[m] ?? m),
  ];

  const completedSets = setResults.length;
  const totalSets = exercise.target_sets;

  // Build className
  const classes = [
    'hud-card',
    isActive && 'hud-active hud-scanline',
    isCompleted && 'hud-completed',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{
      padding: 0,
      opacity: isPending ? 0.6 : undefined,
      overflow: 'hidden',
    }}>
      {/* Completed green accent */}
      {isCompleted && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
          background: '#00ff80', zIndex: 2,
        }} />
      )}

      {/* Header */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: primaryColor,
            boxShadow: `0 0 8px ${primaryColor}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
          }}>
            {exercise.name}
          </span>
          <span style={{
            fontSize: 10, color: 'rgba(0, 255, 240, 0.35)',
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {exercise.name_en}
          </span>
        </div>
        <div style={{
          fontSize: 9, color: 'var(--color-text-dim)', marginTop: 2, paddingLeft: 14,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
        }}>
          {allMuscles.join(' · ')}
        </div>
      </div>

      {/* Segmented progress bar */}
      <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          flex: 1, height: 5, borderRadius: 2,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', gap: 2, overflow: 'hidden',
        }}>
          {Array.from({ length: totalSets }).map((_, i) => {
            const filled = i < completedSets;
            const current = isActive && i === completedSets;
            return (
              <div key={i} className={filled ? 'hud-progress-glow' : ''} style={{
                flex: 1, borderRadius: 1,
                background: filled
                  ? '#00ff80'
                  : current
                    ? 'rgba(0, 255, 240, 0.4)'
                    : 'rgba(255,255,255,0.03)',
                transition: 'background 0.4s ease',
              }} />
            );
          })}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: completedSets >= totalSets ? '#00ff80' : 'var(--color-text-dim)',
          minWidth: 32, textAlign: 'right', letterSpacing: '0.05em',
        }}>
          {completedSets}/{totalSets}
        </span>
      </div>

      {/* Set rows */}
      <div style={{ padding: '6px 12px 10px' }}>
        {Array.from({ length: totalSets }).map((_, i) => {
          const setNum = i + 1;
          const result = setResults[i];
          const isDone = !!result;
          const isCurrent = isActive && setNum === currentSet;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 4px',
              background: isCurrent ? 'rgba(0, 255, 240, 0.06)' : 'transparent',
              borderRadius: 3,
              borderLeft: isCurrent ? '2px solid rgba(0, 255, 240, 0.5)' : '2px solid transparent',
              transition: 'all 0.3s',
            }}>
              {/* Set number */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'rgba(255,255,255,0.3)', width: 14, textAlign: 'center',
              }}>
                {setNum}
              </span>

              {/* Checkbox */}
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: isDone ? '1px solid #00ff80' : '1px solid rgba(255,255,255,0.12)',
                background: isDone ? 'rgba(0, 255, 128, 0.12)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#00ff80', flexShrink: 0,
                transition: 'all 0.3s',
              }}>
                {isDone && '✓'}
              </span>

              {/* Weight x Reps */}
              <span style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11,
                color: isDone ? 'var(--color-text)' : 'rgba(255,255,255,0.25)',
                letterSpacing: '0.03em',
              }}>
                {isDone
                  ? `${result.weight}kg × ${result.reps}`
                  : `${exercise.target_weight}kg × ${exercise.target_reps}`
                }
              </span>

              {/* Status badge */}
              {isCurrent && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                  color: 'rgba(0, 255, 240, 0.8)', letterSpacing: '0.1em',
                  background: 'rgba(0, 255, 240, 0.1)',
                  padding: '1px 5px', borderRadius: 2,
                  animation: 'statusBlink 1.5s step-end infinite',
                }}>
                  NOW
                </span>
              )}
              {isPending && i === 0 && !isDone && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8,
                  color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em',
                }}>
                  STANDBY
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
