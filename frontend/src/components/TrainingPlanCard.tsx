/**
 * TrainingPlanCard — a single exercise card in the training plan.
 *
 * Three visual states:
 * - planned: neutral border, all sets unchecked
 * - active: glowing cyan border, current set highlighted
 * - completed: green left accent, reduced opacity
 */

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#ff4060',
  back: '#4488ff',
  shoulders: '#ff9020',
  legs: '#00cc88',
  arms: '#aa66ff',
  core: '#ffcc00',
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
  /** Current active exercise index (-1 = planning mode, not started) */
  activeIndex: number;
  /** Current set being performed (1-based) for the active exercise */
  currentSet: number;
  /** Actual reps completed per set for this exercise */
  setResults: { reps: number; weight: number }[];
}

export function TrainingPlanCard({
  exercise, index, activeIndex, currentSet, setResults,
}: TrainingPlanCardProps) {
  const isActive = index === activeIndex;
  const isCompleted = exercise.completed_sets >= exercise.target_sets;
  const isPending = index > activeIndex && activeIndex >= 0;

  const primaryColor = MUSCLE_COLOR[exercise.primary_muscles[0]] ?? '#888';
  const allMuscles = [
    ...exercise.primary_muscles.map(m => MUSCLE_LABEL[m] ?? m),
    ...exercise.secondary_muscles.map(m => MUSCLE_LABEL[m] ?? m),
  ];

  const completedSets = setResults.length;
  const totalSets = exercise.target_sets;

  return (
    <div style={{
      background: 'var(--color-panel)',
      backdropFilter: 'var(--blur-panel)',
      borderRadius: 12,
      border: isActive
        ? `1px solid rgba(0, 255, 240, 0.4)`
        : isCompleted
          ? `1px solid rgba(0, 255, 128, 0.3)`
          : `1px solid var(--color-border)`,
      boxShadow: isActive ? '0 0 20px rgba(0, 255, 240, 0.08)' : 'none',
      opacity: isCompleted ? 0.65 : isPending ? 0.8 : 1,
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      position: 'relative',
    }}>
      {/* Green left accent for completed */}
      {isCompleted && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: '#00ff80', borderRadius: '12px 0 0 12px',
        }} />
      )}

      {/* Header: exercise name + muscle groups */}
      <div style={{ padding: '12px 14px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: primaryColor,
            boxShadow: `0 0 6px ${primaryColor}`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            {exercise.name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
            {exercise.name_en}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 3, paddingLeft: 16 }}>
          {allMuscles.join(' · ')}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          {/* Segmented progress */}
          <div style={{ display: 'flex', height: '100%', gap: 1 }}>
            {Array.from({ length: totalSets }).map((_, i) => (
              <div key={i} style={{
                flex: 1,
                background: i < completedSets
                  ? '#00ff80'
                  : (isActive && i === completedSets)
                    ? 'rgba(0, 255, 240, 0.5)'
                    : 'transparent',
                borderRadius: 1,
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>
        <span style={{
          fontSize: 11, color: 'var(--color-text-dim)',
          fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'right',
        }}>
          {completedSets}/{totalSets}
        </span>
      </div>

      {/* Set rows */}
      <div style={{ padding: '8px 14px 12px' }}>
        {Array.from({ length: totalSets }).map((_, i) => {
          const setNum = i + 1;
          const result = setResults[i];
          const isDone = !!result;
          const isCurrent = isActive && setNum === currentSet;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 0',
              background: isCurrent ? 'rgba(0, 255, 240, 0.06)' : 'transparent',
              borderRadius: 4,
              marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4,
            }}>
              {/* Set number */}
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-dim)', width: 16, textAlign: 'center',
              }}>
                {setNum}
              </span>

              {/* Checkbox */}
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                border: isDone
                  ? '1.5px solid #00ff80'
                  : '1.5px solid rgba(255,255,255,0.15)',
                background: isDone ? 'rgba(0, 255, 128, 0.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#00ff80', flexShrink: 0,
              }}>
                {isDone && '✓'}
              </span>

              {/* Weight x Reps */}
              <span style={{
                flex: 1, fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: isDone ? 'var(--color-text)' : 'var(--color-text-dim)',
              }}>
                {isDone
                  ? `${result.weight}kg × ${result.reps}`
                  : `${exercise.target_weight}kg × ${exercise.target_reps}`
                }
              </span>

              {/* Current indicator */}
              {isCurrent && (
                <span style={{
                  fontSize: 9, color: 'rgba(0, 255, 240, 0.8)',
                  fontWeight: 600, letterSpacing: 1,
                }}>
                  NOW
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
