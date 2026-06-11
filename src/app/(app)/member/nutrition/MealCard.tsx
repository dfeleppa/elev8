"use client";

import { useRef, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";

import { useDismissable } from "@/hooks/useDismissable";
import {
  formatGrams,
  formatServingSize,
  roundToWhole,
  toEntryQuantity,
  type MealKey,
  type NutritionEntry,
} from "./lib";

type MealCardProps = {
  meal: { key: MealKey; label: string };
  entries: NutritionEntry[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  copying: boolean;
  onAddFood: () => void;
  onDeleteMeal: () => void;
  onCopyMeal: () => void;
  onDeleteEntry: (entryId: string, entryName: string) => void;
  onSaveServing: (entryId: string, quantity: number) => Promise<void>;
  onError: (message: string | null) => void;
};

export default function MealCard({
  meal,
  entries,
  totals,
  copying,
  onAddFood,
  onDeleteMeal,
  onCopyMeal,
  onDeleteEntry,
  onSaveServing,
  onError,
}: MealCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editServingDraft, setEditServingDraft] = useState("");
  const cardRef = useRef<HTMLDivElement | null>(null);

  useDismissable(menuOpen, () => setMenuOpen(false), [cardRef]);

  const hasEntries = entries.length > 0;

  function openServingSizeEditor(entryId: string, quantity: number | null | undefined) {
    setEditingEntryId(entryId);
    setEditServingDraft(formatServingSize(toEntryQuantity(quantity)));
  }

  async function saveServingSize(entryId: string) {
    const parsed = Number(editServingDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onError("Serving size must be greater than 0.");
      return;
    }
    await onSaveServing(entryId, parsed);
    setEditingEntryId(null);
    setEditServingDraft("");
  }

  return (
    <div ref={cardRef} className="nutrition-meal-card premium-glass-card relative p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold leading-tight text-[var(--nutrition-text-primary)]">{meal.label}</p>
          <p className="mt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--nutrition-text-muted)]">
            {Math.round(totals.calories).toLocaleString()} kcal | P{formatGrams(totals.protein)} | C{formatGrams(totals.carbs)} | F{formatGrams(totals.fat)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--nutrition-text-soft)] transition hover:bg-[var(--nutrition-surface)] hover:text-[var(--nutrition-text-primary)]"
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
              setMenuOpen(false);
              onAddFood();
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--nutrition-accent-teal)] text-[var(--nutrition-accent-teal-ink)] shadow-[0_10px_24px_rgba(20,210,220,0.26)] transition hover:brightness-105"
            aria-label={`Add to ${meal.label}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="absolute right-4 top-14 z-20 w-44 overflow-hidden rounded-2xl border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-solid)] shadow-[0_18px_38px_rgba(16,24,40,0.14)]">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDeleteMeal();
            }}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-rose-500 transition hover:bg-[var(--nutrition-menu-hover)]"
          >
            Delete meal
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onCopyMeal();
            }}
            disabled={copying}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-[var(--nutrition-text-muted)] transition hover:bg-[var(--nutrition-menu-hover)] disabled:opacity-60"
          >
            {copying ? "Copying..." : "Copy meal"}
          </button>
        </div>
      ) : null}

      {hasEntries ? (
        <div className="mt-4 space-y-3">
          {entries.map((entry) => {
            const quantity = toEntryQuantity(entry.quantity);
            const servingLabel = `${formatServingSize(quantity)} serving${quantity === 1 ? "" : "s"}`;
            const entryCal = roundToWhole((entry.calories ?? 0) * quantity);
            const entryP = formatGrams((entry.protein ?? 0) * quantity);
            const entryC = formatGrams((entry.carbs ?? 0) * quantity);
            const entryF = formatGrams((entry.fat ?? 0) * quantity);
            const isEditingServing = editingEntryId === entry.id;
            return (
              <div key={`mobile-entry-${entry.id}`} className="rounded-2xl border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-soft)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold leading-tight text-[var(--nutrition-text-primary)]">{entry.entry_name}</p>
                    <p className="mt-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--nutrition-text-muted)]">
                      {servingLabel}, {entryCal} CAL | C{entryC} | P{entryP} | F{entryF}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openServingSizeEditor(entry.id, entry.quantity)}
                      className="grid h-10 w-10 place-items-center rounded-full text-[var(--nutrition-text-soft)] transition hover:bg-[var(--nutrition-surface-solid)] hover:text-[var(--nutrition-text-primary)]"
                      aria-label={`Edit servings for ${entry.entry_name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id, entry.entry_name)}
                      className="grid h-10 w-10 place-items-center rounded-full text-[var(--nutrition-text-soft)] transition hover:bg-rose-50 hover:text-rose-500"
                      aria-label={`Remove ${entry.entry_name}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {isEditingServing ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--nutrition-text-soft)]">
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
                        className="h-9 w-20 rounded-xl border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-solid)] px-2 text-sm font-bold text-[var(--nutrition-text-primary)] focus:border-[var(--nutrition-accent-teal)] focus:outline-none"
                        inputMode="decimal"
                        aria-label="Edit servings"
                      />
                      <button
                        type="button"
                        onClick={() => void saveServingSize(entry.id)}
                        className="grid h-9 w-9 place-items-center rounded-full bg-[var(--nutrition-button-bg)] text-[var(--nutrition-button-text)]"
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
            setMenuOpen(false);
            onAddFood();
          }}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-soft)] px-4 py-4 text-sm font-bold text-[var(--nutrition-text-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(16,24,40,0.045)] transition hover:border-[var(--nutrition-accent-teal)]/45 hover:bg-[var(--nutrition-surface)] hover:text-[var(--nutrition-teal-text)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_28px_rgba(20,210,220,0.1)]"
        >
          <span className="text-left">
            <span className="block text-[var(--nutrition-text-secondary)]">No food logged yet</span>
            <span className="block text-[12px] font-extrabold text-[var(--nutrition-teal-text)]">Tap to start logging</span>
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--nutrition-accent-teal)]/35 bg-[var(--nutrition-accent-teal)]/12 text-[var(--nutrition-teal-text)]">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
