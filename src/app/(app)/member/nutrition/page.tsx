"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import CoachPanel from "./CoachPanel";
import CopyMealDialog from "./CopyMealDialog";
import DateNavigator from "./DateNavigator";
import FoodDialog from "./FoodDialog";
import MacroSummaryCard from "./MacroSummaryCard";
import MealCard from "./MealCard";
import NutritionTopBar from "./NutritionTopBar";
import QuickAddDialog from "./QuickAddDialog";
import {
  meals,
  toEntryQuantity,
  toLocalDateInputValue,
  toNumber,
  type MealKey,
  type NutritionEntry,
} from "./lib";

export default function HealthNutritionPage() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue(new Date()));
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
  });
  const [foodDialogMeal, setFoodDialogMeal] = useState<MealKey | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [copyDialogMeal, setCopyDialogMeal] = useState<MealKey | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<MealKey | null>(null);

  useEffect(() => {
    let isActive = true;
    setError(null);
    setDayLoading(true);
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
      .finally(() => {
        if (isActive) {
          setDayLoading(false);
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
        acc.fiber += toNumber(entry.fiber) * quantity;
        acc.sugar += toNumber(entry.sugar) * quantity;
        acc.saturatedFat += toNumber(entry.saturated_fat) * quantity;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, saturatedFat: 0 }
    );
  }, [entries]);

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

  function handleEntryAdded(entry: NutritionEntry) {
    setEntries((prev) => [...prev, entry]);
  }

  async function deleteEntry(entryId: string, entryName?: string) {
    if (!window.confirm(`Remove ${entryName?.trim() || "this entry"} from the log?`)) {
      return;
    }
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
      return;
    }

    const mealLabel = meals.find((meal) => meal.key === mealKey)?.label ?? "this meal";
    const count = mealEntries.length;
    if (!window.confirm(`Delete all ${count} ${count === 1 ? "entry" : "entries"} from ${mealLabel}?`)) {
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

  return (
    <div className="w-full">
      <section
        className="nutrition-theme nutrition-dashboard premium-main-glow flex min-h-[calc(100dvh-3.5rem)] w-full flex-col gap-5 px-5 pb-4 pt-[calc(4.75rem+env(safe-area-inset-top))] text-[var(--nutrition-text-primary)] sm:px-8 sm:pt-4 lg:px-10 lg:pb-6 lg:pt-20 2xl:px-12"
      >
        <div
          className={`flex w-full flex-col gap-5 transition-opacity duration-200 ${
            dayLoading ? "opacity-60" : "opacity-100"
          }`}
        >
        <header className="pointer-events-none relative z-[35] mb-[-4px] flex flex-col items-center">
          <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} />

          <div className="pointer-events-auto mt-2">
            <NutritionTopBar active="daily" showDate={false} />
          </div>
        </header>

        {error ? (
          <div className="nutrition-error-banner rounded-2xl border border-rose-300/70 bg-rose-50/90 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-3 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.55fr)] xl:items-stretch xl:gap-5 xl:space-y-0 2xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.5fr)]">
          <MacroSummaryCard totals={totals} targets={targets} onError={setError} />
          <CoachPanel />
        </section>

        <section className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-3 2xl:grid-cols-4">
          <div className="flex items-center justify-between gap-3 px-1 md:col-span-full">
            <h2 className="text-[19px] font-extrabold text-[var(--nutrition-text-primary)]">Meals</h2>
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="nutrition-secondary-action inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface)] px-3.5 py-2 text-[12px] font-extrabold text-[var(--nutrition-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_18px_rgba(16,24,40,0.06)] transition hover:bg-[var(--nutrition-surface-solid)] sm:text-[13px]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Quick add macros
            </button>
          </div>
          {mealSummaries.map((meal) => (
            <MealCard
              key={`meal-${meal.key}`}
              meal={meal}
              entries={meal.entries}
              totals={meal.totals}
              copying={copyingMeal === meal.key}
              onAddFood={() => setFoodDialogMeal(meal.key)}
              onDeleteMeal={() => void deleteMealEntries(meal.key)}
              onCopyMeal={() => setCopyDialogMeal(meal.key)}
              onDeleteEntry={(entryId, entryName) => void deleteEntry(entryId, entryName)}
              onSaveServing={updateEntryQuantity}
              onError={setError}
            />
          ))}
        </section>

        <div className="h-4" />
        </div>

        <FoodDialog
          open={foodDialogMeal !== null}
          mealKey={foodDialogMeal}
          selectedDate={selectedDate}
          onClose={() => setFoodDialogMeal(null)}
          onEntryAdded={handleEntryAdded}
          onError={setError}
        />

        <QuickAddDialog
          open={quickAddOpen}
          selectedDate={selectedDate}
          onClose={() => setQuickAddOpen(false)}
          onEntryAdded={handleEntryAdded}
          onError={setError}
        />

        <CopyMealDialog
          mealKey={copyDialogMeal}
          copying={copyingMeal !== null && copyingMeal === copyDialogMeal}
          onClose={() => setCopyDialogMeal(null)}
          onCopy={(targetDate, targetMeal) =>
            copyDialogMeal ? copyMealToDate(copyDialogMeal, targetDate, targetMeal) : Promise.resolve()
          }
          onError={setError}
        />
      </section>
    </div>
  );
}
