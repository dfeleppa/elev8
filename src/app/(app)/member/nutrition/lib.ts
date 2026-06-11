// Shared types, constants, and formatting helpers for the member nutrition
// page and its components.

export type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

export type NutritionEntry = {
  id: string;
  meal_type: MealKey;
  entry_name: string;
  quantity: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber?: number | null;
  sugar?: number | null;
  saturated_fat?: number | null;
  created_at: string;
};

export type FoodSearchResult = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar?: number | null;
  fiber?: number | null;
  saturatedFat?: number | null;
};

export type LibraryFood = {
  id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar?: number | null;
  fiber?: number | null;
  saturated_fat?: number | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  quantity?: number | null;
};

export type LabelScanResult = {
  name: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  saturatedFat: number | null;
  confidence: "low" | "medium" | "high";
  notes: string | null;
};

export type CoachPlanSummary = {
  goalType?: string | null;
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  effectiveDate?: string | null;
  lastCheckInDate?: string | null;
  nextCheckInDate?: string | null;
};

export const SERVING_UNIT_OPTIONS = [
  "gram",
  "ounce",
  "milliliter",
  "fluid ounce",
  "cup",
  "tablespoon",
  "teaspoon",
  "meal",
  "piece",
] as const;

export const DEFAULT_SERVING_UNIT: (typeof SERVING_UNIT_OPTIONS)[number] = "gram";

export function normalizeServingUnit(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    g: "gram",
    grams: "gram",
    oz: "ounce",
    ounces: "ounce",
    ml: "milliliter",
    milliliters: "milliliter",
    tbsp: "tablespoon",
    tablespoons: "tablespoon",
    tsp: "teaspoon",
    teaspoons: "teaspoon",
    servings: "meal",
    piece: "piece",
    pieces: "piece",
  };
  const candidate = aliases[normalized] ?? normalized;
  return SERVING_UNIT_OPTIONS.includes(candidate as (typeof SERVING_UNIT_OPTIONS)[number])
    ? candidate
    : DEFAULT_SERVING_UNIT;
}

export const meals: { key: MealKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

export const FOOD_LIBRARY_TTL_MS = 2 * 60_000;

export function toLocalDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toEntryQuantity(value: number | null | undefined) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.max(0.01, Math.round(parsed * 100) / 100);
}

export function roundToWhole(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

// Macro grams support tenths (e.g. 3.5g of fat) and trim trailing zeros
// so whole numbers still render cleanly (30, not 30.0).
export function formatGrams(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  const tenths = Math.round(value * 10) / 10;
  return Number.isInteger(tenths) ? tenths.toString() : tenths.toFixed(1);
}

export function formatServing(size: number | null | undefined, unit: string | null | undefined) {
  const safeSize =
    typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 1;
  const safeUnit = (unit ?? "").trim() || "serving";
  const sizeStr = formatGrams(safeSize);
  const unitStr = safeSize === 1 ? safeUnit : `${safeUnit}s`;
  return `${sizeStr} ${unitStr}`;
}

const SERVING_UNIT_ABBREV: Record<string, string> = {
  gram: "g",
  grams: "g",
  ounce: "oz",
  ounces: "oz",
  milliliter: "ml",
  milliliters: "ml",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
};

export function formatTotalAmount(
  servings: number,
  size: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return null;
  if (!Number.isFinite(servings) || servings <= 0) return null;
  const total = servings * size;
  const safeUnit = (unit ?? "").trim().toLowerCase();
  const abbrev = SERVING_UNIT_ABBREV[safeUnit];
  if (abbrev) {
    return `${formatGrams(total)}${abbrev}`;
  }
  const u = safeUnit || "serving";
  return `${formatGrams(total)} ${total === 1 ? u : `${u}s`}`;
}

export function formatServingSize(value: number) {
  return value.toFixed(2);
}

export function toDraftNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatGrams(value) : "";
}

export function shiftDate(date: string, deltaDays: number) {
  const next = new Date(`${date}T00:00:00`);
  if (Number.isNaN(next.getTime())) {
    return date;
  }
  next.setDate(next.getDate() + deltaDays);
  return toLocalDateInputValue(next);
}

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export type TargetStatus = "good" | "over" | "neutral";

export const MACRO_TOLERANCE_GRAMS = 5;
export const CALORIE_TOLERANCE = 100;

export function statusFromDiff(consumed: number, target: number, tolerance: number): TargetStatus {
  if (!target) return "neutral";
  const diff = consumed - target;
  if (Math.abs(diff) <= tolerance) return "good";
  if (diff > tolerance) return "over";
  return "neutral";
}

export const STATUS_TEXT_COLOR: Record<TargetStatus, string | null> = {
  good: "var(--nutrition-status-good)",
  over: "var(--nutrition-status-over)",
  neutral: null,
};

export function ringDashArray(progress: number, radius: number) {
  const circumference = 2 * Math.PI * radius;
  const clamped = clampPercent(progress);
  return `${(clamped / 100) * circumference} ${circumference}`;
}

export function formatGoalLabel(goalType: string | null | undefined) {
  if (!goalType) {
    return "Plan Active";
  }

  if (goalType === "lose_weight") {
    return "Lose Weight";
  }
  if (goalType === "gain_weight") {
    return "Gain Weight";
  }
  if (goalType === "maintain_weight") {
    return "Maintain Weight";
  }
  if (goalType === "performance_reverse_diet") {
    return "Performance / Reverse Diet";
  }

  return goalType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function hasTargetWeightGoal(goalType: string | null | undefined) {
  return goalType === "lose_weight" || goalType === "gain_weight";
}
