"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Atom,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pencil,
  Plus,
  Salad,
  Sparkles,
  X,
} from "lucide-react";

import SidebarShell from "@/components/SidebarShell";
import { Panel } from "@/components/ui";

type NutritionEntry = {
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

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

type FoodSearchResult = {
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

type LibraryFood = {
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

type LabelScanResult = {
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

const SERVING_UNIT_OPTIONS = [
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

const DEFAULT_SERVING_UNIT: (typeof SERVING_UNIT_OPTIONS)[number] = "gram";

function normalizeServingUnit(value: string | null | undefined) {
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

type CoachPlanSummary = {
  goalType?: string | null;
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  effectiveDate?: string | null;
  lastCheckInDate?: string | null;
  nextCheckInDate?: string | null;
};

const meals: { key: MealKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const FOOD_LIBRARY_TTL_MS = 2 * 60_000;

function toLocalDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toEntryQuantity(value: number | null | undefined) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.max(0.01, Math.round(parsed * 100) / 100);
}

function roundToWhole(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

// Macro grams support tenths (e.g. 3.5g of fat) and trim trailing zeros
// so whole numbers still render cleanly (30, not 30.0).
function formatGrams(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  const tenths = Math.round(value * 10) / 10;
  return Number.isInteger(tenths) ? tenths.toString() : tenths.toFixed(1);
}

function formatServing(size: number | null | undefined, unit: string | null | undefined) {
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

function formatTotalAmount(
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

function formatServingSize(value: number) {
  return value.toFixed(2);
}

function toDraftNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatGrams(value) : "";
}

function shiftDate(date: string, deltaDays: number) {
  const next = new Date(`${date}T00:00:00`);
  if (Number.isNaN(next.getTime())) {
    return date;
  }
  next.setDate(next.getDate() + deltaDays);
  return toLocalDateInputValue(next);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

type TargetStatus = "good" | "over" | "neutral";

const MACRO_TOLERANCE_GRAMS = 5;
const CALORIE_TOLERANCE = 100;

function statusFromDiff(consumed: number, target: number, tolerance: number): TargetStatus {
  if (!target) return "neutral";
  const diff = consumed - target;
  if (Math.abs(diff) <= tolerance) return "good";
  if (diff > tolerance) return "over";
  return "neutral";
}

const STATUS_TEXT_COLOR: Record<TargetStatus, string | null> = {
  good: "#16a34a",
  over: "#dc2626",
  neutral: null,
};

function ringDashArray(progress: number, radius: number) {
  const circumference = 2 * Math.PI * radius;
  const clamped = clampPercent(progress);
  return `${(clamped / 100) * circumference} ${circumference}`;
}

function formatGoalLabel(goalType: string | null | undefined) {
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

function hasTargetWeightGoal(goalType: string | null | undefined) {
  return goalType === "lose_weight" || goalType === "gain_weight";
}

export default function HealthNutritionPage() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue(new Date()));
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchMeal: MealKey = "lunch";
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [coachPlanStatus, setCoachPlanStatus] = useState<"loading" | "has" | "none">("loading");
  const [coachPlanSummary, setCoachPlanSummary] = useState<CoachPlanSummary | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<MealKey | null>(null);
  const [copyDialogMeal, setCopyDialogMeal] = useState<MealKey | null>(null);
  const [mealMenuOpen, setMealMenuOpen] = useState<MealKey | null>(null);
  const [copyTargetDate, setCopyTargetDate] = useState(() => toLocalDateInputValue(new Date()));
  const [copyTargetMeal, setCopyTargetMeal] = useState<MealKey>("breakfast");
  const [foodDialogOpen, setFoodDialogOpen] = useState(false);
  const [activeMealDialog, setActiveMealDialog] = useState<MealKey | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editServingDraft, setEditServingDraft] = useState("");
  const [dialogTab, setDialogTab] = useState<"recent" | "mine" | "scan" | "create" | "usda">("recent");
  const [dialogSearch, setDialogSearch] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [addingFoodKey, setAddingFoodKey] = useState<string | null>(null);
  const [addedFlashKey, setAddedFlashKey] = useState<string | null>(null);
  const [recentFoods, setRecentFoods] = useState<LibraryFood[]>([]);
  const [myFoods, setMyFoods] = useState<LibraryFood[]>([]);
  const recentFoodsFetchedAtRef = useRef(0);
  const myFoodsFetchedAtRef = useRef(0);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [createFoodDraft, setCreateFoodDraft] = useState({
    name: "",
    servingSize: "1",
    servingUnit: DEFAULT_SERVING_UNIT as string,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    sugar: "",
    fiber: "",
    saturatedFat: "",
  });
  const [creatingFood, setCreatingFood] = useState(false);
  const [labelScanLoading, setLabelScanLoading] = useState(false);
  const [labelScanError, setLabelScanError] = useState<string | null>(null);
  const [labelScanResult, setLabelScanResult] = useState<LabelScanResult | null>(null);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editFoodDraft, setEditFoodDraft] = useState({
    name: "",
    servingSize: "1",
    servingUnit: DEFAULT_SERVING_UNIT as string,
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    sugar: "",
    fiber: "",
    saturatedFat: "",
  });
  const [targets, setTargets] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
  });
  const [macroViewMode, setMacroViewMode] = useState<"consumed" | "remaining">("consumed");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [savingManualEntry, setSavingManualEntry] = useState(false);
  const [manualMacros, setManualMacros] = useState({ protein: "", carbs: "", fat: "", fiber: "" });
  const [bodyCompDraft, setBodyCompDraft] = useState({ weight: "", bodyFat: "" });
  const [savingBodyComp, setSavingBodyComp] = useState(false);
  const [bodyCompMessage, setBodyCompMessage] = useState<string | null>(null);

  async function loadFoodLibraries(options?: {
    includeRecent?: boolean;
    includeMine?: boolean;
    force?: boolean;
  }) {
    const includeRecent = options?.includeRecent ?? true;
    const includeMine = options?.includeMine ?? true;
    const force = options?.force ?? false;
    const now = Date.now();

    const shouldFetchRecent =
      includeRecent && (force || recentFoods.length === 0 || now - recentFoodsFetchedAtRef.current > FOOD_LIBRARY_TTL_MS);
    const shouldFetchMine =
      includeMine && (force || myFoods.length === 0 || now - myFoodsFetchedAtRef.current > FOOD_LIBRARY_TTL_MS);

    let nextRecent = recentFoods;
    let nextMine = myFoods;

    if (!shouldFetchRecent && !shouldFetchMine) {
      return { recent: nextRecent, mine: nextMine };
    }

    const requests: Array<Promise<Response>> = [];
    if (shouldFetchRecent) {
      requests.push(fetch("/api/foods/recent?limit=40"));
    }
    if (shouldFetchMine) {
      requests.push(fetch("/api/foods"));
    }

    const responses = await Promise.all(requests);
    let cursor = 0;

    if (shouldFetchRecent) {
      const recentResponse = responses[cursor++];
      const recentPayload = await recentResponse.json().catch(() => ({ items: [] }));
      if (recentResponse.ok) {
        nextRecent = recentPayload.items ?? [];
        setRecentFoods(nextRecent);
        recentFoodsFetchedAtRef.current = now;
      }
    }

    if (shouldFetchMine) {
      const mineResponse = responses[cursor++];
      const minePayload = await mineResponse.json().catch(() => ({ foods: [] }));
      if (mineResponse.ok) {
        nextMine = minePayload.foods ?? [];
        setMyFoods(nextMine);
        myFoodsFetchedAtRef.current = now;
      }
    }

    return { recent: nextRecent, mine: nextMine };
  }

  useEffect(() => {
    let isActive = true;
    setError(null);
    fetch(`/api/nutrition-days?date=${selectedDate}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load nutrition day.");
        }
        if (!isActive) {
          return;
        }
        setEntries(payload.entries ?? []);
        setTargets({
          calories: payload.day?.calorie_target?.toString() ?? "",
          protein: payload.day?.protein_target?.toString() ?? "",
          carbs: payload.day?.carbs_target?.toString() ?? "",
          fat: payload.day?.fat_target?.toString() ?? "",
          fiber: payload.day?.fiber_target?.toString() ?? "",
        });
      })
      .catch((err) => {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Unable to load nutrition day.");
        }
      })
      .finally(() => undefined);
    return () => {
      isActive = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    let isActive = true;

    fetch("/api/coach/nutrition-plan-status", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          setCoachPlanStatus("has");
          setCoachPlanSummary(null);
          return;
        }
        setCoachPlanStatus(payload?.hasPlan ? "has" : "none");
        const s = (payload?.summary ?? null) as CoachPlanSummary | null;
        setCoachPlanSummary(s);
      })
      .catch(() => {
        if (isActive) {
          setCoachPlanStatus("has");
          setCoachPlanSummary(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const quantity = toEntryQuantity(entry.quantity);
        acc.calories += toNumber(entry.calories) * quantity;
        acc.protein += toNumber(entry.protein) * quantity;
        acc.carbs += toNumber(entry.carbs) * quantity;
        acc.fat += toNumber(entry.fat) * quantity;
        acc.fiber += toNumber(entry.fiber) * quantity;
        acc.sugar += toNumber(entry.sugar) * quantity;
        acc.saturatedFat += toNumber(entry.saturated_fat) * quantity;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, saturatedFat: 0 }
    );
  }, [entries]);

  const targetNumbers = {
    calories: targets.calories ? Number(targets.calories) : 0,
    protein: targets.protein ? Number(targets.protein) : 0,
    carbs: targets.carbs ? Number(targets.carbs) : 0,
    fat: targets.fat ? Number(targets.fat) : 0,
  };

  const remaining = {
    calories: targetNumbers.calories - totals.calories,
    protein: targetNumbers.protein - totals.protein,
    carbs: targetNumbers.carbs - totals.carbs,
    fat: targetNumbers.fat - totals.fat,
  };

  const proteinProgress = targetNumbers.protein
    ? clampPercent((totals.protein / targetNumbers.protein) * 100)
    : 0;

  const carbsProgress = targetNumbers.carbs
    ? clampPercent((totals.carbs / targetNumbers.carbs) * 100)
    : 0;

  const fatProgress = targetNumbers.fat
    ? clampPercent((totals.fat / targetNumbers.fat) * 100)
    : 0;

  const caloriesProgress = targetNumbers.calories
    ? clampPercent((totals.calories / targetNumbers.calories) * 100)
    : 0;

  // Fiber goal: prefer the coach plan's fiber target, otherwise 1 g per 72 kcal
  // of the calorie target (matching the plan formula), with a 25 g floor.
  const fiberTarget = targets.fiber
    ? Number(targets.fiber)
    : targetNumbers.calories
      ? Math.max(25, Math.round(targetNumbers.calories / 72))
      : 30;
  const fiberProgress = fiberTarget ? clampPercent((totals.fiber / fiberTarget) * 100) : 0;

  const consumedMacroBars = [
    {
      label: "Protein",
      value: totals.protein,
      target: targetNumbers.protein,
      progress: proteinProgress,
      status: statusFromDiff(totals.protein, targetNumbers.protein, MACRO_TOLERANCE_GRAMS),
    },
    {
      label: "Carbs",
      value: totals.carbs,
      target: targetNumbers.carbs,
      progress: carbsProgress,
      status: statusFromDiff(totals.carbs, targetNumbers.carbs, MACRO_TOLERANCE_GRAMS),
    },
    {
      label: "Fat",
      value: totals.fat,
      target: targetNumbers.fat,
      progress: fatProgress,
      status: statusFromDiff(totals.fat, targetNumbers.fat, MACRO_TOLERANCE_GRAMS),
    },
    {
      label: "Fiber",
      value: totals.fiber,
      target: fiberTarget,
      progress: fiberProgress,
      status: statusFromDiff(totals.fiber, fiberTarget, MACRO_TOLERANCE_GRAMS),
    },
  ];

  const remainingMacroBars = consumedMacroBars.map((bar) => ({
    ...bar,
    value: Math.max(0, bar.target - bar.value),
    progress: bar.target ? clampPercent((Math.max(0, bar.target - bar.value) / bar.target) * 100) : 0,
  }));

  const caloriesStatus = statusFromDiff(totals.calories, targetNumbers.calories, CALORIE_TOLERANCE);

  const showingRemaining = macroViewMode === "remaining";
  const displayCalories = showingRemaining ? Math.max(0, remaining.calories) : totals.calories;
  const displayCaloriesProgress = showingRemaining ? clampPercent(100 - caloriesProgress) : caloriesProgress;
  const macroBars = showingRemaining ? remainingMacroBars : consumedMacroBars;

  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
  const todayDate = new Date();
  const todayValue = toLocalDateInputValue(todayDate);
  const compactDateLabel =
    selectedDate === todayValue
      ? `Today, ${selectedDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : selectedDateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          ...(selectedDateObj.getFullYear() !== todayDate.getFullYear() ? { year: "numeric" } : {}),
        });

  const mealSummaries = useMemo(
    () =>
      meals.map((meal) => {
        const mealEntries = entries.filter((entry) => entry.meal_type === meal.key);
        const totalsForMeal = mealEntries.reduce(
          (acc, entry) => {
            const quantity = toEntryQuantity(entry.quantity);
            acc.calories += (entry.calories ?? 0) * quantity;
            acc.protein += (entry.protein ?? 0) * quantity;
            acc.carbs += (entry.carbs ?? 0) * quantity;
            acc.fat += (entry.fat ?? 0) * quantity;
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        return { ...meal, entries: mealEntries, totals: totalsForMeal };
      }),
    [entries]
  );

  const coachWeights = {
    start: Number(coachPlanSummary?.startWeight ?? 0),
    trend: Number(coachPlanSummary?.currentWeight ?? coachPlanSummary?.startWeight ?? 0),
    goal: Number(
      coachPlanSummary?.targetWeight ?? coachPlanSummary?.currentWeight ?? coachPlanSummary?.startWeight ?? 0
    ),
  };

  const coachGoalLabel = formatGoalLabel(coachPlanSummary?.goalType);
  const showCoachGoalProgress =
    hasTargetWeightGoal(coachPlanSummary?.goalType) &&
    typeof coachPlanSummary?.targetWeight === "number";

  const weightProgressPercent = useMemo(() => {
    if (!coachWeights.start || !coachWeights.goal || !coachWeights.trend) {
      return 0;
    }
    const totalDelta = Math.abs(coachWeights.start - coachWeights.goal);
    if (totalDelta === 0) {
      return 100;
    }
    const progressedDelta = Math.abs(coachWeights.start - coachWeights.trend);
    return clampPercent((progressedDelta / totalDelta) * 100);
  }, [coachWeights.goal, coachWeights.start, coachWeights.trend]);

  const checkInTimeline = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    if (Number.isNaN(current.getTime())) {
      return {
        lastDateLabel: "TBD",
        nextDateLabel: "TBD",
        filledBars: 0,
        daysUntilNext: 10,
      };
    }

    const baseLast = coachPlanSummary?.lastCheckInDate ?? coachPlanSummary?.effectiveDate ?? null;
    const baseNext = coachPlanSummary?.nextCheckInDate ?? null;
    const dayInMs = 24 * 60 * 60 * 1000;

    const parsedLast = baseLast ? new Date(`${baseLast}T00:00:00`) : null;
    const parsedNext = baseNext
      ? new Date(`${baseNext}T00:00:00`)
      : parsedLast
        ? new Date(parsedLast.getTime() + 10 * dayInMs)
        : null;

    if (parsedLast && parsedNext && !Number.isNaN(parsedLast.getTime()) && !Number.isNaN(parsedNext.getTime())) {
      const totalDays = Math.max(1, Math.round((parsedNext.getTime() - parsedLast.getTime()) / dayInMs));
      const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((current.getTime() - parsedLast.getTime()) / dayInMs)));
      const filledBars = Math.max(0, Math.min(10, Math.floor((elapsedDays / totalDays) * 10)));
      const daysUntilNext = Math.max(0, Math.ceil((parsedNext.getTime() - current.getTime()) / dayInMs));

      return {
        lastDateLabel: parsedLast.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        nextDateLabel: parsedNext.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        filledBars,
        daysUntilNext,
      };
    }

    const epochDays = Math.floor(current.getTime() / dayInMs);
    const elapsedSinceLast = ((epochDays % 10) + 10) % 10;
    const filledBars = elapsedSinceLast + 1;

    const lastCheckIn = new Date(current);
    lastCheckIn.setDate(current.getDate() - elapsedSinceLast);

    const nextCheckIn = new Date(lastCheckIn);
    nextCheckIn.setDate(lastCheckIn.getDate() + 10);

    return {
      lastDateLabel: lastCheckIn.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      nextDateLabel: nextCheckIn.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      filledBars,
      daysUntilNext: Math.max(0, 10 - filledBars),
    };
  }, [coachPlanSummary?.effectiveDate, coachPlanSummary?.lastCheckInDate, coachPlanSummary?.nextCheckInDate]);

  const weeklyCheckInTracker = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const progress = clampPercent((checkInTimeline.filledBars / 10) * 100) / 100;
    const completeThrough = Math.floor(progress * labels.length);
    const hasPartial = completeThrough < labels.length && progress > 0 && progress * labels.length > completeThrough;

    return labels.map((label, index) => ({
      label,
      state:
        index < completeThrough
          ? "complete"
          : index === completeThrough && hasPartial
            ? "partial"
            : "empty",
    }));
  }, [checkInTimeline.filledBars]);

  async function deleteEntry(entryId: string) {
    setError(null);
    const response = await fetch(`/api/nutrition-entries/${entryId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Failed to delete entry.");
      return;
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  }

  async function updateEntryQuantity(entryId: string, nextQuantity: number) {
    const quantity = Math.max(0.01, Math.round(nextQuantity * 100) / 100);
    setError(null);
    const response = await fetch(`/api/nutrition-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Failed to update quantity.");
      return;
    }

    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? payload.entry : entry)));
  }

  function openServingSizeEditor(entryId: string, quantity: number | null | undefined) {
    setEditingEntryId(entryId);
    setEditServingDraft(formatServingSize(toEntryQuantity(quantity)));
  }

  async function saveServingSize(entryId: string) {
    const parsed = Number(editServingDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Serving size must be greater than 0.");
      return;
    }
    await updateEntryQuantity(entryId, parsed);
    setEditingEntryId(null);
    setEditServingDraft("");
  }

  async function deleteMealEntries(mealKey: MealKey) {
    const mealEntries = entries.filter((entry) => entry.meal_type === mealKey);
    if (mealEntries.length === 0) {
      setMealMenuOpen(null);
      return;
    }

    setError(null);
    const requests = mealEntries.map((entry) =>
      fetch(`/api/nutrition-entries/${entry.id}`, {
        method: "DELETE",
      })
    );

    const results = await Promise.all(requests);
    const failed = results.find((result) => !result.ok);
    if (failed) {
      const payload = await failed.json().catch(() => null);
      setError(payload?.error ?? "Failed to delete meal entries.");
      return;
    }

    setEntries((prev) => prev.filter((entry) => entry.meal_type !== mealKey));
    setMealMenuOpen(null);
  }

  async function copyMealToDate(mealKey: MealKey, targetDate: string, targetMeal: MealKey) {
    setCopyingMeal(mealKey);
    setError(null);
    try {
      const sourceEntries = entries.filter((entry) => entry.meal_type === mealKey);
      if (sourceEntries.length === 0) {
        setError("No entries to copy for this meal.");
        return;
      }

      const requests = sourceEntries.map((entry) =>
        fetch("/api/nutrition-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayDate: targetDate,
            mealType: targetMeal,
            name: entry.entry_name,
            quantity: toEntryQuantity(entry.quantity),
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fat: entry.fat,
            sugar: entry.sugar,
            fiber: entry.fiber,
            saturatedFat: entry.saturated_fat,
          }),
        })
      );

      const results = await Promise.all(requests);
      const failed = await Promise.all(
        results
          .filter((result) => !result.ok)
          .map(async (result) => {
            const payload = await result.json().catch(() => null);
            return payload?.error ?? "Copy failed.";
          })
      );

      if (failed.length > 0) {
        setError(failed[0]);
        return;
      }

      if (targetDate === selectedDate) {
        const refresh = await fetch(`/api/nutrition-days?date=${selectedDate}`);
        const payload = await refresh.json();
        if (refresh.ok) {
          setEntries(payload.entries ?? []);
        }
      }
    } catch {
      setError("Failed to copy meal.");
    } finally {
      setCopyingMeal(null);
    }
  }

  async function submitCopyMeal() {
    if (!copyDialogMeal) {
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(copyTargetDate)) {
      setError("Please choose a valid target date.");
      return;
    }

    await copyMealToDate(copyDialogMeal, copyTargetDate, copyTargetMeal);
    setCopyDialogMeal(null);
  }

  async function handleFoodSearch() {
    await runFoodSearch(searchQuery);
  }

  async function runFoodSearch(queryInput: string) {
    const query = queryInput.trim();
    if (query.length < 2) {
      setSearchError("Search needs at least 2 characters.");
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchPerformed(true);
    try {
      const response = await fetch(`/api/foods/search?query=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Food search failed.");
      }
      setSearchQuery(query);
      setSearchResults(payload.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Food search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function scanNutritionLabel(file: File | null | undefined) {
    if (!file) {
      return;
    }

    setLabelScanLoading(true);
    setLabelScanError(null);
    setLabelScanResult(null);
    setError(null);

    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/foods/label-scan", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Label scan failed.");
      }

      const result = payload.result as LabelScanResult;
      setLabelScanResult(result);
      setCreateFoodDraft({
        name: result.name ?? "",
        servingSize: toDraftNumber(result.servingSize) || "1",
        servingUnit: normalizeServingUnit(result.servingUnit),
        calories: toDraftNumber(result.calories),
        protein: toDraftNumber(result.protein),
        carbs: toDraftNumber(result.carbs),
        fat: toDraftNumber(result.fat),
        sugar: toDraftNumber(result.sugar),
        fiber: toDraftNumber(result.fiber),
        saturatedFat: toDraftNumber(result.saturatedFat),
      });
      setDialogTab("create");
    } catch (err) {
      setLabelScanError(err instanceof Error ? err.message : "Label scan failed.");
    } finally {
      setLabelScanLoading(false);
    }
  }

  async function addFoodResult(result: FoodSearchResult) {
    const targetMeal = activeMealDialog ?? searchMeal;
    setError(null);
    const response = await fetch("/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: selectedDate,
        mealType: targetMeal,
        name: result.brandOwner ? `${result.description} (${result.brandOwner})` : result.description,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        sugar: result.sugar,
        fiber: result.fiber,
        saturatedFat: result.saturatedFat,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Failed to add entry.");
      return;
    }

    setEntries((prev) => [...prev, payload.entry]);
  }

  const manualEntryCalories = Math.round(
    (Number(manualMacros.protein) || 0) * 4 +
      (Number(manualMacros.carbs) || 0) * 4 +
      (Number(manualMacros.fat) || 0) * 9,
  );

  async function submitManualEntry() {
    const protein = Math.max(0, Number(manualMacros.protein) || 0);
    const carbs = Math.max(0, Number(manualMacros.carbs) || 0);
    const fat = Math.max(0, Number(manualMacros.fat) || 0);
    const fiber = Math.max(0, Number(manualMacros.fiber) || 0);

    if (protein <= 0 && carbs <= 0 && fat <= 0 && fiber <= 0) {
      setError("Enter at least one macro to log.");
      return;
    }

    setSavingManualEntry(true);
    setError(null);
    try {
      const response = await fetch("/api/nutrition-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayDate: selectedDate,
          mealType: "snack",
          name: "Quick add",
          protein,
          carbs,
          fat,
          fiber,
          calories: protein * 4 + carbs * 4 + fat * 9,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to log macros.");
        return;
      }

      setEntries((prev) => [...prev, payload.entry]);
      setManualMacros({ protein: "", carbs: "", fat: "", fiber: "" });
      setManualEntryOpen(false);
    } finally {
      setSavingManualEntry(false);
    }
  }

  async function submitBodyComp() {
    const bodyWeight = Number(bodyCompDraft.weight);
    const bodyFatPercent = bodyCompDraft.bodyFat.trim() ? Number(bodyCompDraft.bodyFat) : null;

    if (!Number.isFinite(bodyWeight) || bodyWeight <= 0) {
      setBodyCompMessage(null);
      setError("Enter a valid body weight.");
      return;
    }

    if (
      bodyFatPercent !== null &&
      (!Number.isFinite(bodyFatPercent) || bodyFatPercent <= 0 || bodyFatPercent >= 100)
    ) {
      setBodyCompMessage(null);
      setError("Enter a valid body fat percentage.");
      return;
    }

    setSavingBodyComp(true);
    setBodyCompMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/health-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_body_comp",
          bodyWeight,
          bodyFatPercent: bodyFatPercent ?? undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to save body metrics.");
        return;
      }

      setBodyCompMessage("Saved");
    } finally {
      setSavingBodyComp(false);
    }
  }

  async function openMealDialog(mealKey: MealKey) {
    setFoodDialogOpen(true);
    setActiveMealDialog(mealKey);
    setDialogTab("recent");
    setDialogSearch("");
    setDialogLoading(true);
    try {
      await loadFoodLibraries({ includeRecent: true, includeMine: true });
    } finally {
      setDialogLoading(false);
    }
  }

  async function addLibraryFood(food: LibraryFood, mealKey: MealKey, quantityOverride?: number) {
    setError(null);
    const rowKey = `${dialogTab}-${food.id}`;
    const quantity = toEntryQuantity(
      quantityOverride !== undefined ? quantityOverride : food.quantity,
    );
    setAddingFoodKey(rowKey);
    try {
      const response = await fetch("/api/nutrition-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayDate: selectedDate,
          mealType: mealKey,
          name: food.name,
          quantity,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
        sugar: food.sugar,
        fiber: food.fiber,
        saturatedFat: food.saturated_fat,
      }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to add entry.");
        return;
      }

      setEntries((prev) => [...prev, payload.entry]);
      setAddedFlashKey(rowKey);
      setTimeout(() => {
        setAddedFlashKey((current) => (current === rowKey ? null : current));
      }, 1200);
    } finally {
      setAddingFoodKey((current) => (current === rowKey ? null : current));
    }
  }

  async function createCustomFood() {
    const name = createFoodDraft.name.trim();
    if (!name) {
      setError("Food name is required.");
      return;
    }

    setCreatingFood(true);
    setError(null);
    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          servingSize: createFoodDraft.servingSize,
          servingUnit: createFoodDraft.servingUnit,
          calories: createFoodDraft.calories,
          protein: createFoodDraft.protein,
          carbs: createFoodDraft.carbs,
          fat: createFoodDraft.fat,
          sugar: createFoodDraft.sugar,
          fiber: createFoodDraft.fiber,
          saturatedFat: createFoodDraft.saturatedFat,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to create custom food.");
        return;
      }

      setMyFoods((prev) => [payload.food, ...prev]);
      myFoodsFetchedAtRef.current = Date.now();
      setDialogTab("mine");
      setCreateFoodDraft({
        name: "",
        servingSize: "1",
        servingUnit: DEFAULT_SERVING_UNIT,
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
        sugar: "",
        fiber: "",
        saturatedFat: "",
      });
    } finally {
      setCreatingFood(false);
    }
  }

  function beginEditFood(food: LibraryFood) {
    setEditingFoodId(food.id);
    setEditFoodDraft({
      name: food.name,
      servingSize: food.serving_size?.toString() ?? "1",
      servingUnit: food.serving_unit ?? DEFAULT_SERVING_UNIT,
      calories: food.calories?.toString() ?? "",
      protein: food.protein?.toString() ?? "",
      carbs: food.carbs?.toString() ?? "",
      fat: food.fat?.toString() ?? "",
      sugar: food.sugar?.toString() ?? "",
      fiber: food.fiber?.toString() ?? "",
      saturatedFat: food.saturated_fat?.toString() ?? "",
    });
  }

  async function beginEditRecentFood(food: LibraryFood) {
    const match = myFoods.find((item) => item.name.toLowerCase() === food.name.toLowerCase());
    if (match) {
      beginEditFood(match);
      return;
    }
    setDialogSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          servingSize: food.serving_size?.toString() ?? "1",
          servingUnit: food.serving_unit ?? DEFAULT_SERVING_UNIT,
          calories: food.calories?.toString() ?? "",
          protein: food.protein?.toString() ?? "",
          carbs: food.carbs?.toString() ?? "",
          fat: food.fat?.toString() ?? "",
          sugar: food.sugar?.toString() ?? "",
          fiber: food.fiber?.toString() ?? "",
          saturatedFat: food.saturated_fat?.toString() ?? "",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.food) {
        setError(payload?.error ?? "Failed to load food for editing.");
        return;
      }
      setMyFoods((prev) => [payload.food, ...prev]);
      myFoodsFetchedAtRef.current = Date.now();
      beginEditFood(payload.food);
    } finally {
      setDialogSaving(false);
    }
  }

  async function saveEditedFood(foodId: string) {
    setDialogSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/foods/${foodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFoodDraft),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to update food.");
        return;
      }
      setMyFoods((prev) => prev.map((food) => (food.id === foodId ? payload.food : food)));
      myFoodsFetchedAtRef.current = Date.now();
      setEditingFoodId(null);
    } finally {
      setDialogSaving(false);
    }
  }

  async function deleteFood(foodId: string) {
    setDialogSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/foods/${foodId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to delete food.");
        return;
      }
      setMyFoods((prev) => prev.filter((food) => food.id !== foodId));
      myFoodsFetchedAtRef.current = Date.now();
    } finally {
      setDialogSaving(false);
    }
  }

  const dialogFoods = useMemo(() => {
    const source = dialogTab === "recent" ? recentFoods : myFoods;
    const query = dialogSearch.trim().toLowerCase();
    if (!query) {
      return source;
    }
    return source.filter((food) => food.name.toLowerCase().includes(query));
  }, [dialogTab, recentFoods, myFoods, dialogSearch]);

  return (
    <SidebarShell mainClassName="w-full">
      <section
        className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col gap-5 px-5 py-4 text-[#F8FAFC] sm:px-8 lg:px-10 lg:py-6 2xl:px-12"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(22,212,216,0.08), transparent 30%), radial-gradient(circle at top right, rgba(255,79,147,0.08), transparent 28%), #080B12",
        }}
      >
        <div className="flex w-full flex-col gap-5">
        <header className="pointer-events-none relative z-[45] -mt-[60px] mb-[-4px] flex flex-col items-center sm:mt-0">
          <h1 className="mb-2 hidden text-center text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[#F8FAFC] sm:block">
            Nutrition
          </h1>
          <div className="pointer-events-auto mx-auto flex w-full max-w-[calc(100vw-176px)] items-center justify-center rounded-full border border-white/10 bg-[#121826]/92 p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:max-w-[330px]">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#0B1020] text-[#A8B3C7] transition hover:bg-[#171F30] hover:text-[#F8FAFC]"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center px-1">
              <button
                type="button"
                onClick={() => {
                  if (dateInputRef.current?.showPicker) {
                    dateInputRef.current.showPicker();
                    return;
                  }
                  dateInputRef.current?.click();
                }}
                className="min-w-0 rounded-full px-2 py-2 text-center text-[13px] font-extrabold leading-none text-[#F8FAFC] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#16D4D8]/35 min-[380px]:px-3 min-[380px]:text-[14px] sm:text-[15px]"
                aria-label="Open date picker"
              >
                <span className="block truncate">{compactDateLabel}</span>
              </button>
              <input
                ref={dateInputRef}
                id="nutrition-date-mobile"
                name="nutritionDateMobile"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="sr-only"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
              className="grid h-9 w-9 place-items-center rounded-full bg-[#0B1020] text-[#A8B3C7] transition hover:bg-[#171F30] hover:text-[#F8FAFC]"
              aria-label="Next day"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}

        <section className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.55fr)] lg:items-stretch lg:gap-5 lg:space-y-0 2xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.5fr)]">
          <div className="flex h-full flex-col rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(23,31,48,0.96),rgba(18,24,38,0.94))] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 text-[16px] font-extrabold text-[#F8FAFC] sm:gap-2 sm:text-[19px]">
                <Flame className="h-4 w-4 text-[#FF4F93] sm:h-5 sm:w-5" aria-hidden="true" />
                Macros
              </div>
              <div className="inline-flex rounded-full border border-white/10 bg-[#0B1020] p-0.5 text-[10px] font-bold shadow-inner sm:text-[11px]">
                <button
                  type="button"
                  onClick={() => setMacroViewMode("consumed")}
                  className={`rounded-full px-2 py-1 transition sm:px-2.5 ${
                    !showingRemaining ? "bg-[#F8FAFC] text-[#080B12]" : "text-[#A8B3C7]"
                  }`}
                >
                  Consumed
                </button>
                <button
                  type="button"
                  onClick={() => setMacroViewMode("remaining")}
                  className={`rounded-full px-2 py-1 transition sm:px-2.5 ${
                    showingRemaining ? "bg-[#F8FAFC] text-[#080B12]" : "text-[#A8B3C7]"
                  }`}
                >
                  Left
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5 sm:hidden">
              <div className="relative grid aspect-square place-items-center rounded-[18px] border border-white/10 bg-[#0E1320] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.24)]">
                <svg className="absolute inset-2" viewBox="0 0 150 150" aria-hidden="true">
                  <defs>
                    <linearGradient id="mobile-calorie-ring-compact" x1="18" y1="18" x2="132" y2="132">
                      <stop stopColor="#14D2DC" />
                      <stop offset="1" stopColor="#0BA7B0" />
                    </linearGradient>
                  </defs>
                  <g transform="rotate(-90 75 75)">
                    <circle cx="75" cy="75" r="57" fill="none" stroke="#243044" strokeWidth="13" />
                    <circle
                      cx="75"
                      cy="75"
                      r="57"
                      fill="none"
                      stroke="url(#mobile-calorie-ring-compact)"
                      strokeWidth="13"
                      strokeLinecap="round"
                      strokeDasharray={ringDashArray(displayCaloriesProgress, 57)}
                    />
                  </g>
                </svg>
                <div className="relative z-10 flex max-w-[68px] flex-col items-center justify-center text-center">
                  <p
                    className="w-full truncate text-[17px] font-extrabold leading-none text-[#F8FAFC]"
                    style={STATUS_TEXT_COLOR[caloriesStatus] ? { color: STATUS_TEXT_COLOR[caloriesStatus]! } : undefined}
                  >
                    {roundToWhole(displayCalories).toLocaleString()}
                  </p>
                  <span className="mt-1 text-[9.5px] font-extrabold uppercase leading-none tracking-[0.08em] text-[#A8B3C7]">
                    Cal
                  </span>
                </div>
              </div>

              <div className="grid gap-1.5">
                {macroBars.slice(0, 3).map((bar, index) => {
                  const baseColor = index === 0 ? "#14D2DC" : index === 1 ? "#61A7B3" : "#FF5CA8";
                  const statusColor = STATUS_TEXT_COLOR[bar.status];
                  const shortLabel = index === 0 ? "P" : index === 1 ? "C" : "F";
                  return (
                    <div key={`mobile-macro-${bar.label}`} className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-white/10 bg-[#0E1320] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <p className="text-[12px] font-extrabold text-[#F8FAFC]">{shortLabel}</p>
                      <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[#243044]">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${bar.progress}%`, backgroundColor: baseColor }}
                        />
                      </div>
                      <p
                        className="text-[11px] font-extrabold tabular-nums text-[#F8FAFC]"
                        style={statusColor ? { color: statusColor } : undefined}
                      >
                        {roundToWhole(bar.value)}
                        <span className="font-bold text-[#A8B3C7]">/{roundToWhole(bar.target)}g</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 grid flex-1 gap-3 sm:mt-5 sm:grid-cols-[minmax(180px,230px)_1fr] sm:items-center sm:gap-5 lg:gap-8">
              <div className="relative mx-auto hidden aspect-square w-full max-w-[190px] place-items-center sm:grid lg:max-w-[230px]">
                <svg className="absolute inset-0" viewBox="0 0 150 150" aria-hidden="true">
                  <defs>
                    <linearGradient id="mobile-calorie-ring" x1="18" y1="18" x2="132" y2="132">
                      <stop stopColor="#14D2DC" />
                      <stop offset="1" stopColor="#0BA7B0" />
                    </linearGradient>
                  </defs>
                  <g transform="rotate(-90 75 75)">
                    <circle cx="75" cy="75" r="61" fill="none" stroke="#243044" strokeWidth="12" />
                    <circle
                      cx="75"
                      cy="75"
                      r="61"
                      fill="none"
                      stroke="url(#mobile-calorie-ring)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={ringDashArray(displayCaloriesProgress, 61)}
                      filter="drop-shadow(0 4px 8px rgba(20,210,220,0.32))"
                    />
                  </g>
                </svg>
                <div className="text-center">
                  <p
                    className="text-[34px] font-bold leading-none tracking-[-0.02em] text-[#F8FAFC]"
                    style={STATUS_TEXT_COLOR[caloriesStatus] ? { color: STATUS_TEXT_COLOR[caloriesStatus]! } : undefined}
                  >
                    {roundToWhole(displayCalories).toLocaleString()}
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-[#A8B3C7]">
                    / {roundToWhole(targetNumbers.calories || 0).toLocaleString()} Cal
                  </p>
                  <p
                    className="mt-1 text-sm font-bold text-[#0BA7B0]"
                    style={STATUS_TEXT_COLOR[caloriesStatus] ? { color: STATUS_TEXT_COLOR[caloriesStatus]! } : undefined}
                  >
                    {Math.round(displayCaloriesProgress)}%
                  </p>
                </div>
              </div>

              <div className="hidden grid-cols-4 gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
                {macroBars.map((bar, index) => {
                  const baseColor = index === 0 ? "#14D2DC" : index === 1 ? "#61A7B3" : index === 2 ? "#FF5CA8" : "#7A8699";
                  const statusColor = STATUS_TEXT_COLOR[bar.status];
                  return (
                    <div key={bar.label} className="min-w-0 rounded-[14px] border border-white/10 bg-[#0E1320] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_26px_rgba(0,0,0,0.22)] sm:rounded-[18px] sm:p-4">
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-extrabold text-[#F8FAFC] sm:text-[13px]">{bar.label}</p>
                        <p
                          className="mt-0.5 text-[12px] font-extrabold tabular-nums text-[#F8FAFC] sm:text-[15px]"
                          style={statusColor ? { color: statusColor } : undefined}
                        >
                          {roundToWhole(bar.value)}
                          <span
                            className="font-bold text-[#A8B3C7]"
                            style={statusColor ? { color: statusColor } : undefined}
                          >
                            /{roundToWhole(bar.target)}g
                          </span>
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#243044] sm:mt-3 sm:h-3.5">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${bar.progress}%`, backgroundColor: baseColor }}
                        />
                      </div>
                      <p
                        className="mt-1 hidden text-right text-[11px] font-extrabold tabular-nums sm:block"
                        style={{ color: statusColor ?? baseColor }}
                      >
                        {Math.round(bar.progress)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-[18px] border border-white/10 bg-[#0E1320] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#A8B3C7]">Today&apos;s metrics</p>
                {bodyCompMessage ? (
                  <span className="rounded-full bg-[#16D4D8]/12 px-2 py-1 text-[11px] font-extrabold text-[#16D4D8]">
                    {bodyCompMessage}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                <label className="min-w-0 space-y-1">
                  <span className="text-[11px] font-bold text-[#A8B3C7]">Weight</span>
                  <input
                    value={bodyCompDraft.weight}
                    onChange={(event) => setBodyCompDraft((prev) => ({ ...prev, weight: event.target.value }))}
                    placeholder="lb"
                    inputMode="decimal"
                    className="w-full rounded-[14px] border border-white/12 bg-[#0B1020] px-3 py-2 text-sm font-bold text-[#F8FAFC] placeholder:text-[#687386] focus:border-[#16D4D8]/55 focus:outline-none"
                  />
                </label>
                <label className="min-w-0 space-y-1">
                  <span className="text-[11px] font-bold text-[#A8B3C7]">Body Fat %</span>
                  <input
                    value={bodyCompDraft.bodyFat}
                    onChange={(event) => setBodyCompDraft((prev) => ({ ...prev, bodyFat: event.target.value }))}
                    placeholder="%"
                    inputMode="decimal"
                    className="w-full rounded-[14px] border border-white/12 bg-[#0B1020] px-3 py-2 text-sm font-bold text-[#F8FAFC] placeholder:text-[#687386] focus:border-[#16D4D8]/55 focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void submitBodyComp()}
                  disabled={savingBodyComp}
                  className="h-10 rounded-[14px] bg-[#F8FAFC] px-3 text-[12px] font-extrabold text-[#080B12] shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition hover:brightness-95 disabled:opacity-60"
                >
                  {savingBodyComp ? "Saving" : "Submit"}
                </button>
              </div>
            </div>

          </div>

          {coachPlanStatus === "loading" ? (
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(23,31,48,0.96),rgba(18,24,38,0.94))] p-4 text-sm font-bold text-[#A8B3C7] shadow-[0_22px_60px_rgba(0,0,0,0.32)]">
              Loading coach plan...
            </div>
          ) : coachPlanStatus === "none" ? (
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(23,31,48,0.96),rgba(18,24,38,0.94))] p-5 text-[#F8FAFC] shadow-[0_22px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
              {/* Macro ring visual */}
              <div className="relative mx-auto mb-4 flex h-40 w-full max-w-[280px] items-center justify-center sm:mb-5 sm:h-48">
                <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
                  <span className="absolute inset-0 rounded-full border border-[rgba(20,210,220,0.28)]" aria-hidden="true" />
                  <span className="absolute inset-[10px] rounded-full border border-[rgba(255,79,147,0.24)]" aria-hidden="true" />
                  <span
                    className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(20,210,220,0.42),rgba(255,92,168,0.34))] shadow-[inset_0_2px_10px_rgba(255,255,255,0.7),0_12px_26px_rgba(20,210,220,0.18)] sm:h-24 sm:w-24"
                    aria-hidden="true"
                  >
                    <Salad className="h-9 w-9 text-[#0B7C84] sm:h-10 sm:w-10" />
                  </span>
                </div>
                {/* Floating macro chips */}
                <span className="absolute left-0 top-[42%] rounded-[12px] border border-[rgba(22,212,216,0.24)] bg-[#0B1020]/90 px-2.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                  <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#16D4D8]">Protein</span>
                  <span className="block text-[13px] font-extrabold leading-none text-[#16D4D8]">30%</span>
                </span>
                <span className="absolute right-1 top-2 rounded-[12px] border border-[rgba(255,79,147,0.24)] bg-[#0B1020]/90 px-2.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                  <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#FF4F93]">Carbs</span>
                  <span className="block text-[13px] font-extrabold leading-none text-[#FF4F93]">40%</span>
                </span>
                <span className="absolute bottom-2 right-2 rounded-[12px] border border-[rgba(167,139,250,0.24)] bg-[#0B1020]/90 px-2.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                  <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#A78BFA]">Fats</span>
                  <span className="block text-[13px] font-extrabold leading-none text-[#A78BFA]">30%</span>
                </span>
              </div>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[rgba(22,212,216,0.12)] px-3 py-1 text-[11px] font-bold text-[#16D4D8]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Nutrition Coach
              </span>
              <h2 className="mt-3 font-head text-[28px] font-extrabold leading-[1.05] tracking-tight text-[#F8FAFC] sm:text-[32px]">
                Start your coaching plan
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#A8B3C7]">
                Set your goal, get your macros, and build a plan that fits your training.
              </p>
              <Link
                href="/member/nutrition/coach"
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#16D4D8_0%,#A78BFA_52%,#FF4F93_100%)] px-5 py-3.5 text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(255,79,147,0.22)] transition hover:brightness-105 sm:mt-5"
              >
                Set My Goal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div
              className={`flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(23,31,48,0.96),rgba(18,24,38,0.94))] p-3 text-[#F8FAFC] shadow-[0_22px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5 ${
                checkInTimeline.daysUntilNext === 0 ? "ring-2 ring-[#FF4F93]/50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1.5 text-[16px] font-extrabold text-[#F8FAFC] sm:gap-2 sm:text-[19px]">
                  <Atom className="h-4 w-4 text-[#FF4F93] sm:h-5 sm:w-5" aria-hidden="true" />
                  Coach
                </div>
                {showCoachGoalProgress ? (
                  <span className="rounded-full border border-white/10 bg-[#0B1020] px-2 py-0.5 text-[10.5px] font-extrabold text-[#A8B3C7] sm:px-2.5 sm:py-1 sm:text-xs">
                    {Math.round(weightProgressPercent)}% to goal
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 sm:mt-4">
                <p className="min-w-0 truncate text-[16px] font-semibold leading-tight text-[#F8FAFC] sm:text-[19px]">
                  Goal: <span className="font-extrabold">{coachGoalLabel}</span>
                </p>
                <Link
                  href="/member/nutrition/coach"
                  className="shrink-0 rounded-full bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold text-[#080B12] shadow-[0_10px_22px_rgba(0,0,0,0.26)] transition hover:brightness-95 sm:px-4 sm:py-2 sm:text-xs"
                >
                  View plan
                </Link>
              </div>
              <div className="mt-3 rounded-[16px] border border-white/10 bg-[#0E1320] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:mt-4 sm:rounded-[20px] sm:p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[12.5px] font-extrabold text-[#F8FAFC] sm:text-[15px] ${checkInTimeline.daysUntilNext === 0 ? "uppercase text-[#FF4F93]" : ""}`}>
                  {checkInTimeline.daysUntilNext === 0
                    ? "Check-in due today"
                    : `${checkInTimeline.daysUntilNext} day${checkInTimeline.daysUntilNext === 1 ? "" : "s"} until check-in`}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1 sm:mt-3 sm:gap-1.5">
                  {weeklyCheckInTracker.map((day) => (
                    <span key={`coach-week-${day.label}`} className="min-w-0 text-center">
                      <span
                        className={`mx-auto block h-5 rounded-[7px] border sm:h-8 sm:rounded-[10px] ${
                          day.state === "complete"
                            ? "border-[#16D4D8]/45 bg-[#16D4D8]/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                            : day.state === "partial"
                              ? "border-[#FF4F93]/45 bg-[linear-gradient(135deg,rgba(255,79,147,0.28)_0%,rgba(255,79,147,0.28)_50%,rgba(23,31,48,0.9)_50%,rgba(23,31,48,0.9)_100%)]"
                              : "border-white/10 bg-[#121826]"
                        }`}
                      />
                      <span
                        className={`mt-1 block text-[8.5px] font-extrabold uppercase tracking-[0.02em] sm:mt-1.5 sm:text-[10.5px] sm:tracking-[0.06em] ${
                          day.state === "complete"
                            ? "text-[#16D4D8]"
                            : day.state === "partial"
                              ? "text-[#FF4F93]"
                              : "text-[#A8B3C7]"
                        }`}
                      >
                        <span className="sm:hidden">{day.label.slice(0, 1)}</span>
                        <span className="hidden sm:inline">{day.label}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href="/member/nutrition/coach"
                className={`mt-3 flex items-center justify-center rounded-[16px] px-4 py-2.5 text-[12px] font-extrabold transition sm:mt-4 sm:rounded-[20px] sm:text-[13px] ${
                  checkInTimeline.daysUntilNext === 0
                    ? "bg-[#FF4F93] text-white shadow-[0_10px_22px_rgba(255,79,147,0.28)] hover:brightness-110"
                    : "bg-[#F8FAFC] text-[#080B12] shadow-[0_10px_22px_rgba(0,0,0,0.26)] hover:brightness-95"
                }`}
              >
                {checkInTimeline.daysUntilNext === 0 ? "Start weekly check-in" : "Check-in"}
              </Link>
            </div>
          )}
        </section>


        <section className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-3 2xl:grid-cols-4">
          <div className="flex items-center justify-between gap-3 px-1 md:col-span-full">
            <h2 className="text-[19px] font-extrabold text-[#F8FAFC]">Meals</h2>
            <button
              type="button"
              onClick={() => setManualEntryOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#121826]/90 px-3.5 py-2 text-[12px] font-extrabold text-[#F8FAFC] shadow-[0_10px_26px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:bg-[#171F30] sm:text-[13px]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Quick add macros
            </button>
          </div>
          {mealSummaries.map((meal) => {
            const hasEntries = meal.entries.length > 0;
            return (
              <div
                key={`mobile-meal-${meal.key}`}
                className="relative rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(23,31,48,0.96),rgba(18,24,38,0.94))] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[17px] font-bold leading-tight text-[#F8FAFC]">{meal.label}</p>
                    <p className="mt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A8B3C7]">
                      {Math.round(meal.totals.calories).toLocaleString()} kcal | P{formatGrams(meal.totals.protein)} | C{formatGrams(meal.totals.carbs)} | F{formatGrams(meal.totals.fat)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMealMenuOpen((current) => (current === meal.key ? null : meal.key))}
                      className="grid h-9 w-9 place-items-center rounded-full text-[#A8B3C7] transition hover:bg-white/10 hover:text-[#F8FAFC]"
                      aria-label={`Meal actions for ${meal.label}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.7" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                        <circle cx="12" cy="19" r="1.7" fill="currentColor" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMealMenuOpen(null);
                        openMealDialog(meal.key);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full bg-[#16D4D8] text-[#071A1C] shadow-[0_10px_24px_rgba(22,212,216,0.26)] transition hover:brightness-105"
                      aria-label={`Add to ${meal.label}`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {mealMenuOpen === meal.key ? (
                  <div className="absolute right-4 top-14 z-20 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#171F30] shadow-[0_18px_38px_rgba(0,0,0,0.32)]">
                    <button
                      type="button"
                      onClick={() => void deleteMealEntries(meal.key)}
                      className="block w-full px-4 py-3 text-left text-sm font-semibold text-rose-300 transition hover:bg-white/10"
                    >
                      Delete meal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMealMenuOpen(null);
                        setCopyDialogMeal(meal.key);
                        setCopyTargetDate(toLocalDateInputValue(new Date()));
                        setCopyTargetMeal(meal.key);
                      }}
                      disabled={copyingMeal === meal.key}
                      className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#A8B3C7] transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {copyingMeal === meal.key ? "Copying..." : "Copy meal"}
                    </button>
                  </div>
                ) : null}

                {hasEntries ? (
                  <div className="mt-4 space-y-3">
                    {meal.entries.map((entry) => {
                      const quantity = toEntryQuantity(entry.quantity);
                      const servingLabel = `${formatServingSize(quantity)} serving${quantity === 1 ? "" : "s"}`;
                      const entryCal = roundToWhole((entry.calories ?? 0) * quantity);
                      const entryP = formatGrams((entry.protein ?? 0) * quantity);
                      const entryC = formatGrams((entry.carbs ?? 0) * quantity);
                      const entryF = formatGrams((entry.fat ?? 0) * quantity);
                      const isEditingServing = editingEntryId === entry.id;
                      return (
                        <div key={`mobile-entry-${entry.id}`} className="rounded-2xl border border-white/10 bg-[#0E1320] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[14px] font-bold leading-tight text-[#F8FAFC]">{entry.entry_name}</p>
                              <p className="mt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A8B3C7]">
                                {servingLabel}, {entryCal} CAL | C{entryC} | P{entryP} | F{entryF}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openServingSizeEditor(entry.id, entry.quantity)}
                                className="grid h-8 w-8 place-items-center rounded-full text-[#A8B3C7] transition hover:bg-white/10 hover:text-[#F8FAFC]"
                                aria-label={`Edit servings for ${entry.entry_name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteEntry(entry.id)}
                                className="grid h-8 w-8 place-items-center rounded-full text-[#A8B3C7] transition hover:bg-rose-500/10 hover:text-rose-300"
                                aria-label={`Remove ${entry.entry_name}`}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          {isEditingServing ? (
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#A8B3C7]">
                                Servings
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  value={editServingDraft}
                                  onChange={(event) => setEditServingDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") void saveServingSize(entry.id);
                                    if (event.key === "Escape") {
                                      setEditingEntryId(null);
                                      setEditServingDraft("");
                                    }
                                  }}
                                  className="h-9 w-20 rounded-xl border border-white/12 bg-[#0B1020] px-2 text-sm font-bold text-[#F8FAFC] focus:border-[#16D4D8] focus:outline-none"
                                  inputMode="decimal"
                                  aria-label="Edit servings"
                                />
                                <button
                                  type="button"
                                  onClick={() => void saveServingSize(entry.id)}
                                  className="grid h-9 w-9 place-items-center rounded-full bg-[#F8FAFC] text-[#080B12]"
                                  aria-label="Save servings"
                                >
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMealMenuOpen(null);
                      openMealDialog(meal.key);
                    }}
                    className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0E1320] px-4 py-4 text-sm font-bold text-[#A8B3C7] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_rgba(0,0,0,0.2)] transition hover:border-[#16D4D8]/45 hover:bg-[#121826] hover:text-[#16D4D8]"
                  >
                    <span className="text-left">
                      <span className="block text-[#F8FAFC]">No food logged yet</span>
                      <span className="block text-[12px] font-extrabold text-[#16D4D8]">Tap to start logging</span>
                    </span>
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-[#16D4D8]/35 bg-[#16D4D8]/12 text-[#16D4D8]">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </section>

        <div className="h-4" />
        </div>



        {foodDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-4 sm:items-center sm:py-6">
            <div className="panel my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] [--line:rgba(148,188,221,0.16)] [--line-strong:rgba(148,188,221,0.26)] [--panel:rgba(20,58,91,0.98)] [--panel-2:rgba(31,72,106,0.92)] [--panel-3:rgba(39,86,124,0.92)] [--text:#E8F2FF] [--text-muted:#A9BED5] [--text-soft:#7F9BB8]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    {activeMealDialog ? `Add To ${meals.find((meal) => meal.key === activeMealDialog)?.label}` : "Manage Foods"}
                  </p>
                  <h3 className="mt-1 text-3xl font-semibold leading-tight text-[var(--text)]">Search foods</h3>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogTab("scan")}
                    className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-extrabold shadow-[0_12px_24px_rgba(20,210,220,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 ${
                      dialogTab === "scan"
                        ? "border-[#14D2DC]/60 bg-[#14D2DC] text-[#071A21]"
                        : "border-[#14D2DC]/40 bg-[linear-gradient(135deg,rgba(20,210,220,0.24),rgba(255,92,168,0.22))] text-[#0C7D85]"
                    }`}
                    aria-pressed={dialogTab === "scan"}
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden min-[380px]:inline">Scan label</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFoodDialogOpen(false);
                      setActiveMealDialog(null);
                      setEditingFoodId(null);
                    }}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-lg text-[var(--text-muted)] transition hover:text-[var(--text)]"
                    aria-label="Close food dialog"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {(
                  activeMealDialog
                    ? (["recent", "mine", "usda", "create"] as const)
                    : (["recent", "mine", "create"] as const)
                ).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDialogTab(tab)}
                    className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                      dialogTab === tab
                        ? "border-[var(--pink)]/50 bg-[var(--pink)]/12 text-[var(--pink)]"
                        : "border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {tab === "recent" ? "Recents" : tab === "mine" ? "My foods" : tab === "usda" ? "USDA" : "Create food"}
                  </button>
                ))}
              </div>

              {dialogTab === "scan" ? (
                <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--pink)]/40 bg-[var(--pink)]/12 text-[var(--pink)]">
                      <Camera className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">Upload a Nutrition Facts photo</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        Capture the full label straight-on when possible. You can review and edit every value before saving.
                      </p>
                    </div>
                  </div>
                  <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-black/10 px-4 py-8 text-center transition hover:border-[var(--pink)]/50">
                    <Camera className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
                    <span className="mt-3 text-sm font-semibold text-[var(--text)]">
                      {labelScanLoading ? "Scanning label..." : "Choose or take photo"}
                    </span>
                    <span className="mt-1 text-xs text-[var(--text-soft)]">JPG, PNG, or WebP up to 8 MB</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      capture="environment"
                      disabled={labelScanLoading}
                      onChange={(event) => {
                        void scanNutritionLabel(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                  {labelScanError ? (
                    <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
                      {labelScanError}
                    </div>
                  ) : null}
                  {labelScanResult ? (
                    <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                      Label scanned with {labelScanResult.confidence} confidence. Review the filled fields in Create food.
                    </div>
                  ) : null}
                </div>
              ) : dialogTab === "create" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {labelScanResult ? (
                    <div className="rounded-2xl border border-[var(--pink)]/25 bg-[var(--pink)]/10 p-3 text-xs leading-5 text-[var(--text-muted)] sm:col-span-2">
                      Scanned label filled these values with {labelScanResult.confidence} confidence.
                      {labelScanResult.notes ? ` ${labelScanResult.notes}` : ""}
                    </div>
                  ) : null}
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Food Name</span>
                    <input
                      value={createFoodDraft.name}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Food name"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Amount per Serving</span>
                    <input
                      value={createFoodDraft.servingSize}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, servingSize: event.target.value }))}
                      placeholder="e.g. 84"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                    <span className="block text-[10px] text-[var(--text-soft)]">How much is in one serving (e.g. 84 grams).</span>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Unit</span>
                    <select
                      value={createFoodDraft.servingUnit}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, servingUnit: event.target.value }))}
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-white/30 focus:outline-none"
                    >
                      {SERVING_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Calories</span>
                    <input
                      value={createFoodDraft.calories}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                      placeholder="Calories"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Protein</span>
                    <input
                      value={createFoodDraft.protein}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                      placeholder="Protein"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Carbs</span>
                    <input
                      value={createFoodDraft.carbs}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                      placeholder="Carbs"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fat</span>
                    <input
                      value={createFoodDraft.fat}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                      placeholder="Fat"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Sugar</span>
                    <input
                      value={createFoodDraft.sugar}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, sugar: event.target.value }))}
                      placeholder="Sugar"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fiber</span>
                    <input
                      value={createFoodDraft.fiber}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fiber: event.target.value }))}
                      placeholder="Fiber"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Saturated Fat</span>
                    <input
                      value={createFoodDraft.saturatedFat}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                      placeholder="Saturated fat"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={createCustomFood}
                    disabled={creatingFood}
                    className="accent-violet rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60 sm:col-span-2"
                  >
                    {creatingFood ? "Saving" : "Save Food"}
                  </button>
                </div>
              ) : dialogTab === "usda" ? (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                      id="food-search"
                      name="foodSearch"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") handleFoodSearch(); }}
                      className="min-w-[220px] flex-1 rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      placeholder="Search foods"
                    />
                    <button
                      type="button"
                      onClick={handleFoodSearch}
                      className="accent-violet rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110"
                    >
                      {searchLoading ? "Searching" : "Search"}
                    </button>
                  </div>

                  {searchError ? (
                    <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
                      {searchError}
                    </div>
                  ) : null}

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">
                        {searchPerformed ? `No results for "${searchQuery.trim()}".` : "Search for foods to add."}
                      </p>
                    ) : (
                      searchResults.map((result) => (
                        <div
                          key={result.fdcId}
                          className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">{result.description}</p>
                            {result.brandOwner ? (
                              <p className="mt-1 text-xs text-[var(--text-muted)]">{result.brandOwner}</p>
                            ) : null}
                            <p className="mt-2 text-xs text-[var(--text-muted)]">
                              {roundToWhole(result.calories)} cal · {formatGrams(result.protein)}p · {formatGrams(result.carbs)}c · {formatGrams(result.fat)}f
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addFoodResult(result)}
                            className="accent-violet rounded-xl px-3 py-2 text-xs font-semibold transition hover:brightness-110"
                          >
                            Add to {meals.find((meal) => meal.key === (activeMealDialog ?? searchMeal))?.label}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4">
                    <input
                      value={dialogSearch}
                      onChange={(event) => setDialogSearch(event.target.value)}
                      placeholder={dialogTab === "recent" ? "Search recent foods" : "Search my foods"}
                      className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {dialogLoading ? (
                      <p className="text-sm text-[var(--text-muted)]">Loading foods...</p>
                    ) : dialogFoods.length === 0 ? (
                      <p className="rounded-lg border border-[var(--line)] px-4 py-4 text-sm text-[var(--text-muted)]">No foods found. Try a different search.</p>
                    ) : (
                      dialogFoods.map((food) => {
                        const rowKey = `${dialogTab}-${food.id}`;
                        const defaultQty = formatServingSize(toEntryQuantity(food.quantity));
                        const draftValue = quantityDrafts[rowKey] ?? defaultQty;
                        const draftServings = Number(draftValue);
                        const fallbackServings = toEntryQuantity(food.quantity);
                        const effectiveServings = Number.isFinite(draftServings) && draftServings > 0 ? draftServings : fallbackServings;
                        const totalAmount = formatTotalAmount(effectiveServings, food.serving_size, food.serving_unit);
                        const caloriesTotal = roundToWhole(toNumber(food.calories) * effectiveServings);
                        const proteinTotal = formatGrams(toNumber(food.protein) * effectiveServings);
                        const carbsTotal = formatGrams(toNumber(food.carbs) * effectiveServings);
                        const fatTotal = formatGrams(toNumber(food.fat) * effectiveServings);
                        const isAdding = addingFoodKey === rowKey;
                        const justAdded = addedFlashKey === rowKey;
                        return (
                        <div
                          key={rowKey}
                          className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <span className="block text-sm font-semibold leading-snug text-[var(--text)]">{food.name}</span>
                            {food.serving_size != null || (food.serving_unit ?? "").trim() ? (
                              <span className="mt-0.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                {formatServing(food.serving_size, food.serving_unit)}
                                {totalAmount && draftServings !== 1 ? (
                                  <span className="ml-1.5 text-[var(--text-muted)]">· total {totalAmount}</span>
                                ) : null}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">
                              {caloriesTotal} cal · {proteinTotal}p · {carbsTotal}c · {fatTotal}f
                              {totalAmount ? <span className="ml-1.5">· {totalAmount}</span> : null}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)]/70 pt-3">
                            {activeMealDialog ? (
                              <>
                                <div className="mr-auto flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label="Decrease servings"
                                    onClick={() =>
                                      setQuantityDrafts((prev) => {
                                        const current = Number(prev[rowKey] ?? defaultQty);
                                        const base = Number.isFinite(current) ? current : Number(defaultQty);
                                        const next = Math.max(1, Math.round(base) - 1);
                                        return { ...prev, [rowKey]: formatServingSize(next) };
                                      })
                                    }
                                    className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={draftValue}
                                    onChange={(event) =>
                                      setQuantityDrafts((prev) => ({ ...prev, [rowKey]: event.target.value }))
                                    }
                                    onFocus={(event) => event.currentTarget.select()}
                                    aria-label="Servings"
                                    className="w-14 rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-2 py-1 text-center text-xs text-[var(--text)] focus:border-white/30 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Increase servings"
                                    onClick={() =>
                                      setQuantityDrafts((prev) => {
                                        const current = Number(prev[rowKey] ?? defaultQty);
                                        const base = Number.isFinite(current) ? current : Number(defaultQty);
                                        const next = Math.max(1, Math.round(base) + 1);
                                        return { ...prev, [rowKey]: formatServingSize(next) };
                                      })
                                    }
                                    className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                  {totalAmount ? totalAmount : "srv"}
                                </span>
                                <button
                                  type="button"
                                  disabled={isAdding}
                                  onClick={() => {
                                    const parsed = Number(draftValue);
                                    const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : toEntryQuantity(food.quantity);
                                    addLibraryFood(food, activeMealDialog, qty);
                                  }}
                                  className="accent-violet rounded-full px-3 py-1 text-xs font-semibold transition hover:brightness-110 disabled:opacity-60"
                                >
                                  {justAdded ? "Added ✓" : isAdding ? "Adding…" : "Add"}
                                </button>
                              </>
                            ) : null}
                            {dialogTab === "mine" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEditFood(food)}
                                  className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={dialogSaving}
                                  onClick={() => deleteFood(food.id)}
                                  className="rounded-full border border-rose-500/30 bg-white/5 px-3 py-1 text-xs text-rose-400 transition hover:border-rose-500/50 disabled:opacity-60"
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                            {dialogTab === "recent" ? (
                              <button
                                type="button"
                                disabled={dialogSaving}
                                onClick={() => beginEditRecentFood(food)}
                                className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {editingFoodId ? (
                <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Edit Food</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Food Name</span>
                      <input
                        value={editFoodDraft.name}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Food name"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Amount per Serving</span>
                      <input
                        value={editFoodDraft.servingSize}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, servingSize: event.target.value }))}
                        placeholder="e.g. 84"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                      <span className="block text-[10px] text-[var(--text-soft)]">How much is in one serving (e.g. 84 grams).</span>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Unit</span>
                      <select
                        value={editFoodDraft.servingUnit}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, servingUnit: event.target.value }))}
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-white/30 focus:outline-none"
                      >
                        {SERVING_UNIT_OPTIONS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Calories</span>
                      <input
                        value={editFoodDraft.calories}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                        placeholder="Calories"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Protein</span>
                      <input
                        value={editFoodDraft.protein}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                        placeholder="Protein"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Carbs</span>
                      <input
                        value={editFoodDraft.carbs}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                        placeholder="Carbs"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fat</span>
                      <input
                        value={editFoodDraft.fat}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                        placeholder="Fat"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Sugar</span>
                      <input
                        value={editFoodDraft.sugar}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, sugar: event.target.value }))}
                        placeholder="Sugar"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fiber</span>
                      <input
                        value={editFoodDraft.fiber}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fiber: event.target.value }))}
                        placeholder="Fiber"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Saturated Fat</span>
                      <input
                        value={editFoodDraft.saturatedFat}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                        placeholder="Saturated fat"
                        inputMode="decimal"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={dialogSaving}
                        onClick={() => saveEditedFood(editingFoodId)}
                        className="accent-violet rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFoodId(null)}
                        className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}


        {manualEntryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="panel w-full max-w-md rounded-3xl p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">Manual tracking</p>
                  <h3 className="mt-1 text-2xl font-semibold leading-tight text-[var(--text)]">Quick add macros</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setManualEntryOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                  aria-label="Close manual tracking"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Log the macros you consumed today. Calories are calculated automatically.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {([
                  { key: "protein", label: "Protein (g)" },
                  { key: "carbs", label: "Carbs (g)" },
                  { key: "fat", label: "Fat (g)" },
                  { key: "fiber", label: "Fiber (g)" },
                ] as const).map((field) => (
                  <label key={field.key} className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{field.label}</span>
                    <input
                      value={manualMacros[field.key]}
                      onChange={(event) =>
                        setManualMacros((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--text-muted)]">Calories</span>
                <span className="text-lg font-bold tabular-nums text-[var(--text)]">
                  {manualEntryCalories.toLocaleString()} kcal
                </span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualEntryOpen(false)}
                  className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitManualEntry()}
                  disabled={savingManualEntry}
                  className="accent-pink rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
                >
                  {savingManualEntry ? "Logging" : "Log macros"}
                </button>
              </div>
            </div>
          </div>
        )}

        {copyDialogMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <Panel padding="lg" className="w-full max-w-md shadow-[var(--shadow-lg)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Copy Meal</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">
                    Copy {meals.find((meal) => meal.key === copyDialogMeal)?.label}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCopyDialogMeal(null)}
                  className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block space-y-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Target Date
                  <input
                    type="date"
                    value={copyTargetDate}
                    onChange={(event) => setCopyTargetDate(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-white/30 focus:outline-none"
                  />
                </label>

                <label className="block space-y-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Target Meal
                  <select
                    value={copyTargetMeal}
                    onChange={(event) => setCopyTargetMeal(event.target.value as MealKey)}
                    className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-white/30 focus:outline-none"
                  >
                    {meals.map((meal) => (
                      <option key={`copy-target-${meal.key}`} value={meal.key}>
                        {meal.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCopyDialogMeal(null)}
                  className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitCopyMeal()}
                  disabled={copyingMeal === copyDialogMeal}
                  className="accent-pink rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
                >
                  {copyingMeal === copyDialogMeal ? "Copying" : "Copy Meal"}
                </button>
              </div>
            </Panel>
          </div>
        )}
      </section>
    </SidebarShell>
  );
}
