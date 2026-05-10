"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";
import { Micro, Panel } from "@/components/ui";

type CoachPlanSummary = {
  goalType?: string | null;
  startWeight?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  estimatedMetabolism?: number | null;
  metabolismSource?: "formula" | "empirical" | null;
  metabolismEstimatedAt?: string | null;
  targetCalories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  effectiveDate?: string | null;
  lastCheckInDate?: string | null;
  nextCheckInDate?: string | null;
};

const GOAL_LABEL: Record<string, string> = {
  lose_weight: "Lose Weight",
  gain_weight: "Gain Weight",
  maintain_weight: "Maintain Weight",
  performance_reverse_diet: "Performance / Reverse Diet",
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

function formatCalories(value: number | null | undefined) {
  if (value == null) return "—";
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num <= 0) return "—";
  return `${num} kcal`;
}

function formatGrams(value: number | null | undefined) {
  if (value == null) return "—";
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "—";
  return `${Math.round(num)} g`;
}


export default function CoachPlanClient() {
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <Panel padding="lg">
        <p className="text-sm text-[var(--text-muted)]">Loading coach plan...</p>
      </Panel>
    );
  }

  if (!hasPlan) {
    return (
      <Panel padding="lg" className="flex flex-col items-start gap-4">
        <div>
          <Micro as="p">No active plan</Micro>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            You don&apos;t have an active nutrition plan yet. Set one up to get target macros and weekly check-ins.
          </p>
        </div>
        <Link
          href="/member/nutrition/coach?mode=setup"
          className="accent-pink rounded-xl px-5 py-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110"
        >
          Start a plan
        </Link>
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
              Goal:{" "}
              <span className="text-[var(--text)]">
                {GOAL_LABEL[summary?.goalType ?? ""] ?? "Not set"}
              </span>
            </p>
          </div>
          <Link
            href="/member/nutrition/coach?mode=setup"
            className="rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--pink)]/40 hover:text-[var(--pink)]"
          >
            Change Plan
          </Link>
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
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Estimated metabolism</dt>
            <dd className="mt-1 text-[var(--text)]">{formatCalories(summary?.estimatedMetabolism)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Daily calorie target</dt>
            <dd className="mt-1 text-[var(--text)]">{formatCalories(summary?.targetCalories)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Macros (P/C/F)</dt>
            <dd className="mt-1 text-[var(--text)]">
              {formatGrams(summary?.proteinGrams)} / {formatGrams(summary?.carbsGrams)} / {formatGrams(summary?.fatGrams)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Metabolism source</dt>
            <dd className="mt-1 text-[var(--text)]">
              {summary?.metabolismSource === "empirical" ? "Empirical" : summary?.metabolismSource === "formula" ? "Formula" : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--text-soft)]">Estimate updated</dt>
            <dd className="mt-1 text-[var(--text)]">{formatDate(summary?.metabolismEstimatedAt)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
