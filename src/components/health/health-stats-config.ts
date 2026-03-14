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

export type StatGroupSlug = "body-comp" | "strength" | "conditioning";

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
    title: "Strength",
    slug: "strength",
    description: "Key lift numbers and strength outputs.",
    stats: [
      { key: "squat", label: "Squat", unit: "lb" },
      { key: "bench", label: "Bench", unit: "lb" },
      { key: "deadlift", label: "Deadlift", unit: "lb" },
      { key: "press", label: "Press", unit: "lb" },
      { key: "clean_jerk", label: "Clean & Jerk", unit: "lb" },
      { key: "snatch", label: "Snatch", unit: "lb" },
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
  strength: STAT_GROUPS[1],
  conditioning: STAT_GROUPS[2],
};
