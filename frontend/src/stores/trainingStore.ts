/**
 * TrainingStore — manages training session state.
 *
 * Tracks current exercise, set/rep progress, rest timer,
 * training plan data, and per-exercise set results.
 */
import { create } from 'zustand';

export interface SetResult {
  reps: number;
  weight: number;
}

interface TrainingState {
  exerciseId: string | null;
  /** Index of active exercise in the plan (0-based, -1 = not started) */
  activeExerciseIndex: number;
  setNumber: number;
  reps: number;
  targetReps: number;
  targetWeight: number;
  targetSets: number;
  restTimerSeconds: number;
  trainingPlan: any | null;
  /** Per-exercise set results, keyed by exercise index */
  exerciseResults: Record<number, SetResult[]>;

  updateTraining: (partial: Partial<Pick<TrainingState,
    'exerciseId' | 'setNumber' | 'reps' | 'targetReps' | 'targetWeight' | 'targetSets' | 'activeExerciseIndex'
  >>) => void;
  setRestTimer: (seconds: number) => void;
  setTrainingPlan: (plan: any) => void;
  /** Record a completed set for a given exercise index */
  recordSetResult: (exerciseIndex: number, result: SetResult) => void;
  resetTraining: () => void;
}

export const useTrainingStore = create<TrainingState>((set) => ({
  exerciseId: null,
  activeExerciseIndex: -1,
  setNumber: 0,
  reps: 0,
  targetReps: 0,
  targetWeight: 0,
  targetSets: 4,
  restTimerSeconds: 0,
  trainingPlan: null,
  exerciseResults: {},

  updateTraining: (partial) => set((s) => ({ ...s, ...partial })),
  setRestTimer: (restTimerSeconds) => set({ restTimerSeconds }),
  setTrainingPlan: (trainingPlan) => set({ trainingPlan, exerciseResults: {}, activeExerciseIndex: -1 }),
  recordSetResult: (exerciseIndex, result) => set((s) => {
    const prev = s.exerciseResults[exerciseIndex] ?? [];
    return {
      exerciseResults: { ...s.exerciseResults, [exerciseIndex]: [...prev, result] },
    };
  }),
  resetTraining: () => set({
    exerciseId: null, activeExerciseIndex: -1, setNumber: 0, reps: 0,
    targetReps: 0, targetWeight: 0, targetSets: 4,
    restTimerSeconds: 0, exerciseResults: {},
  }),
}));
