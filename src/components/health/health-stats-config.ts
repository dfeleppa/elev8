export type StatDefinition = {
  key: string;
  label: string;
  unit: string;
};

export type StatGroup = {
  title: string;
  slug: StatGroupSlug;
  description: string;
  stats: StatDefinition[];
};

export type StatGroupSlug =
  | "body-comp"
  | "strength"
  | "powerlifts"
  | "olympic-lifts"
  | "gymnastics"
  | "conditioning";

export const STAT_GROUPS: StatGroup[] = [
  {
    title: "Body Comp",
    slug: "body-comp",
    description: "Baseline composition markers and body measurements.",
    stats: [
      { key: "body_weight", label: "Body Weight", unit: "lb" },
      { key: "body_fat", label: "Body Fat %", unit: "%" },
      { key: "lean_body_mass", label: "Lean Body Mass", unit: "lb" },
    ],
  },
  {
    title: "Strength Totals",
    slug: "strength",
    description: "Key lift numbers and strength outputs.",
    stats: [
      { key: "powerlifting_total", label: "Powerlifting Total", unit: "lb" },
      { key: "crossfit_total", label: "CrossFit Total", unit: "lb" },
      { key: "olympic_total", label: "Olympic Total", unit: "lb" },
    ],
  },
  {
    title: "Powerlifts",
    slug: "powerlifts",
    description: "1 rep maxes for the major powerlifting movements.",
    stats: [
      { key: "back_squat", label: "Back Squat", unit: "lb" },
      { key: "front_squat", label: "Front Squat", unit: "lb" },
      { key: "overhead_squat", label: "Overhead Squat", unit: "lb" },
      { key: "bench_press", label: "Bench Press", unit: "lb" },
      { key: "deadlift", label: "Deadlift", unit: "lb" },
      { key: "strict_press", label: "Strict Press", unit: "lb" },
    ],
  },
  {
    title: "Olympic Lifts",
    slug: "olympic-lifts",
    description: "1 rep maxes for the Olympic lifting movements.",
    stats: [
      { key: "clean", label: "Clean", unit: "lb" },
      { key: "clean_jerk", label: "Clean & Jerk", unit: "lb" },
      { key: "snatch", label: "Snatch", unit: "lb" },
    ],
  },
  {
    title: "Gymnastics",
    slug: "gymnastics",
    description: "Weighted strength and max-effort bodyweight movements.",
    stats: [
      { key: "weighted_pullup", label: "Weighted Pullup", unit: "lb" },
      { key: "weighted_dip", label: "Weighted Dip", unit: "lb" },
      { key: "max_pullups", label: "Max Unbroken Pullups", unit: "reps" },
      { key: "max_toes_to_bar", label: "Max Unbroken Toes-to-Bar", unit: "reps" },
      { key: "max_dips", label: "Max Dips", unit: "reps" },
    ],
  },
  {
    title: "Conditioning",
    slug: "conditioning",
    description: "Work capacity markers and conditioning efforts.",
    stats: [
      { key: "running", label: "Running", unit: "min" },
      { key: "rowing", label: "Rowing", unit: "min" },
      { key: "biking", label: "Biking", unit: "min" },
      { key: "crossfit", label: "CrossFit", unit: "min" },
    ],
  },
];

export const STAT_GROUP_BY_SLUG: Record<StatGroupSlug, StatGroup> = {
  "body-comp": STAT_GROUPS[0],
  "strength": STAT_GROUPS[1],
  "powerlifts": STAT_GROUPS[2],
  "olympic-lifts": STAT_GROUPS[3],
  "gymnastics": STAT_GROUPS[4],
  "conditioning": STAT_GROUPS[5],
};
