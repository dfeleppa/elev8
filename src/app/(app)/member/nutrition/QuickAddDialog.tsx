"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { useModalBehavior } from "@/hooks/useModalBehavior";
import type { NutritionEntry } from "./lib";

type QuickAddDialogProps = {
  open: boolean;
  selectedDate: string;
  onClose: () => void;
  onEntryAdded: (entry: NutritionEntry) => void;
  onError: (message: string | null) => void;
};

export default function QuickAddDialog({
  open,
  selectedDate,
  onClose,
  onEntryAdded,
  onError,
}: QuickAddDialogProps) {
  const [macros, setMacros] = useState({ protein: "", carbs: "", fat: "", fiber: "" });
  const [saving, setSaving] = useState(false);

  useModalBehavior(open, onClose);

  if (!open) {
    return null;
  }

  const calculatedCalories = Math.round(
    (Number(macros.protein) || 0) * 4 +
      (Number(macros.carbs) || 0) * 4 +
      (Number(macros.fat) || 0) * 9,
  );

  async function submitManualEntry() {
    const protein = Math.max(0, Number(macros.protein) || 0);
    const carbs = Math.max(0, Number(macros.carbs) || 0);
    const fat = Math.max(0, Number(macros.fat) || 0);
    const fiber = Math.max(0, Number(macros.fiber) || 0);

    if (protein <= 0 && carbs <= 0 && fat <= 0 && fiber <= 0) {
      onError("Enter at least one macro to log.");
      return;
    }

    setSaving(true);
    onError(null);
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
        onError(payload?.error ?? "Failed to log macros.");
        return;
      }

      onEntryAdded(payload.entry);
      setMacros({ protein: "", carbs: "", fat: "", fiber: "" });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick add macros"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    >
      <div className="panel w-full max-w-md rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">Manual tracking</p>
            <h3 className="mt-1 text-2xl font-semibold leading-tight text-[var(--text)]">Quick add macros</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                value={macros[field.key]}
                onChange={(event) =>
                  setMacros((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                placeholder="0"
                inputMode="decimal"
                className="w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--line-focus)] focus:outline-none"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--text-muted)]">Calories</span>
          <span className="text-lg font-bold tabular-nums text-[var(--text)]">
            {calculatedCalories.toLocaleString()} kcal
          </span>
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
            onClick={() => void submitManualEntry()}
            disabled={saving}
            className="accent-pink rounded-2xl px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Logging" : "Log macros"}
          </button>
        </div>
      </div>
    </div>
  );
}
