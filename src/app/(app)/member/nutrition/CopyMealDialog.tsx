"use client";

import { useEffect, useRef, useState } from "react";

import { Panel } from "@/components/ui";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { meals, toLocalDateInputValue, type MealKey } from "./lib";

type CopyMealDialogProps = {
  /** The meal being copied; null keeps the dialog closed. */
  mealKey: MealKey | null;
  copying: boolean;
  onClose: () => void;
  onCopy: (targetDate: string, targetMeal: MealKey) => Promise<void>;
  onError: (message: string | null) => void;
};

export default function CopyMealDialog({
  mealKey,
  copying,
  onClose,
  onCopy,
  onError,
}: CopyMealDialogProps) {
  const [targetDate, setTargetDate] = useState(() => toLocalDateInputValue(new Date()));
  const [targetMeal, setTargetMeal] = useState<MealKey>("breakfast");
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useModalBehavior(mealKey !== null, onClose, overlayRef);

  // Re-seed the form each time the dialog opens for a meal.
  useEffect(() => {
    if (mealKey) {
      setTargetDate(toLocalDateInputValue(new Date()));
      setTargetMeal(mealKey);
    }
  }, [mealKey]);

  if (!mealKey) {
    return null;
  }

  async function submit() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      onError("Please choose a valid target date.");
      return;
    }

    await onCopy(targetDate, targetMeal);
    onClose();
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Copy meal"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 outline-none"
    >
      <Panel padding="lg" className="w-full max-w-md shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Copy Meal</p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">
              Copy {meals.find((meal) => meal.key === mealKey)?.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--line-focus)] focus:outline-none"
            />
          </label>

          <label className="block space-y-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Target Meal
            <select
              value={targetMeal}
              onChange={(event) => setTargetMeal(event.target.value as MealKey)}
              className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--line-focus)] focus:outline-none"
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
            onClick={onClose}
            className="rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={copying}
            className="accent-pink rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
          >
            {copying ? "Copying" : "Copy Meal"}
          </button>
        </div>
      </Panel>
    </div>
  );
}
