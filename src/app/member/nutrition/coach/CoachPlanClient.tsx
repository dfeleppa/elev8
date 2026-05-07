"use client";

import { useEffect, useState } from "react";

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

export default function CoachPlanClient() {
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<GoalType>("lose_weight");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach/nutrition-plan-status", { cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((payload) => {
        if (cancelled) return;
        const status = payload?.status;
        if (status !== "active") {
          setHasPlan(false);
          setSummary(null);
          return;
        }
        const s = (payload?.summary ?? null) as CoachPlanSummary | null;
        setSummary(s);
        setHasPlan(true);
        if (s?.goalType) {
          setGoal(s.goalType as GoalType);
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

  async function saveGoal() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/athlete/coach-plan-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalType: goal }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to save.");
      setSummary((prev) => (prev ? { ...prev, goalType: goal } : prev));
      setSavedAt(Date.now());
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

  const goalDirty = summary?.goalType !== goal;

  return (
    <div className="space-y-6">
      <NutritionCheckInBanner />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel padding="lg">
          <Micro as="p">Plan Overview</Micro>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
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

        <Panel padding="lg">
          <Micro as="p">Goal</Micro>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Pick the goal that matches what you&apos;re working toward. Your coach will use this when reviewing your check-ins.
          </p>
          <div className="mt-4 space-y-2">
            {GOAL_OPTIONS.map((opt) => {
              const selected = goal === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGoal(opt.value)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    selected
                      ? "border-[var(--pink)]/40 bg-[var(--pink)]/10 text-[var(--pink)]"
                      : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      selected ? "bg-[var(--pink)]" : "bg-[var(--line-strong)]"
                    }`}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={saveGoal}
              disabled={saving || !goalDirty}
              className="accent-pink rounded-xl px-5 py-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {savedAt && !goalDirty && (
              <span className="text-xs text-[var(--text-soft)]">Saved.</span>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
