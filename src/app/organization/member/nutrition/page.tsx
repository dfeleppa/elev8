"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";

import SidebarShell from "../../../../components/SidebarShell";

type NutritionDay = {
  id: string;
  day_date: string;
  calorie_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
};

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

type EntryDraft = {
  name: string;
  quantity: string;
};

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

const meals: { key: MealKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const emptyDraft: EntryDraft = {
  name: "",
  quantity: "1",
};

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
  const [day, setDay] = useState<NutritionDay | null>(null);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"consumed" | "remaining">("remaining");
  const [showSubMacros, setShowSubMacros] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMeal, setSearchMeal] = useState<MealKey>("lunch");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [coachPlanStatus, setCoachPlanStatus] = useState<"loading" | "has" | "none">("loading");
  const [coachPlanSummary, setCoachPlanSummary] = useState<CoachPlanSummary | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<MealKey | null>(null);
  const [copyDialogMeal, setCopyDialogMeal] = useState<MealKey | null>(null);
  const [mealMenuOpen, setMealMenuOpen] = useState<MealKey | null>(null);
  const [copyTargetDate, setCopyTargetDate] = useState(() => toLocalDateInputValue(new Date()));
  const [copyTargetMeal, setCopyTargetMeal] = useState<MealKey>("breakfast");
  const [coachMenuOpen, setCoachMenuOpen] = useState(false);
  const [coachCardExpanded, setCoachCardExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [foodDialogOpen, setFoodDialogOpen] = useState(false);
  const [activeMealDialog, setActiveMealDialog] = useState<MealKey | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editServingDraft, setEditServingDraft] = useState("");
  const [dialogTab, setDialogTab] = useState<"recent" | "mine" | "create" | "usda">("recent");
  const [dialogSearch, setDialogSearch] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [recentFoods, setRecentFoods] = useState<LibraryFood[]>([]);
  const [myFoods, setMyFoods] = useState<LibraryFood[]>([]);
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
  const [drafts, setDrafts] = useState<Record<MealKey, EntryDraft>>({
    breakfast: { ...emptyDraft },
    lunch: { ...emptyDraft },
    dinner: { ...emptyDraft },
    snack: { ...emptyDraft },
  });
  const [targets, setTargets] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    let isActive = true;
    setLoading(true);
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
        setDay(payload.day);
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
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    setCoachCardExpanded(isDesktop);
  }, []);

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
        setCoachPlanSummary((payload?.summary ?? null) as CoachPlanSummary | null);
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

  const calorieProgress = targetNumbers.calories
    ? clampPercent((totals.calories / targetNumbers.calories) * 100)
    : 0;

  const proteinProgress = targetNumbers.protein
    ? clampPercent((totals.protein / targetNumbers.protein) * 100)
    : 0;

  const carbsProgress = targetNumbers.carbs
    ? clampPercent((totals.carbs / targetNumbers.carbs) * 100)
    : 0;

  const fatProgress = targetNumbers.fat
    ? clampPercent((totals.fat / targetNumbers.fat) * 100)
    : 0;

  const macroRows = [
    {
      label: "Protein",
      value: totals.protein,
      target: targetNumbers.protein,
      remaining: remaining.protein,
      dotClass: "bg-cyan-400",
      gradientStart: "#67e8f9",
      gradientEnd: "#0e7490",
      progress: proteinProgress,
      subRows: [],
    },
    {
      label: "Carbs",
      value: totals.carbs,
      target: targetNumbers.carbs,
      remaining: remaining.carbs,
      dotClass: "bg-indigo-400",
      gradientStart: "#a5b4fc",
      gradientEnd: "#3730a3",
      progress: carbsProgress,
      subRows: [
        { label: "Fiber", value: totals.fiber },
        { label: "Sugar", value: totals.sugar },
      ],
    },
    {
      label: "Fat",
      value: totals.fat,
      target: targetNumbers.fat,
      remaining: remaining.fat,
      dotClass: "bg-amber-400",
      gradientStart: "#fde68a",
      gradientEnd: "#b45309",
      progress: fatProgress,
      subRows: [{ label: "Saturated Fat", value: totals.saturatedFat }],
    },
  ];

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

  async function addEntry(mealKey: MealKey) {
    const draft = drafts[mealKey];
    const name = draft.name.trim();
    if (!name) {
      setError("Entry name is required.");
      return;
    }

    const rawQuantity = Number(draft.quantity);
    const quantity = toEntryQuantity(Number.isFinite(rawQuantity) ? rawQuantity : 1);

    async function lookupFoodByName(foodName: string): Promise<LibraryFood | null> {
      const lower = foodName.toLowerCase();
      const exactFromLoaded = myFoods.find((food) => food.name.toLowerCase() === lower);
      if (exactFromLoaded) {
        return exactFromLoaded;
      }

      const mineResponse = await fetch("/api/foods");
      const minePayload = await mineResponse.json().catch(() => ({ foods: [] }));
      if (mineResponse.ok) {
        const foods: LibraryFood[] = minePayload.foods ?? [];
        setMyFoods(foods);
        const exact = foods.find((food) => food.name.toLowerCase() === lower);
        if (exact) {
          return exact;
        }
        const partial = foods.find((food) => food.name.toLowerCase().includes(lower));
        if (partial) {
          return partial;
        }
      }

      const searchResponse = await fetch(`/api/foods/search?query=${encodeURIComponent(foodName)}`);
      const searchPayload = await searchResponse.json().catch(() => ({ results: [] }));
      if (searchResponse.ok && Array.isArray(searchPayload.results) && searchPayload.results.length > 0) {
        const top = searchPayload.results[0] as FoodSearchResult;
        return {
          id: String(top.fdcId),
          name: top.brandOwner ? `${top.description} (${top.brandOwner})` : top.description,
          calories: top.calories,
          protein: top.protein,
          carbs: top.carbs,
          fat: top.fat,
          quantity: 1,
        };
      }

      return null;
    }

    const matchedFood = await lookupFoodByName(name);

    setError(null);
    const response = await fetch("/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: selectedDate,
        mealType: mealKey,
        name: matchedFood?.name ?? name,
        quantity,
        calories: matchedFood?.calories ?? null,
        protein: matchedFood?.protein ?? null,
        carbs: matchedFood?.carbs ?? null,
        fat: matchedFood?.fat ?? null,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Failed to add entry.");
      return;
    }

    setEntries((prev) => [...prev, payload.entry]);
    setDrafts((prev) => ({
      ...prev,
      [mealKey]: { ...emptyDraft },
    }));
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
          setDay(payload.day);
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
    async function loadFoodLibraries() {
      setDialogLoading(true);
      try {
        const [recentResponse, mineResponse] = await Promise.all([
          fetch("/api/foods/recent?limit=40"),
          fetch("/api/foods"),
        ]);

        const recentPayload = await recentResponse.json().catch(() => ({ items: [] }));
        const minePayload = await mineResponse.json().catch(() => ({ foods: [] }));

        if (recentResponse.ok) {
          setRecentFoods(recentPayload.items ?? []);
        }
        if (mineResponse.ok) {
          setMyFoods(minePayload.foods ?? []);
        }
      } finally {
        setDialogLoading(false);
      }
    }

    setFoodDialogOpen(true);
    setActiveMealDialog(mealKey);
    setDialogTab("recent");
    setDialogSearch("");
    await loadFoodLibraries();
  }

  async function openFoodManagerDialog() {
    setFoodDialogOpen(true);
    setActiveMealDialog(null);
    setDialogTab("mine");
    setDialogSearch("");
    setDialogLoading(true);
    try {
      const [recentResponse, mineResponse] = await Promise.all([
        fetch("/api/foods/recent?limit=40"),
        fetch("/api/foods"),
      ]);

      const recentPayload = await recentResponse.json().catch(() => ({ items: [] }));
      const minePayload = await mineResponse.json().catch(() => ({ foods: [] }));
      if (recentResponse.ok) {
        setRecentFoods(recentPayload.items ?? []);
      }
      if (mineResponse.ok) {
        setMyFoods(minePayload.foods ?? []);
      }
    } finally {
      setDialogLoading(false);
    }
  }

  async function addLibraryFood(food: LibraryFood, mealKey: MealKey) {
    setError(null);
    const response = await fetch("/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: selectedDate,
        mealType: mealKey,
        name: food.name,
        quantity: toEntryQuantity(food.quantity),
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Failed to add entry.");
      return;
    }

    setEntries((prev) => [...prev, payload.entry]);
    setFoodDialogOpen(false);
    setActiveMealDialog(null);
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
            <h1 className="text-3xl font-semibold text-slate-100">Nutrition</h1>
            <p className="mt-3 text-sm text-slate-400">
              Plan meals, track macros, and stay on target.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
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
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(toLocalDateInputValue(new Date()))}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              aria-label="Next day"
            >
              &gt;
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Macros</p>
              <div className="inline-flex rounded-full border border-slate-300 bg-white p-1">
                {(["consumed", "remaining"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                      viewMode === mode
                        ? "bg-gradient-to-r from-[#00c5ff] to-[#39a8ff] text-[#031525]"
                        : "bg-white text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {mode === "consumed" ? "Consumed" : "Remaining"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex items-center justify-center">
                <div className="relative grid h-48 w-48 place-items-center">
                  <svg className="absolute inset-0" viewBox="0 0 192 192" aria-hidden="true">
                    <defs>
                      <linearGradient id="proteinRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={macroRows[0].gradientStart} />
                        <stop offset="100%" stopColor={macroRows[0].gradientEnd} />
                      </linearGradient>
                      <linearGradient id="carbsRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={macroRows[1].gradientStart} />
                        <stop offset="100%" stopColor={macroRows[1].gradientEnd} />
                      </linearGradient>
                      <linearGradient id="fatRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={macroRows[2].gradientStart} />
                        <stop offset="100%" stopColor={macroRows[2].gradientEnd} />
                      </linearGradient>
                    </defs>

                    <g transform="rotate(-90 96 96)">
                      <circle cx="96" cy="96" r="84" fill="none" stroke="rgba(186, 208, 236, 0.45)" strokeWidth="8" />
                      <circle
                        cx="96"
                        cy="96"
                        r="84"
                        fill="none"
                        stroke="url(#proteinRingGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringDashArray(macroRows[0].progress, 84)}
                      />

                      <circle cx="96" cy="96" r="68" fill="none" stroke="rgba(186, 208, 236, 0.45)" strokeWidth="8" />
                      <circle
                        cx="96"
                        cy="96"
                        r="68"
                        fill="none"
                        stroke="url(#carbsRingGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringDashArray(macroRows[1].progress, 68)}
                      />

                      <circle cx="96" cy="96" r="52" fill="none" stroke="rgba(186, 208, 236, 0.45)" strokeWidth="8" />
                      <circle
                        cx="96"
                        cy="96"
                        r="52"
                        fill="none"
                        stroke="url(#fatRingGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringDashArray(macroRows[2].progress, 52)}
                      />
                    </g>
                  </svg>

                  <div
                    className="relative z-10 grid h-[86px] w-[86px] place-items-center rounded-full border border-slate-200 bg-white text-center"
                  >
                    <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white text-center">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cal</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {roundToWhole(viewMode === "consumed" ? totals.calories : remaining.calories)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {roundToWhole(targetNumbers.calories || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3">
                  {macroRows.map((macro) => (
                    <div key={macro.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${macro.dotClass}`} />
                          <p className="text-sm text-slate-700">{macro.label}</p>
                        </div>
                        <p
                          className={`text-sm ${
                            viewMode === "remaining" && macro.remaining < 0
                              ? "font-semibold text-rose-600"
                              : "text-slate-400"
                          }`}
                        >
                          {roundToWhole(viewMode === "consumed" ? macro.value : macro.remaining)} / {roundToWhole(macro.target)}
                        </p>
                      </div>
                      {showSubMacros && macro.subRows.length > 0 ? (
                        <div className="pl-6">
                          {macro.subRows.map((sub) => (
                            <div key={`${macro.label}-${sub.label}`} className="flex items-center justify-between">
                              <p className="text-xs text-slate-500">{sub.label}</p>
                              <p className="text-xs text-slate-500">{sub.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubMacros((current) => !current)}
                  className="inline-flex items-center gap-1 self-start rounded-md px-1 py-0.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-pressed={showSubMacros}
                  aria-label="Toggle nutrients"
                >
                  <span>Nutrients</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showSubMacros ? "rotate-180" : "rotate-0"}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>

          {coachPlanStatus === "none" ? (
            <div className="relative flex h-full flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <Link
                href="/organization/coach"
                className="rounded-full bg-gradient-to-r from-[#00c5ff] to-[#39a8ff] px-6 py-2.5 text-sm font-semibold text-[#031525] transition hover:brightness-110"
              >
                Coach Setup
              </Link>
            </div>
          ) : coachPlanStatus === "loading" ? (
            <div className="relative flex h-full flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Loading coach plan...</p>
            </div>
          ) : (
            <div className="relative flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Coach</p>
                <p className="mt-1 text-sm text-slate-600">{coachGoalLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCoachCardExpanded((expanded) => !expanded)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                  aria-expanded={coachCardExpanded}
                  aria-label={coachCardExpanded ? "Collapse coach card" : "Expand coach card"}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${coachCardExpanded ? "rotate-180" : "rotate-0"}`}
                    aria-hidden="true"
                  />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCoachMenuOpen((open) => !open)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                    aria-label="Coach card menu"
                    aria-expanded={coachMenuOpen}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.7" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                      <circle cx="12" cy="19" r="1.7" fill="currentColor" />
                    </svg>
                  </button>
                  {coachMenuOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      <a
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setCoachMenuOpen(false);
                        }}
                        className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        Coach settings
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {coachCardExpanded ? (
              <>
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Weight Progress</p>
                    <p className="text-xs font-semibold text-slate-600">{Math.round(weightProgressPercent)}% to goal</p>
                  </div>

                  <div className="flex items-center">
                    <div className="grid w-full grid-cols-[auto_1fr_auto_1fr_auto] items-center">
                      <div className="flex min-w-[52px] flex-col items-center sm:min-w-[64px]">
                        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-sky-300 bg-sky-50 text-[10px] font-semibold text-sky-700 sm:h-10 sm:w-10 sm:text-xs">
                          {formatDecimal(coachWeights.start)}
                        </span>
                        <span className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">Start</span>
                      </div>

                      <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-slate-200 sm:mx-2">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-500"
                          style={{ width: `${Math.min(100, weightProgressPercent * 2)}%` }}
                        />
                      </div>

                      <div className="flex min-w-[52px] flex-col items-center sm:min-w-[64px]">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-semibold sm:h-10 sm:w-10 sm:text-xs ${
                            weightProgressPercent > 0
                              ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                              : "border-slate-300 bg-slate-50 text-slate-500"
                          }`}
                        >
                          {formatDecimal(coachWeights.trend)}
                        </span>
                        <span className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">Current</span>
                      </div>

                      <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-slate-200 sm:mx-2">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-500"
                          style={{ width: `${Math.max(0, (weightProgressPercent - 50) * 2)}%` }}
                        />
                      </div>

                      <div className="flex min-w-[52px] flex-col items-center sm:min-w-[64px]">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-semibold sm:h-10 sm:w-10 sm:text-xs ${
                            weightProgressPercent >= 100
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {formatDecimal(coachWeights.goal)}
                        </span>
                        <span className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">Goal</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex flex-col gap-1 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                    <p>Last check-in: {checkInTimeline.lastDateLabel}</p>
                    <p>Next check-in: {checkInTimeline.nextDateLabel}</p>
                  </div>

                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <span
                        key={`check-bar-${index}`}
                        className={`h-2 rounded-full ${
                          index < checkInTimeline.filledBars
                            ? "bg-gradient-to-r from-sky-400 to-cyan-500"
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {checkInTimeline.daysUntilNext === 0
                      ? "Check-in due today"
                      : `${checkInTimeline.daysUntilNext} day${checkInTimeline.daysUntilNext === 1 ? "" : "s"} until next check-in`}
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">Coach</p>
              </div>
            )}
          </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
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

            return (
              <div key={meal.key} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.3em] text-slate-400">{meal.label}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {Math.round(mealTotals.calories)} Cal, {Math.round(mealTotals.protein)}p, {Math.round(mealTotals.carbs)}c, {Math.round(mealTotals.fat)}f
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMealMenuOpen((current) => (current === meal.key ? null : meal.key))}
                      className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
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
                      className="rounded-full bg-gradient-to-r from-[#00c5ff] to-[#39a8ff] px-5 py-2 text-sm font-semibold text-[#031525] transition hover:brightness-110"
                    >
                      Add
                    </button>
                  </div>

                  {mealMenuOpen === meal.key ? (
                    <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={() => void deleteMealEntries(meal.key)}
                        className="block w-full px-4 py-3 text-left text-base text-rose-600 transition hover:bg-rose-50"
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
                      className="block w-full px-4 py-3 text-left text-base text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {copyingMeal === meal.key ? "Copying..." : "Copy meal"}
                    </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {mealEntries.length === 0 ? (
                    <p className="text-sm text-slate-400">No entries yet.</p>
                  ) : (
                    mealEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.entry_name}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {roundToWhole((entry.calories ?? 0) * toEntryQuantity(entry.quantity))} cal · {roundToWhole((entry.protein ?? 0) * toEntryQuantity(entry.quantity))}p · {roundToWhole((entry.carbs ?? 0) * toEntryQuantity(entry.quantity))}c · {roundToWhole((entry.fat ?? 0) * toEntryQuantity(entry.quantity))}f
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1">
                            <span className="text-[11px] text-slate-500">Serving</span>
                            {editingEntryId === entry.id ? (
                              <>
                                <input
                                  value={editServingDraft}
                                  onChange={(event) => setEditServingDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      void saveServingSize(entry.id);
                                    }
                                    if (event.key === "Escape") {
                                      setEditingEntryId(null);
                                      setEditServingDraft("");
                                    }
                                  }}
                                  className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                                  inputMode="decimal"
                                  aria-label="Edit serving size"
                                />
                                <button
                                  type="button"
                                  onClick={() => void saveServingSize(entry.id)}
                                  className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                                  aria-label="Save serving size"
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs font-medium text-slate-700">
                                  {formatServingSize(toEntryQuantity(entry.quantity))}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openServingSizeEditor(entry.id, entry.quantity)}
                                  className="rounded-full p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                                  aria-label="Edit serving size"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            className="text-xs text-slate-500 transition hover:text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {foodDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-4 sm:items-center sm:py-6">
            <div className="my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {activeMealDialog ? `Add To ${meals.find((meal) => meal.key === activeMealDialog)?.label}` : "Manage Foods"}
                  </p>
                  <h3 className="mt-1 text-3xl font-semibold leading-tight text-slate-900">Search foods</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFoodDialogOpen(false);
                    setActiveMealDialog(null);
                    setEditingFoodId(null);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 text-lg text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
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
                        ? "border-[#0b3da8] bg-[#0b3da8] text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
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
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Food Name</span>
                    <input
                      value={createFoodDraft.name}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Food name"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Calories</span>
                    <input
                      value={createFoodDraft.calories}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                      placeholder="Calories"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Protein</span>
                    <input
                      value={createFoodDraft.protein}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                      placeholder="Protein"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Carbs</span>
                    <input
                      value={createFoodDraft.carbs}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                      placeholder="Carbs"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Fat</span>
                    <input
                      value={createFoodDraft.fat}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                      placeholder="Fat"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sugar</span>
                    <input
                      value={createFoodDraft.sugar}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, sugar: event.target.value }))}
                      placeholder="Sugar"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Fiber</span>
                    <input
                      value={createFoodDraft.fiber}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fiber: event.target.value }))}
                      placeholder="Fiber"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Saturated Fat</span>
                    <input
                      value={createFoodDraft.saturatedFat}
                      onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                      placeholder="Saturated fat"
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={createCustomFood}
                    disabled={creatingFood}
                    className="rounded-2xl bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 sm:col-span-2"
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
                      className="min-w-[220px] flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                      placeholder="Search foods"
                    />
                    <button
                      type="button"
                      onClick={handleFoodSearch}
                      className="rounded-2xl bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      {searchLoading ? "Searching" : "Search"}
                    </button>
                  </div>

                  {searchError ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-700">
                      {searchError}
                    </div>
                  ) : null}

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-slate-600">
                        {searchPerformed ? `No results for "${searchQuery.trim()}".` : "Search for foods to add."}
                      </p>
                    ) : (
                      searchResults.map((result) => (
                        <div
                          key={result.fdcId}
                          className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{result.description}</p>
                            {result.brandOwner ? (
                              <p className="mt-1 text-xs text-slate-600">{result.brandOwner}</p>
                            ) : null}
                            <p className="mt-2 text-xs text-slate-600">
                              {roundToWhole(result.calories)} cal · {roundToWhole(result.protein)}p · {roundToWhole(result.carbs)}c · {roundToWhole(result.fat)}f
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addFoodResult(result)}
                            className="rounded-xl bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-100 px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {dialogLoading ? (
                      <p className="text-sm text-slate-700">Loading foods...</p>
                    ) : dialogFoods.length === 0 ? (
                      <p className="rounded-lg border border-slate-200 px-4 py-4 text-sm text-slate-700">No foods found. Try a different search.</p>
                    ) : (
                      dialogFoods.map((food) => (
                        <div
                          key={`${dialogTab}-${food.id}`}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">{food.name}</span>
                            <span className="mt-1 block text-xs text-slate-600">
                              {roundToWhole(food.calories)} cal · {roundToWhole(food.protein)}p · {roundToWhole(food.carbs)}c · {roundToWhole(food.fat)}f
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {activeMealDialog ? (
                              <button
                                type="button"
                                onClick={() => addLibraryFood(food, activeMealDialog)}
                                className="rounded-full bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110"
                              >
                                Add
                              </button>
                            ) : null}
                            {dialogTab === "mine" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEditFood(food)}
                                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={dialogSaving}
                                  onClick={() => deleteFood(food.id)}
                                  className="rounded-full border border-rose-300 px-3 py-1 text-xs text-rose-700 transition hover:border-rose-400 hover:text-rose-800 disabled:opacity-60"
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {editingFoodId ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-600">Edit Food</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Food Name</span>
                      <input
                        value={editFoodDraft.name}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Food name"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Calories</span>
                      <input
                        value={editFoodDraft.calories}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                        placeholder="Calories"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Protein</span>
                      <input
                        value={editFoodDraft.protein}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                        placeholder="Protein"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Carbs</span>
                      <input
                        value={editFoodDraft.carbs}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                        placeholder="Carbs"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Fat</span>
                      <input
                        value={editFoodDraft.fat}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                        placeholder="Fat"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sugar</span>
                      <input
                        value={editFoodDraft.sugar}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, sugar: event.target.value }))}
                        placeholder="Sugar"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Fiber</span>
                      <input
                        value={editFoodDraft.fiber}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fiber: event.target.value }))}
                        placeholder="Fiber"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Saturated Fat</span>
                      <input
                        value={editFoodDraft.saturatedFat}
                        onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, saturatedFat: event.target.value }))}
                        placeholder="Saturated fat"
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                      />
                    </label>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={dialogSaving}
                        onClick={() => saveEditedFood(editingFoodId)}
                        className="rounded-2xl bg-gradient-to-r from-[#2fa8e8] to-[#0b3da8] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFoodId(null)}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
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

        {copyDialogMeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Copy Meal</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-100">
                    Copy {meals.find((meal) => meal.key === copyDialogMeal)?.label}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCopyDialogMeal(null)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  Target Date
                  <input
                    type="date"
                    value={copyTargetDate}
                    onChange={(event) => setCopyTargetDate(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                  />
                </label>

                <label className="block space-y-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  Target Meal
                  <select
                    value={copyTargetMeal}
                    onChange={(event) => setCopyTargetMeal(event.target.value as MealKey)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
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
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitCopyMeal()}
                  disabled={copyingMeal === copyDialogMeal}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20 disabled:opacity-60"
                >
                  {copyingMeal === copyDialogMeal ? "Copying" : "Copy Meal"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </SidebarShell>
  );
}
