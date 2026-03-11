export const WORKOUT_BLOCK_TYPES = ["warmup", "lift", "workout", "cooldown"] as const;
export const WORKOUT_SCORE_TYPES = ["time", "reps", "rounds_reps", "distance", "calories", "none"] as const;

export type WorkoutBlockType = (typeof WORKOUT_BLOCK_TYPES)[number];
export type WorkoutScoreType = (typeof WORKOUT_SCORE_TYPES)[number];

export type LiftSetInput = {
  reps: number;
  weight: number;
};

export function isWorkoutBlockType(value: unknown): value is WorkoutBlockType {
  return typeof value === "string" && (WORKOUT_BLOCK_TYPES as readonly string[]).includes(value);
}

export function isWorkoutScoreType(value: unknown): value is WorkoutScoreType {
  return typeof value === "string" && (WORKOUT_SCORE_TYPES as readonly string[]).includes(value);
}

export function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDurationToSeconds(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

export function estimateOneRepMax(weight: number, reps: number) {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return null;
  }
  return weight * (1 + reps / 30);
}

export function getBestEstimatedOneRepMax(sets: LiftSetInput[]) {
  return sets.reduce<number | null>((current, set) => {
    const estimated = estimateOneRepMax(set.weight, set.reps);
    if (!estimated) {
      return current;
    }
    if (!current || estimated > current) {
      return estimated;
    }
    return current;
  }, null);
}

export function calculatePrescriptionWeight(oneRepMax: number, percent: number) {
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0 || !Number.isFinite(percent) || percent <= 0) {
    return null;
  }

  const raw = oneRepMax * percent;
  // Round to nearest 5 for practical gym loading.
  return Math.round(raw / 5) * 5;
}
