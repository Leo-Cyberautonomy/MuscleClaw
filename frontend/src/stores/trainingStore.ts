/**
 * TrainingStore — manages training session state.
 *
 * Tracks current exercise, set/rep progress, rest timer,
 * and training plan data during active training.
 */
import { create } from 'zustand';

interface TrainingState {
  exerciseId: string | null;
  setNumber: number;
  reps: number;
  targetReps: number;
  targetWeight: number;
  targetSets: number;
  restTimerSeconds: number;
  trainingPlan: any | null;

  updateTraining: (partial: Partial<Pick<TrainingState,
    'exerciseId' | 'setNumber' | 'reps' | 'targetReps' | 'targetWeight' | 'targetSets'
  >>) => void;
  setRestTimer: (seconds: number) => void;
  setTrainingPlan: (plan: any) => void;
  resetTraining: () => void;
}

export const useTrainingStore = create<TrainingState>((set) => ({
  exerciseId: null,
  setNumber: 0,
  reps: 0,
  targetReps: 0,
  targetWeight: 0,
  targetSets: 4,
  restTimerSeconds: 0,
  trainingPlan: null,

  updateTraining: (partial) => set((s) => ({ ...s, ...partial })),
  setRestTimer: (restTimerSeconds) => set({ restTimerSeconds }),
  setTrainingPlan: (trainingPlan) => set({ trainingPlan }),
  resetTraining: () => set({
    exerciseId: null, setNumber: 0, reps: 0,
    targetReps: 0, targetWeight: 0, targetSets: 4,
    restTimerSeconds: 0,
  }),
}));
