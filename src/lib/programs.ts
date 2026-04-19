// ============================================================
// Program Builder — shared types and utilities
// ============================================================

export type ProgramStatus = "draft" | "published" | "archived";
export type LiftProgressionType = "percentage" | "rpe" | "linear_weight";
export type ConditioningModality = "run" | "row" | "bike" | "ski" | "swim";
export type ConditioningProgressionType = "distance" | "time" | "intervals";

export const LIFT_PROGRESSION_TYPES: LiftProgressionType[] = ["percentage", "rpe", "linear_weight"];
export const CONDITIONING_MODALITIES: ConditioningModality[] = ["run", "row", "bike", "ski", "swim"];
export const CONDITIONING_PROGRESSION_TYPES: ConditioningProgressionType[] = ["distance", "time", "intervals"];

export function isLiftProgressionType(value: unknown): value is LiftProgressionType {
  return typeof value === "string" && (LIFT_PROGRESSION_TYPES as string[]).includes(value);
}

export function isConditioningModality(value: unknown): value is ConditioningModality {
  return typeof value === "string" && (CONDITIONING_MODALITIES as string[]).includes(value);
}

export function isConditioningProgressionType(value: unknown): value is ConditioningProgressionType {
  return typeof value === "string" && (CONDITIONING_PROGRESSION_TYPES as string[]).includes(value);
}

// ============================================================
// Domain types
// ============================================================

export type Program = {
  id: string;
  name: string;
  description: string | null;
  duration_weeks: number;
  days_per_week: number;
  status: ProgramStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramTemplateDay = {
  id: string;
  program_id: string;
  week_number: number;
  day_of_week: number;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramTemplateBlock = {
  id: string;
  template_day_id: string;
  program_id: string;
  block_order: number;
  block_type: "warmup" | "lift" | "workout" | "cooldown";
  title: string;
  description: string | null;
  score_type: "time" | "reps" | "rounds_reps" | "distance" | "calories" | "none";
  movement_id: string | null;
  tags: string[];
  leaderboard_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ProgramTemplateDayWithBlocks = ProgramTemplateDay & {
  program_template_blocks: ProgramTemplateBlock[];
};

export type LiftProgression = {
  id: string;
  block_id: string;
  program_id: string;
  week_number: number;
  progression_type: LiftProgressionType;
  sets: number;
  reps: string;
  percent_of_max: number | null;
  rpe_target: number | null;
  weight_increment: number | null;
  starting_weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ConditioningProgression = {
  id: string;
  block_id: string;
  program_id: string;
  week_number: number;
  modality: ConditioningModality;
  progression_type: ConditioningProgressionType;
  distance_meters: number | null;
  duration_seconds: number | null;
  interval_count: number | null;
  interval_distance_meters: number | null;
  interval_rest_seconds: number | null;
  target_pace_per_500m: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramAssignment = {
  id: string;
  program_id: string;
  assigned_member_id: string | null;
  assigned_track_id: string | null;
  start_date: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Utilities
// ============================================================

/**
 * Given a program assignment's start_date and the program's duration_weeks,
 * returns the current week number (1-based, capped at duration_weeks).
 */
export function calculateCurrentWeek(startDate: string, durationWeeks: number): number {
  const start = new Date(startDate);
  const today = new Date();
  // Zero out time to compare dates only
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(week, durationWeeks));
}

/**
 * Format a duration in seconds as MM:SS or H:MM:SS.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Format meters into a human-readable distance (m or km).
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)}km`;
  }
  return `${meters}m`;
}
