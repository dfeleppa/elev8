"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";

import SidebarShell from "@/components/SidebarShell";
import { AccentCard, Chip, Panel, Micro } from "@/components/ui";

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
  fiber?: number | null;
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
  quantity?: number | null;
};

type CoachPlanSummary = {
  goalType?: string | null;
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  effectiveDate?: string | null;
  lastCheckInDate?: string | null;
  nextCheckInDate?: string | null;
};

type GoalType =
  | "lose_weight"
  | "gain_weight"
  | "maintain_weight"
  | "performance_reverse_diet";

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "lose_weight", label: "Lose Weight" },
  { value: "gain_weight", label: "Gain Weight" },
  { value: "maintain_weight", label: "Maintain Weight" },
  { value: "performance_reverse_diet", label: "Performance / Reverse Diet" },
];

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

function formatServingSize(value: number) {
  return value.toFixed(2);
}

function formatDecimal(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
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
  const [coachSettingsOpen, setCoachSettingsOpen] = useState(false);
  const [coachSettingsGoal, setCoachSettingsGoal] = useState<GoalType>("lose_weight");
  const [coachSettingsSaving, setCoachSettingsSaving] = useState(false);
  const [coachSettingsError, setCoachSettingsError] = useState<string | null>(null);
  const [foodDialogOpen, setFoodDialogOpen] = useState(false);
  const [activeMealDialog, setActiveMealDialog] = useState<MealKey | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editServingDraft, setEditServingDraft] = useState("");
  const [dialogTab, setDialogTab] = useState<"recent" | "mine" | "create" | "usda">("recent");
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
  const [createFoodDraft, setCreateFoodDraft] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    sugar: "",
    fiber: "",
    saturatedFat: "",
  });
  const [creatingFood, setCreatingFood] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editFoodDraft, setEditFoodDraft] = useState({
    name: "",
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
  });

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
        if (s?.goalType) setCoachSettingsGoal(s.goalType as GoalType);
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

  const FIBER_DEFAULT_TARGET = 30;
  const fiberProgress = clampPercent((totals.fiber / FIBER_DEFAULT_TARGET) * 100);

  const macroBars = [
    { label: "Protein", value: totals.protein, target: targetNumbers.protein, progress: proteinProgress },
    { label: "Carbs", value: totals.carbs, target: targetNumbers.carbs, progress: carbsProgress },
    { label: "Fat", value: totals.fat, target: targetNumbers.fat, progress: fatProgress },
    { label: "Fiber", value: totals.fiber, target: FIBER_DEFAULT_TARGET, progress: fiberProgress },
  ];

  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
  const isSelectedDateToday = toLocalDateInputValue(new Date()) === selectedDate;
  const selectedDayName = selectedDateObj.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const macroCardLabel = isSelectedDateToday
    ? `TODAY · ${selectedDayName}`
    : selectedDateObj
        .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
        .toUpperCase();

  const MEAL_CHIP_TONE: Record<MealKey, "pink" | "violet" | "lime" | "neutral"> = {
    breakfast: "pink",
    lunch: "violet",
    dinner: "neutral",
    snack: "lime",
  };

  const coachWeights = {
    start: Number(coachPlanSummary?.startWeight ?? 0),
    trend: Number(coachPlanSummary?.currentWeight ?? coachPlanSummary?.startWeight ?? 0),
    goal: Number(
      coachPlanSummary?.targetWeight ?? coachPlanSummary?.currentWeight ?? coachPlanSummary?.startWeight ?? 0
    ),
  };

  const coachGoalLabel = formatGoalLabel(coachPlanSummary?.goalType);

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

  async function saveCoachSettings() {
    setCoachSettingsSaving(true);
    setCoachSettingsError(null);
    try {
      const res = await fetch("/api/athlete/coach-plan-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType: coachSettingsGoal }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save.");
      setCoachPlanSummary((prev) =>
        prev ? { ...prev, goalType: coachSettingsGoal } : prev
      );
      setCoachSettingsOpen(false);
    } catch (err) {
      setCoachSettingsError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setCoachSettingsSaving(false);
    }
  }

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
    const query = searchQuery.trim();
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
      setSearchResults(payload.results ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Food search failed.");
    } finally {
      setSearchLoading(false);
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
        fiber: result.fiber ?? null,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Failed to add entry.");
      return;
    }

    setEntries((prev) => [...prev, payload.entry]);
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
          fiber: food.fiber ?? null,
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
      calories: food.calories?.toString() ?? "",
      protein: food.protein?.toString() ?? "",
      carbs: food.carbs?.toString() ?? "",
      fat: food.fat?.toString() ?? "",
      sugar: food.sugar?.toString() ?? "",
      fiber: food.fiber?.toString() ?? "",
      saturatedFat: food.saturated_fat?.toString() ?? "",
    });
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
    <SidebarShell mainClassName="mx-auto w-full max-w-6xl px-5 py-10 lg:py-16">
      <section className="space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--text)]">Nutrition</h1>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Plan meals, track macros, and stay on target.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label="Previous day"
            >
              &lt;
            </button>
            <input
              id="nutrition-date"
              name="nutritionDate"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] shadow-inner focus:border-white/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(toLocalDateInputValue(new Date()))}
              className="rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label="Next day"
            >
              &gt;
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <AccentCard tone="pink">
            <div className="flex items-start justify-between gap-3">
              <Micro onAccent as="p">{macroCardLabel}</Micro>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/10 px-3.5 py-1.5 text-xs font-semibold">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
                {roundToWhole(Math.max(0, remaining.calories))} kcal to go
              </span>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex items-center justify-center">
                <div className="relative grid h-44 w-44 place-items-center">
                  <svg className="absolute inset-0" viewBox="0 0 176 176" aria-hidden="true">
                    <g transform="rotate(-90 88 88)">
                      <circle cx="88" cy="88" r="76" fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="12" />
                      <circle
                        cx="88"
                        cy="88"
                        r="76"
                        fill="none"
                        stroke="#230012"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={ringDashArray(caloriesProgress, 76)}
                      />
                    </g>
                  </svg>
                  <div className="text-center">
                    <p className="text-4xl font-bold leading-none tracking-tight">
                      {roundToWhole(totals.calories).toLocaleString()}
                    </p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] opacity-60">
                      of {roundToWhole(targetNumbers.calories || 0).toLocaleString()} kcal
                    </p>
                    <p className="mt-1 text-sm font-semibold">{Math.round(caloriesProgress)}%</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {macroBars.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm">{bar.label}</p>
                      <p className="text-sm font-bold tabular-nums">
                        {roundToWhole(bar.value)}/{roundToWhole(bar.target)}g
                      </p>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/15">
                      <div
                        className="h-full rounded-full bg-black/70 transition-[width] duration-500"
                        style={{ width: `${bar.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] tabular-nums opacity-60">{Math.round(bar.progress)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </AccentCard>

          {coachPlanStatus === "none" ? (
            <Panel padding="lg" className="hover-lift flex h-full flex-col items-center justify-center">
              <Link
                        href="/member/nutrition-coach"
                className="accent-pink rounded-full px-6 py-2.5 text-sm font-semibold transition hover:brightness-110"
                      >
                        Nutrition Coach
              </Link>
            </Panel>
          ) : coachPlanStatus === "loading" ? (
            <Panel padding="lg" className="hover-lift flex h-full flex-col items-center justify-center">
              <p className="text-sm text-[var(--text-muted)]">Loading coach plan...</p>
            </Panel>
          ) : (
            <AccentCard tone="violet" className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <Micro onAccent as="p">
                  COACH · {coachGoalLabel.toUpperCase()}
                </Micro>
                <span className="text-[11px] font-semibold opacity-70">
                  {Math.round(weightProgressPercent)}% to goal
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-bold leading-none tracking-tight">
                  {formatDecimal(coachWeights.trend)}
                </span>
                <span className="text-xs opacity-70">
                  of {formatDecimal(coachWeights.goal)} lb goal
                </span>
              </div>

              <div className="mt-5 grid grid-cols-10 gap-1.5">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={`coach-check-bar-${index}`}
                    className={`h-10 rounded-[3px] ${
                      index < checkInTimeline.filledBars ? "bg-[#140a2e]" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>

              <p className="mt-2 text-[11px] opacity-70">
                {checkInTimeline.daysUntilNext === 0
                  ? "Check-in due today"
                  : `${checkInTimeline.daysUntilNext} day${checkInTimeline.daysUntilNext === 1 ? "" : "s"} until next check-in`}
              </p>

              <button
                type="button"
                onClick={() => setCoachSettingsOpen(true)}
                className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-[#140a2e] py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Coach settings
              </button>
            </AccentCard>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {meals.map((meal) => {
            const mealEntries = entries.filter((entry) => entry.meal_type === meal.key);
            const mealTotals = mealEntries.reduce(
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
            const hasEntries = mealEntries.length > 0;

            return (
              <Panel key={meal.key} padding="md" className="hover-lift relative flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Chip tone={MEAL_CHIP_TONE[meal.key]}>{meal.label}</Chip>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setMealMenuOpen((current) => (current === meal.key ? null : meal.key))}
                      className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
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
                      className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                      aria-label={`Add to ${meal.label}`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {mealMenuOpen === meal.key ? (
                  <div className="absolute right-3 top-12 z-20 w-44 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-2)] shadow-lg">
                    <button
                      type="button"
                      onClick={() => void deleteMealEntries(meal.key)}
                      className="block w-full px-4 py-3 text-left text-sm text-rose-400 transition hover:bg-white/5"
                    >
                      Delete meal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMealMenuOpen(null);
                        setCopyDialogMeal(meal.key);
                        setCopyTargetDate(selectedDate);
                        setCopyTargetMeal(meal.key);
                      }}
                      disabled={copyingMeal === meal.key}
                      className="block w-full px-4 py-3 text-left text-sm text-[var(--text)] transition hover:bg-[var(--panel)] disabled:opacity-60"
                    >
                      {copyingMeal === meal.key ? "Copying..." : "Copy meal"}
                    </button>
                  </div>
                ) : null}

                {hasEntries ? (
                  <>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold leading-none tracking-tight text-[var(--text)]">
                        {Math.round(mealTotals.calories).toLocaleString()}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">kcal</span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {mealEntries.map((entry) => {
                        const quantity = toEntryQuantity(entry.quantity);
                        const entryCal = roundToWhole((entry.calories ?? 0) * quantity);
                        const entryP = roundToWhole((entry.protein ?? 0) * quantity);
                        const entryC = roundToWhole((entry.carbs ?? 0) * quantity);
                        const entryF = roundToWhole((entry.fat ?? 0) * quantity);
                        const isEditingServing = editingEntryId === entry.id;
                        return (
                          <div key={entry.id} className="group">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm text-[var(--text)]">{entry.entry_name}</p>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold tabular-nums text-[var(--text)]">{entryCal}</p>
                                <button
                                  type="button"
                                  onClick={() => deleteEntry(entry.id)}
                                  className="rounded-full p-0.5 text-[var(--text-soft)] opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                                  aria-label="Remove entry"
                                >
                                  <X className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-0.5 flex items-baseline justify-between gap-3">
                              <div className="flex items-center gap-1 text-[11px] text-[var(--text-soft)]">
                                {isEditingServing ? (
                                  <>
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
                                      className="w-12 rounded border border-[var(--line-strong)] bg-[var(--panel-2)] px-1 py-0.5 text-[11px] text-[var(--text)] focus:border-white/30 focus:outline-none"
                                      inputMode="decimal"
                                      aria-label="Edit serving size"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void saveServingSize(entry.id)}
                                      className="rounded-full p-0.5 text-[var(--text-muted)] transition hover:bg-[var(--panel)]"
                                      aria-label="Save serving size"
                                    >
                                      <Check className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span>{formatServingSize(quantity)}</span>
                                    <button
                                      type="button"
                                      onClick={() => openServingSizeEditor(entry.id, entry.quantity)}
                                      className="rounded-full p-0.5 text-[var(--text-soft)] opacity-0 transition hover:text-[var(--text)] group-hover:opacity-100"
                                      aria-label="Edit serving size"
                                    >
                                      <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                                    </button>
                                  </>
                                )}
                              </div>
                              <p className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                                P{entryP} · C{entryC} · F{entryF}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3">
                      <Micro as="p">Planned</Micro>
                    </div>
                    <div className="mt-auto flex flex-1 flex-col justify-end pt-8">
                      <button
                        type="button"
                        onClick={() => {
                          setMealMenuOpen(null);
                          openMealDialog(meal.key);
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] py-3 text-sm text-[var(--text-muted)] transition hover:bg-[var(--panel)] hover:text-[var(--text)]"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Log {meal.label.toLowerCase()}
                      </button>
                    </div>
                  </>
                )}
              </Panel>
            );
          })}
        </section>

        {foodDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-4 sm:items-center sm:py-6">
            <div className="panel my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    {activeMealDialog ? `Add To ${meals.find((meal) => meal.key === activeMealDialog)?.label}` : "Manage Foods"}
                  </p>
                  <h3 className="mt-1 text-3xl font-semibold leading-tight text-[var(--text)]">Search foods</h3>
                </div>
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
                        ? "border-[var(--cyan)]/40 bg-[var(--cyan)]/12 text-[var(--cyan)]"
                        : "border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {tab === "recent"
                      ? "Recents"
                      : tab === "mine"
                        ? "My foods"
                        : tab === "usda"
                          ? "USDA"
                          : "Create food"}
                  </button>
                ))}
              </div>

              {dialogTab === "create" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Calories</span>
                    <input
                      value={createFoodDraft.calories}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                      placeholder="Calories"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Protein</span>
                    <input
                      value={createFoodDraft.protein}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                      placeholder="Protein"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Carbs</span>
                    <input
                      value={createFoodDraft.carbs}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                      placeholder="Carbs"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fat</span>
                    <input
                      value={createFoodDraft.fat}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                      placeholder="Fat"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Sugar</span>
                    <input
                      value={createFoodDraft.sugar}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, sugar: event.target.value }))}
                      placeholder="Sugar"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fiber</span>
                    <input
                      value={createFoodDraft.fiber}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fiber: event.target.value }))}
                      placeholder="Fiber"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Saturated Fat</span>
                    <input
                      value={createFoodDraft.saturatedFat}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                      placeholder="Saturated fat"
                      inputMode="numeric"
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
                              {roundToWhole(result.calories)} cal · {roundToWhole(result.protein)}p · {roundToWhole(result.carbs)}c · {roundToWhole(result.fat)}f
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
                        const isAdding = addingFoodKey === rowKey;
                        const justAdded = addedFlashKey === rowKey;
                        return (
                        <div
                          key={rowKey}
                          className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-[var(--text)]">{food.name}</span>
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">
                              {roundToWhole(food.calories)} cal · {roundToWhole(food.protein)}p · {roundToWhole(food.carbs)}c · {roundToWhole(food.fat)}f
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {activeMealDialog ? (
                              <>
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
                                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">srv</span>
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
                          </span>
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
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Calories</span>
                      <input
                        value={editFoodDraft.calories}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                        placeholder="Calories"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Protein</span>
                      <input
                        value={editFoodDraft.protein}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                        placeholder="Protein"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Carbs</span>
                      <input
                        value={editFoodDraft.carbs}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                        placeholder="Carbs"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fat</span>
                      <input
                        value={editFoodDraft.fat}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                        placeholder="Fat"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Sugar</span>
                      <input
                        value={editFoodDraft.sugar}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, sugar: event.target.value }))}
                        placeholder="Sugar"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Fiber</span>
                      <input
                        value={editFoodDraft.fiber}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fiber: event.target.value }))}
                        placeholder="Fiber"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-white/30 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Saturated Fat</span>
                      <input
                        value={editFoodDraft.saturatedFat}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                        placeholder="Saturated fat"
                        inputMode="numeric"
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

        {coachSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <Panel padding="lg" className="w-full max-w-sm shadow-[var(--shadow-lg)]">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--text)]">Coach Settings</h3>
                <button
                  type="button"
                  onClick={() => setCoachSettingsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Goal</p>
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCoachSettingsGoal(opt.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      coachSettingsGoal === opt.value
                        ? "border-[var(--pink)]/40 bg-[var(--pink)]/10 text-[var(--pink)]"
                        : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        coachSettingsGoal === opt.value ? "bg-[var(--pink)]" : "bg-[var(--line-strong)]"
                      }`}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>

              {coachSettingsError && (
                <p className="mt-3 text-sm text-rose-400">{coachSettingsError}</p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={saveCoachSettings}
                  disabled={coachSettingsSaving}
                  className="accent-pink flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {coachSettingsSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setCoachSettingsOpen(false)}
                  disabled={coachSettingsSaving}
                  className="rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </Panel>
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
