"use client";

import { useEffect, useMemo, useState } from "react";

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
  quantity?: number | null;
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

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toEntryQuantity(value: number | null | undefined) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.max(0.01, Math.round(parsed * 100) / 100);
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

export default function HealthNutritionPage() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue(new Date()));
  const [day, setDay] = useState<NutritionDay | null>(null);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"consumed" | "remaining">("remaining");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMeal, setSearchMeal] = useState<MealKey>("lunch");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [copyingMeal, setCopyingMeal] = useState<MealKey | null>(null);
  const [copyDialogMeal, setCopyDialogMeal] = useState<MealKey | null>(null);
  const [mealMenuOpen, setMealMenuOpen] = useState<MealKey | null>(null);
  const [copyTargetDate, setCopyTargetDate] = useState(() => toLocalDateInputValue(new Date()));
  const [copyTargetMeal, setCopyTargetMeal] = useState<MealKey>("breakfast");
  const [foodDialogOpen, setFoodDialogOpen] = useState(false);
  const [activeMealDialog, setActiveMealDialog] = useState<MealKey | null>(null);
  const [dialogTab, setDialogTab] = useState<"recent" | "mine" | "create">("recent");
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
  });
  const [creatingFood, setCreatingFood] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [editFoodDraft, setEditFoodDraft] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
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

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const quantity = toEntryQuantity(entry.quantity);
        acc.calories += toNumber(entry.calories) * quantity;
        acc.protein += toNumber(entry.protein) * quantity;
        acc.carbs += toNumber(entry.carbs) * quantity;
        acc.fat += toNumber(entry.fat) * quantity;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [entries]);

  const targetNumbers = {
    calories: targets.calories ? Number(targets.calories) : 0,
    protein: targets.protein ? Number(targets.protein) : 0,
    carbs: targets.carbs ? Number(targets.carbs) : 0,
    fat: targets.fat ? Number(targets.fat) : 0,
  };

  const remaining = {
    calories: Math.max(0, targetNumbers.calories - totals.calories),
    protein: Math.max(0, targetNumbers.protein - totals.protein),
    carbs: Math.max(0, targetNumbers.carbs - totals.carbs),
    fat: Math.max(0, targetNumbers.fat - totals.fat),
  };

  const calorieProgress = targetNumbers.calories
    ? clampPercent((totals.calories / targetNumbers.calories) * 100)
    : 0;

  const macroRows = [
    { label: "Protein", value: totals.protein, target: targetNumbers.protein, remaining: remaining.protein, color: "bg-cyan-400" },
    { label: "Carbs", value: totals.carbs, target: targetNumbers.carbs, remaining: remaining.carbs, color: "bg-indigo-400" },
    { label: "Fat", value: totals.fat, target: targetNumbers.fat, remaining: remaining.fat, color: "bg-amber-400" },
  ];

  async function saveTargets() {
    setSavingTargets(true);
    setError(null);
    try {
      const response = await fetch("/api/nutrition-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayDate: selectedDate,
          calorieTarget: targets.calories,
          proteinTarget: targets.protein,
          carbsTarget: targets.carbs,
          fatTarget: targets.fat,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save targets.");
      }
      setDay(payload.day);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targets.");
    } finally {
      setSavingTargets(false);
    }
  }

  async function addEntry(mealKey: MealKey) {
    const draft = drafts[mealKey];
    const name = draft.name.trim();
    if (!name) {
      setError("Entry name is required.");
      return;
    }

    const rawQuantity = Number(draft.quantity);
    const quantity = Math.max(0.01, Number.isFinite(rawQuantity) ? rawQuantity : 1);

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
    setError(null);
    const response = await fetch("/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: selectedDate,
        mealType: searchMeal,
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
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Failed to create custom food.");
        return;
      }

      setMyFoods((prev) => [payload.food, ...prev]);
      setDialogTab("mine");
      setCreateFoodDraft({ name: "", calories: "", protein: "", carbs: "", fat: "" });
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
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
              {viewMode === "consumed" ? "Consumed" : "Remaining"}
            </div>
            <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
              {(["consumed", "remaining"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                    viewMode === mode
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-300 hover:text-slate-100"
                  }`}
                >
                  {mode === "consumed" ? "Consumed" : "Remaining"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20"
            >
              Prev
            </button>
            <input
              id="nutrition-date"
              name="nutritionDate"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 shadow-inner focus:border-white/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(toLocalDateInputValue(new Date()))}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => openFoodManagerDialog()}
              className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-400/20"
            >
              Manage Foods
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="glass-panel relative overflow-hidden rounded-[28px] border border-white/5 p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(244,114,182,0.12),_transparent_50%)]" />
            <div className="relative grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex items-center justify-center">
                <div
                  className="grid h-32 w-32 place-items-center rounded-full border border-white/20 bg-white/10"
                  style={{
                    background: `conic-gradient(#38bdf8 ${calorieProgress}%, rgba(15,23,42,0.12) 0%)`,
                  }}
                >
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-white/90 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cal</p>
                    <p className="text-2xl font-semibold text-slate-100">
                      {viewMode === "consumed" ? totals.calories : remaining.calories}
                    </p>
                    <p className="text-xs text-slate-500">
                      {targetNumbers.calories || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Macros</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-100">
                      {viewMode === "consumed" ? "Consumed" : "Remaining"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={saveTargets}
                    disabled={savingTargets}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20 disabled:opacity-60"
                  >
                    {savingTargets ? "Saving" : "Save targets"}
                  </button>
                </div>

                <div className="grid gap-3">
                  {macroRows.map((macro) => (
                    <div key={macro.label} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${macro.color}`} />
                        <p className="text-sm text-slate-200">{macro.label}</p>
                      </div>
                      <p className="text-sm text-slate-400">
                        {viewMode === "consumed" ? macro.value : macro.remaining} / {macro.target}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                    Calories
                    <input
                      id="target-calories"
                      name="targetCalories"
                      inputMode="numeric"
                      value={targets.calories}
                      onChange={(event) =>
                        setTargets((prev) => ({ ...prev, calories: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="2350"
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                    Protein
                    <input
                      id="target-protein"
                      name="targetProtein"
                      inputMode="numeric"
                      value={targets.protein}
                      onChange={(event) =>
                        setTargets((prev) => ({ ...prev, protein: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="192"
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                    Carbs
                    <input
                      id="target-carbs"
                      name="targetCarbs"
                      inputMode="numeric"
                      value={targets.carbs}
                      onChange={(event) =>
                        setTargets((prev) => ({ ...prev, carbs: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="216"
                    />
                  </label>
                  <label className="space-y-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                    Fat
                    <input
                      id="target-fat"
                      name="targetFat"
                      inputMode="numeric"
                      value={targets.fat}
                      onChange={(event) => setTargets((prev) => ({ ...prev, fat: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="80"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] border border-white/5 p-6">
            <h3 className="text-xs uppercase tracking-[0.3em] text-slate-400">Daily notes</h3>
            <p className="mt-3 text-sm text-slate-300">
              {loading ? "Loading nutrition day..." : "Log meals and watch the totals adjust in real time."}
            </p>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</p>
                <p className="mt-2 text-sm text-slate-200">
                  {day ? "Targets saved" : "Targets not saved yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Entries</p>
                <p className="mt-2 text-sm text-slate-200">{entries.length} logged</p>
              </div>
              {error && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[28px] border border-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Food search</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-100">USDA FoodData Central</h2>
              <p className="mt-2 text-sm text-slate-400">Macros shown are per 100g when available.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                id="food-search-meal"
                name="foodSearchMeal"
                value={searchMeal}
                onChange={(event) => setSearchMeal(event.target.value as MealKey)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              >
                {meals.map((meal) => (
                  <option key={meal.key} value={meal.key}>
                    {meal.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              id="food-search"
              name="foodSearch"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
              placeholder="Search foods"
            />
            <button
              type="button"
              onClick={handleFoodSearch}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20"
            >
              {searchLoading ? "Searching" : "Search"}
            </button>
          </div>

          {searchError && (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {searchError}
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-slate-500">
                {searchPerformed ? `No results for "${searchQuery.trim()}".` : "Search for foods to add."}
              </p>
            ) : (
              searchResults.map((result) => (
                <div
                  key={result.fdcId}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{result.description}</p>
                    {result.brandOwner && (
                      <p className="mt-1 text-xs text-slate-400">{result.brandOwner}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      {result.calories ?? 0} cal · {result.protein ?? 0}p · {result.carbs ?? 0}c · {result.fat ?? 0}f
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addFoodResult(result)}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20"
                  >
                    Add to {meals.find((meal) => meal.key === searchMeal)?.label}
                  </button>
                </div>
              ))
            )}
          </div>
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
                    <h3 className="text-2xl font-semibold leading-none text-slate-900">{meal.label}</h3>
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
                      className="rounded-full bg-[#0e1f49] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#122960]"
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
                            {(entry.calories ?? 0) * toEntryQuantity(entry.quantity)} cal · {(entry.protein ?? 0) * toEntryQuantity(entry.quantity)}p · {(entry.carbs ?? 0) * toEntryQuantity(entry.quantity)}c · {(entry.fat ?? 0) * toEntryQuantity(entry.quantity)}f
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Qty: {formatDecimal(toEntryQuantity(entry.quantity))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateEntryQuantity(entry.id, toEntryQuantity(entry.quantity) - 0.25)}
                            className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => updateEntryQuantity(entry.id, toEntryQuantity(entry.quantity) + 0.25)}
                            className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                          >
                            +
                          </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#030711] p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="inline-block bg-[#0b3da8] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.25em] text-white">
                    {activeMealDialog ? `Add To ${meals.find((meal) => meal.key === activeMealDialog)?.label}` : "Manage Foods"}
                  </p>
                  <h3 className="mt-1 text-3xl font-semibold leading-tight text-white">Search foods</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFoodDialogOpen(false);
                    setActiveMealDialog(null);
                    setEditingFoodId(null);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#14316f] text-lg text-slate-100 transition hover:border-[#2850a1] hover:text-white"
                  aria-label="Close food dialog"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {(["recent", "mine", "create"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDialogTab(tab)}
                      className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                      dialogTab === tab
                        ? "border-white bg-white text-slate-900"
                        : "border-slate-500 text-slate-100 hover:border-slate-300 hover:text-white"
                    }`}
                  >
                    {tab === "recent" ? "Recents" : tab === "mine" ? "My foods" : "Create food"}
                  </button>
                ))}
              </div>

              {dialogTab === "create" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input
                    value={createFoodDraft.name}
                    onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Food name"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none sm:col-span-2"
                  />
                  <input
                    value={createFoodDraft.calories}
                    onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                    placeholder="Calories"
                    inputMode="numeric"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                  />
                  <input
                    value={createFoodDraft.protein}
                    onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                    placeholder="Protein"
                    inputMode="numeric"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                  />
                  <input
                    value={createFoodDraft.carbs}
                    onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                    placeholder="Carbs"
                    inputMode="numeric"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                  />
                  <input
                    value={createFoodDraft.fat}
                    onChange={(event) => setCreateFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                    placeholder="Fat"
                    inputMode="numeric"
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={createCustomFood}
                    disabled={creatingFood}
                    className="rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/25 disabled:opacity-60 sm:col-span-2"
                  >
                    {creatingFood ? "Saving" : "Save Food"}
                  </button>
                </div>
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
                      <p className="text-sm text-slate-100">Loading foods...</p>
                    ) : dialogFoods.length === 0 ? (
                      <p className="rounded-lg border border-slate-600 px-4 py-4 text-sm text-slate-100">No foods found. Try a different search.</p>
                    ) : (
                      dialogFoods.map((food) => (
                        <div
                          key={`${dialogTab}-${food.id}`}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-slate-100">{food.name}</span>
                            <span className="mt-1 block text-xs text-slate-200">
                              {food.calories ?? 0} cal · {food.protein ?? 0}p · {food.carbs ?? 0}c · {food.fat ?? 0}f
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {activeMealDialog ? (
                              <button
                                type="button"
                                onClick={() => addLibraryFood(food, activeMealDialog)}
                                className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:text-white"
                              >
                                Add
                              </button>
                            ) : null}
                            {dialogTab === "mine" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEditFood(food)}
                                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-100 transition hover:border-white/40 hover:text-white"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={dialogSaving}
                                  onClick={() => deleteFood(food.id)}
                                  className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-300 hover:text-rose-100 disabled:opacity-60"
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
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Edit Food</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      value={editFoodDraft.name}
                      onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Food name"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none sm:col-span-2"
                    />
                    <input
                      value={editFoodDraft.calories}
                      onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, calories: event.target.value }))}
                      placeholder="Calories"
                      inputMode="numeric"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                    />
                    <input
                      value={editFoodDraft.protein}
                      onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, protein: event.target.value }))}
                      placeholder="Protein"
                      inputMode="numeric"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                    />
                    <input
                      value={editFoodDraft.carbs}
                      onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                      placeholder="Carbs"
                      inputMode="numeric"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                    />
                    <input
                      value={editFoodDraft.fat}
                      onChange={(event) => setEditFoodDraft((prev) => ({ ...prev, fat: event.target.value }))}
                      placeholder="Fat"
                      inputMode="numeric"
                      className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-300 focus:border-white/40 focus:outline-none"
                    />
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={dialogSaving}
                        onClick={() => saveEditedFood(editingFoodId)}
                        className="rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/25 disabled:opacity-60"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFoodId(null)}
                        className="rounded-2xl border border-white/20 px-4 py-2 text-sm text-slate-100 transition hover:border-white/40 hover:text-white"
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
