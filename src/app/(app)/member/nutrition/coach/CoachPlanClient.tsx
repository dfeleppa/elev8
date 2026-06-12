"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";
import CheckInWizard from "./CheckInWizard";

type CoachPlanSummary = {
  goalType?: string | null;
  startWeight?: number | null;
  currentWeight?: number | null;
  bodyFatPercent?: number | null;
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

type CheckInHistoryItem = {
  id: string;
  date: string;
  status: string;
  outcome: string | null;
  source: string | null;
  bodyWeightLbs: number | null;
  bodyFatPercent: number | null;
  accountable: boolean | null;
  calorieDelta: number | null;
  reason: string | null;
  proposedCalories: number | null;
};

const GOAL_LABEL: Record<string, string> = {
  lose_weight: "Lose Weight",
  gain_weight: "Gain Weight",
  maintain_weight: "Maintain Weight",
  performance_reverse_diet: "Performance / Reverse Diet",
};

const SETUP_HREF = "/member/nutrition/coach/setup";

type MetricAccent = "teal" | "pink" | "neutral";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    // history dates are full timestamps
    const t = new Date(value);
    if (!Number.isNaN(t.getTime())) {
      return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
    return value;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatWeight(value: number | null | undefined) {
  if (value == null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "-";
  return `${num.toFixed(1)} lb`;
}

function formatCalories(value: number | null | undefined) {
  if (value == null) return "-";
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${num} kcal`;
}

function formatBodyFat(value: number | null | undefined) {
  if (value == null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${num.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatGrams(value: number | null | undefined) {
  if (value == null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${Math.round(num)} g`;
}

function outcomeLabel(item: CheckInHistoryItem): string {
  const delta = Math.round(item.calorieDelta ?? 0);
  switch (item.outcome) {
    case "adjusted":
      return `${delta > 0 ? "+" : ""}${delta} kcal/day`;
    case "held_on_pace":
      return "On pace — held";
    case "no_change_not_accountable":
      return "No change (not accountable)";
    case "counter_reset":
      return "Held — inconsistent tracking";
    case "guardrail_blocked":
      return "Guardrail reached";
    default:
      return item.status === "applied" ? "Adjusted" : "Reviewed";
  }
}

function metricCard(label: string, value: string, accent: MetricAccent = "neutral") {
  const accentClass =
    accent === "teal"
      ? "border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)]"
      : accent === "pink"
        ? "border-[rgba(255,92,168,0.18)] bg-[rgba(255,92,168,0.08)]"
        : "border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-solid)]/66";

  return (
    <div key={label} className={`rounded-[16px] border p-3 sm:rounded-[20px] sm:p-4 ${accentClass}`}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nutrition-text-soft)] sm:text-[11px]">{label}</dt>
      <dd className="mt-1 text-base font-bold leading-tight text-[var(--nutrition-text-primary)] sm:mt-2 sm:text-lg">{value}</dd>
    </div>
  );
}

export default function CoachPlanClient() {
  const router = useRouter();
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CheckInHistoryItem[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/nutrition-plan-status", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!payload?.hasPlan) {
        setHasPlan(false);
        setSummary(null);
        return;
      }
      setSummary((payload?.summary ?? null) as CoachPlanSummary | null);
      setHasPlan(true);
    } catch {
      setHasPlan(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/nutrition-plan/check-in/history", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok && Array.isArray(payload?.history)) {
        setHistory(payload.history as CheckInHistoryItem[]);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadSummary(), loadHistory()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary, loadHistory]);

  const refreshAfterCheckIn = useCallback(() => {
    void loadSummary();
    void loadHistory();
  }, [loadSummary, loadHistory]);

  async function handleReset() {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/coach/nutrition-plan/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Reset failed.");
      }
      router.push(SETUP_HREF);
      router.refresh();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="premium-glass-card p-5">
        <p className="text-sm font-semibold text-[var(--nutrition-text-soft)]">Loading coach plan...</p>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="premium-glass-card flex min-h-[320px] flex-col items-start justify-center gap-4 p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--nutrition-text-soft)]">No active plan</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--nutrition-text-primary)]">Start your coach plan</h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[var(--nutrition-text-soft)]">
            You don&apos;t have an active nutrition plan yet. Set one up to get target macros and weekly check-ins.
          </p>
        </div>
        <Link
          href={SETUP_HREF}
          className="rounded-2xl bg-[var(--nutrition-accent-teal)] px-5 py-3 text-sm font-bold text-[var(--nutrition-accent-teal-ink)] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105"
        >
          Start a plan
        </Link>
      </div>
    );
  }

  const nextCheckInDate = summary?.nextCheckInDate ? new Date(`${summary.nextCheckInDate}T00:00:00`) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkInDue = nextCheckInDate !== null && !Number.isNaN(nextCheckInDate.getTime()) && nextCheckInDate <= today;
  const daysUntilCheckIn =
    nextCheckInDate && !Number.isNaN(nextCheckInDate.getTime())
      ? Math.max(0, Math.ceil((nextCheckInDate.getTime() - today.getTime()) / 86_400_000))
      : null;
  const macroTargets: Array<[string, string, MetricAccent]> = [
    ["Protein", formatGrams(summary?.proteinGrams), "teal"],
    ["Carbs", formatGrams(summary?.carbsGrams), "neutral"],
    ["Fat", formatGrams(summary?.fatGrams), "pink"],
  ];
  const progressMetrics = [
    ["Start weight", formatWeight(summary?.startWeight)],
    ["Current weight", formatWeight(summary?.currentWeight)],
    ["Target weight", formatWeight(summary?.targetWeight)],
    ["Body fat", formatBodyFat(summary?.bodyFatPercent)],
    ["Plan started", formatDate(summary?.effectiveDate)],
    ["Last check-in", formatDate(summary?.lastCheckInDate)],
  ];

  return (
    <div className="grid w-full gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.65fr)]">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="hidden lg:block">
          <NutritionCheckInBanner />
        </div>

        <CheckInWizard
          onComplete={refreshAfterCheckIn}
          checkInDue={checkInDue}
          daysUntilCheckIn={daysUntilCheckIn}
          nextCheckInDate={summary?.nextCheckInDate ?? null}
        />

        <div className="premium-glass-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--nutrition-text-soft)] sm:text-[11px]">Plan Overview</p>
              <h2 className="mt-1 text-[24px] font-bold leading-tight text-[var(--nutrition-text-primary)] sm:text-[28px]">
                {GOAL_LABEL[summary?.goalType ?? ""] ?? "Not set"}
              </h2>
            </div>
            <Link
              href={SETUP_HREF}
              className="shrink-0 rounded-2xl border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--nutrition-text-primary)] transition hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)] sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Change Plan
            </Link>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 2xl:grid-cols-3">
            {progressMetrics.map(([label, value]) => metricCard(label, value))}
          </dl>
        </div>

        {/* Check-in history */}
        <div className="premium-glass-card p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--nutrition-text-soft)] sm:text-[11px]">Check-In History</p>
          {history.length === 0 ? (
            <p className="mt-3 text-sm font-semibold text-[var(--nutrition-text-soft)]">
              No check-ins yet. Complete your first weekly check-in above to start tracking progress.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {history.map((item) => {
                const accountable = item.accountable;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-[16px] border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-solid)]/66 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--nutrition-text-primary)]">{formatDate(item.date)}</p>
                      <p className="text-xs font-semibold text-[var(--nutrition-text-soft)]">
                        {formatWeight(item.bodyWeightLbs)}
                        {item.bodyFatPercent != null ? ` · ${formatBodyFat(item.bodyFatPercent)} bf` : ""}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {accountable === null ? null : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                            accountable
                              ? "bg-[rgba(18,183,106,0.12)] text-[var(--nutrition-status-good)]"
                              : "bg-[rgba(240,68,56,0.1)] text-[var(--nutrition-status-over)]"
                          }`}
                        >
                          {accountable ? "Accountable" : "Not accountable"}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          item.outcome === "adjusted"
                            ? "bg-[rgba(20,210,220,0.12)] text-[var(--nutrition-teal-text)]"
                            : "bg-[rgba(16,24,40,0.06)] text-[var(--nutrition-text-muted)]"
                        }`}
                      >
                        {outcomeLabel(item)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4 sm:gap-5">
        <div className="premium-glass-card p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--nutrition-text-soft)] sm:text-[11px]">Daily Targets</p>
          <div className="mt-3 rounded-[20px] border border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)] p-3 sm:mt-4 sm:rounded-[24px] sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nutrition-text-soft)] sm:text-[11px]">Calories</p>
            <p className="mt-1 text-3xl font-bold leading-none text-[var(--nutrition-text-primary)] sm:mt-2 sm:text-4xl">{formatCalories(summary?.targetCalories)}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--nutrition-text-soft)] sm:mt-2 sm:text-sm">Metabolism: {formatCalories(summary?.estimatedMetabolism)}</p>
          </div>

          <dl className="mt-3 grid gap-2 sm:gap-3">
            {macroTargets.map(([label, value, accent]) => metricCard(label, value, accent))}
          </dl>
        </div>

        <div className="premium-glass-card p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--nutrition-text-soft)] sm:text-[11px]">Check-In Status</p>
          <h2 className="mt-1 text-[20px] font-bold text-[var(--nutrition-text-primary)] sm:text-[22px]">
            {checkInDue ? "Due now" : daysUntilCheckIn === null ? "Not scheduled" : `${daysUntilCheckIn} days away`}
          </h2>
          <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
            {metricCard("Next check-in", formatDate(summary?.nextCheckInDate), checkInDue ? "pink" : "teal")}
            {metricCard(
              "Metabolism source",
              summary?.metabolismSource === "empirical" ? "Empirical" : summary?.metabolismSource === "formula" ? "Formula" : "-"
            )}
            {metricCard("Estimate updated", formatDate(summary?.metabolismEstimatedAt))}
          </div>
        </div>

        <div className="premium-glass-card p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--nutrition-text-soft)] sm:text-[11px]">Start Over</p>
          <p className="mt-2 text-sm font-semibold leading-5 text-[var(--nutrition-text-muted)] sm:mt-3 sm:leading-6">
            Wipe your plan and all check-in history, then rebuild from scratch. Your weigh-ins and food
            logs are kept.
          </p>
          <button
            type="button"
            onClick={() => {
              setResetError(null);
              setShowResetConfirm(true);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[rgba(240,68,56,0.28)] bg-[rgba(240,68,56,0.06)] px-4 py-2 text-sm font-bold text-[var(--nutrition-status-over)] transition hover:bg-[rgba(240,68,56,0.12)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Wipe &amp; start over
          </button>
        </div>
      </aside>

      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-[var(--nutrition-surface-solid)] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--nutrition-text-primary)]">Wipe plan and check-in history?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--nutrition-text-soft)]">
              This permanently deletes your nutrition plan and every check-in record. You&apos;ll start
              fresh by building a new plan. Weigh-ins and food logs are not affected.
            </p>
            {resetError ? <p className="mt-3 text-sm font-bold text-rose-700">{resetError}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="rounded-2xl border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-solid)] px-4 py-2 text-sm font-bold text-[var(--nutrition-text-primary)] transition hover:bg-[rgba(16,24,40,0.04)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetting}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#F04438] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Wipe everything
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
