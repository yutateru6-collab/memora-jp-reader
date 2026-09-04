
import { SRSState } from "../types";

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export const initialSRSState: SRSState = {
  interval: 0,
  repetition: 0,
  efactor: 2.5,
  dueDate: Date.now(),
};

/**
 * Calculates the next SRS state based on the user's grade.
 * Algorithm based on a variation of SM-2 (SuperMemo-2).
 */
export const calculateSRS = (current: SRSState | undefined, grade: Grade): SRSState => {
  const state = current || { ...initialSRSState };
  let { interval, repetition, efactor } = state;

  // Mapping grade to quality (0-5)
  // again: 0 (complete blackout)
  // hard: 3 (difficult response)
  // good: 4 (correct response after hesitation)
  // easy: 5 (perfect response)
  let quality = 0;
  switch (grade) {
    case 'again': quality = 0; break;
    case 'hard': quality = 3; break;
    case 'good': quality = 4; break;
    case 'easy': quality = 5; break;
  }

  if (quality >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  } else {
    // Incorrect response
    repetition = 0;
    interval = 1;
  }

  // Calculate new E-Factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (efactor < 1.3) efactor = 1.3;

  // Calculate Due Date
  const now = new Date();
  const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).getTime();

  return {
    interval,
    repetition,
    efactor,
    dueDate,
  };
};

export const getNextReviewText = (grade: Grade, current?: SRSState): string => {
    const nextState = calculateSRS(current, grade);
    if (nextState.interval === 1) return '1日後';
    return `${nextState.interval}日後`;
}
