/**
 * TrainingPlanCard — Apple Fitness+ style exercise card
 */

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#FF2D55', back: '#007AFF', shoulders: '#FF9500',
  legs: '#30D158', arms: '#AF52DE', core: '#FFD60A',
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

  const primaryColor = MUSCLE_COLOR[exercise.primary_muscles[0]] ?? '#8e8e93';
  const allMuscles = [
    ...exercise.primary_muscles.map(m => MUSCLE_LABEL[m] ?? m),
    ...exercise.secondary_muscles.map(m => MUSCLE_LABEL[m] ?? m),
  ];

  const completedSets = setResults.length;
  const totalSets = exercise.target_sets;

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-card)',
      boxShadow: isActive
        ? '0 2px 8px rgba(94,92,230,.1), 0 4px 16px rgba(94,92,230,.06)'
        : 'var(--shadow-card)',
      border: isActive ? '1px solid rgba(94,92,230,.15)' : '1px solid transparent',
      overflow: 'hidden',
      opacity: isPending ? 0.6 : isCompleted ? 0.7 : 1,
      transition: 'all .3s var(--spring)',
      position: 'relative',
    }}>
      {/* Green left accent for completed */}
      {isCompleted && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: '#34c759', borderRadius: '16px 0 0 16px',
        }} />
      )}

      {/* Header */}
      <div style={{ padding: '13px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%',
          background: primaryColor,
          boxShadow: `0 0 6px ${primaryColor}60`,
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {exercise.name}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 6 }}>
              {exercise.name_en}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {allMuscles.join(' · ')}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '4px 16px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 5, borderRadius: 5,
          background: 'var(--border-separator)',
          display: 'flex', gap: 2, overflow: 'hidden',
        }}>
          {Array.from({ length: totalSets }).map((_, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 3,
              background: i < completedSets
                ? '#34c759'
                : (isActive && i === completedSets)
                  ? 'rgba(94,92,230,.4)'
                  : 'transparent',
              transition: 'background .4s var(--spring)',
              boxShadow: i < completedSets ? '0 0 4px rgba(52,199,89,.3)' : 'none',
            }} />
          ))}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: completedSets >= totalSets ? '#34c759' : 'var(--text-tertiary)',
        }}>
          {completedSets}/{totalSets}
        </span>
      </div>

      {/* Set rows */}
      <div style={{ padding: '4px 16px 12px' }}>
        {Array.from({ length: totalSets }).map((_, i) => {
          const setNum = i + 1;
          const result = setResults[i];
          const isDone = !!result;
          const isCurrent = isActive && setNum === currentSet;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px',
              background: isCurrent ? 'rgba(94,92,230,.06)' : 'transparent',
              borderRadius: 8,
              borderLeft: isCurrent ? '2px solid var(--brand-purple)' : '2px solid transparent',
              transition: 'all .3s',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--text-quaternary)', width: 16, textAlign: 'center',
              }}>
                {setNum}
              </span>
              <span style={{
                width: 16, height: 16, borderRadius: 5,
                border: isDone ? '1.5px solid #34c759' : '1.5px solid #e5e5ea',
                background: isDone ? 'rgba(52,199,89,.1)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#34c759', flexShrink: 0, fontWeight: 800,
              }}>
                {isDone && '✓'}
              </span>
              <span style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13,
                color: isDone ? 'var(--text-primary)' : 'var(--text-quaternary)',
                fontWeight: isDone ? 700 : 500,
              }}>
                {isDone
                  ? `${result.weight}kg × ${result.reps}`
                  : `${exercise.target_weight}kg × ${exercise.target_reps}`}
              </span>
              {isCurrent && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--brand-purple)',
                  background: 'rgba(94,92,230,.1)',
                  padding: '2px 6px', borderRadius: 4,
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
