"use client";

import { useEffect, useMemo, useState } from "react";

import SidebarShell from "../../../components/SidebarShell";

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
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: string;
};

type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

type EntryDraft = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
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

const meals: { key: MealKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

const emptyDraft: EntryDraft = {
  name: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

function toLocalDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
        acc.calories += toNumber(entry.calories);
        acc.protein += toNumber(entry.protein);
        acc.carbs += toNumber(entry.carbs);
        acc.fat += toNumber(entry.fat);
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
    if (!draft.name.trim()) {
      setError("Entry name is required.");
      return;
    }

    setError(null);
    const response = await fetch("/api/nutrition-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayDate: selectedDate,
        mealType: mealKey,
        name: draft.name,
        calories: draft.calories,
        protein: draft.protein,
        carbs: draft.carbs,
        fat: draft.fat,
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
            <input
              id="nutrition-date"
              name="nutritionDate"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 shadow-inner focus:border-white/30 focus:outline-none"
            />
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
            const draft = drafts[meal.key];
            return (
              <div key={meal.key} className="glass-panel rounded-[28px] border border-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-100">{meal.label}</h3>
                  <span className="text-xs text-slate-400">{mealEntries.length} items</span>
                </div>

                <div className="mt-4 space-y-3">
                  {mealEntries.length === 0 ? (
                    <p className="text-sm text-slate-500">No entries yet.</p>
                  ) : (
                    mealEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{entry.entry_name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {entry.calories ?? 0} cal · {entry.protein ?? 0}p · {entry.carbs ?? 0}c · {entry.fat ?? 0}f
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          className="text-xs text-slate-400 transition hover:text-rose-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Add item</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      id={`${meal.key}-name`}
                      name={`${meal.key}Name`}
                      value={draft.name}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [meal.key]: { ...prev[meal.key], name: event.target.value },
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="Meal item"
                    />
                    <input
                      id={`${meal.key}-calories`}
                      name={`${meal.key}Calories`}
                      value={draft.calories}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [meal.key]: { ...prev[meal.key], calories: event.target.value },
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="Calories"
                      inputMode="numeric"
                    />
                    <input
                      id={`${meal.key}-protein`}
                      name={`${meal.key}Protein`}
                      value={draft.protein}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [meal.key]: { ...prev[meal.key], protein: event.target.value },
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="Protein"
                      inputMode="numeric"
                    />
                    <input
                      id={`${meal.key}-carbs`}
                      name={`${meal.key}Carbs`}
                      value={draft.carbs}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [meal.key]: { ...prev[meal.key], carbs: event.target.value },
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="Carbs"
                      inputMode="numeric"
                    />
                    <input
                      id={`${meal.key}-fat`}
                      name={`${meal.key}Fat`}
                      value={draft.fat}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [meal.key]: { ...prev[meal.key], fat: event.target.value },
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 focus:border-white/30 focus:outline-none"
                      placeholder="Fat"
                      inputMode="numeric"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => addEntry(meal.key)}
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30 hover:bg-white/20"
                  >
                    Add to {meal.label}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </section>
    </SidebarShell>
  );
}
