"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";
import { Micro, Panel } from "@/components/ui";

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

type CoachPlanSummary = {
  goalType?: string | null;
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  effectiveDate?: string | null;
  lastCheckInDate?: string | null;
  nextCheckInDate?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatWeight(value: number | null | undefined) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "—";
  return `${num.toFixed(1)} lb`;
}

function formatGoalLabel(goalType: string | null | undefined) {
  const match = GOAL_OPTIONS.find((opt) => opt.value === goalType);
  return match?.label ?? "Not set";
}

export default function CoachPlanClient() {
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsGoal, setSettingsGoal] = useState<GoalType>("lose_weight");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach/nutrition-plan-status", { cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.hasPlan) {
          setHasPlan(false);
          setSummary(null);
          return;
        }
        const s = (payload?.summary ?? null) as CoachPlanSummary | null;
        setSummary(s);
        setHasPlan(true);
        if (s?.goalType) {
          setSettingsGoal(s.goalType as GoalType);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHasPlan(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openSettings() {
    setSettingsGoal((summary?.goalType as GoalType) ?? "lose_weight");
    setError(null);
    setSettingsOpen(true);
  }

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/athlete/coach-plan-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType: settingsGoal }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save.");
      setSummary((prev) => (prev ? { ...prev, goalType: settingsGoal } : prev));
      setSettingsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Panel padding="lg">
        <p className="text-sm text-[var(--text-muted)]">Loading coach plan...</p>
      </Panel>
    );
  }

  if (!hasPlan) {
    return (
      <Panel padding="lg">
        <Micro as="p">No active plan</Micro>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Your coach hasn&apos;t assigned a nutrition plan yet. Once they do, you&apos;ll see your goal,
          weight progress, and check-in schedule here.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <NutritionCheckInBanner />

      <Panel padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Micro as="p">Plan Overview</Micro>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Goal: <span className="text-[var(--text)]">{formatGoalLabel(summary?.goalType)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--pink)]/40 hover:text-[var(--pink)]"
          >
            Coach settings
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Start weight</dt>
            <dd className="mt-1 text-[var(--text)]">{formatWeight(summary?.startWeight)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Current weight</dt>
            <dd className="mt-1 text-[var(--text)]">{formatWeight(summary?.currentWeight)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Target weight</dt>
            <dd className="mt-1 text-[var(--text)]">{formatWeight(summary?.targetWeight)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Plan started</dt>
            <dd className="mt-1 text-[var(--text)]">{formatDate(summary?.effectiveDate)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Last check-in</dt>
            <dd className="mt-1 text-[var(--text)]">{formatDate(summary?.lastCheckInDate)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Next check-in</dt>
            <dd className="mt-1 text-[var(--text)]">{formatDate(summary?.nextCheckInDate)}</dd>
          </div>
        </dl>
      </Panel>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Panel padding="lg" className="w-full max-w-sm shadow-[var(--shadow-lg)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">Coach Settings</h3>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
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
                  onClick={() => setSettingsGoal(opt.value)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    settingsGoal === opt.value
                      ? "border-[var(--pink)]/40 bg-[var(--pink)]/10 text-[var(--pink)]"
                      : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      settingsGoal === opt.value ? "bg-[var(--pink)]" : "bg-[var(--line-strong)]"
                    }`}
                  />
                  {opt.label}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="accent-pink flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                disabled={saving}
                className="rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
