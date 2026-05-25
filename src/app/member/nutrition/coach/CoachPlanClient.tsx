"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import NutritionCheckInBanner from "@/components/health/NutritionCheckInBanner";

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

const GOAL_LABEL: Record<string, string> = {
  lose_weight: "Lose Weight",
  gain_weight: "Gain Weight",
  maintain_weight: "Maintain Weight",
  performance_reverse_diet: "Performance / Reverse Diet",
};

type MetricAccent = "teal" | "pink" | "neutral";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
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

function metricCard(label: string, value: string, accent: MetricAccent = "neutral") {
  const accentClass =
    accent === "teal"
      ? "border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)]"
      : accent === "pink"
        ? "border-[rgba(255,92,168,0.18)] bg-[rgba(255,92,168,0.08)]"
        : "border-[rgba(16,24,40,0.08)] bg-white/66";

  return (
    <div key={label} className={`rounded-[20px] border p-4 ${accentClass}`}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#667085]">{label}</dt>
      <dd className="mt-2 text-lg font-bold leading-tight text-[#17141F]">{value}</dd>
    </div>
  );
}


export default function CoachPlanClient() {
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInWeight, setCheckInWeight] = useState("");
  const [checkInBodyFat, setCheckInBodyFat] = useState("");
  const [checkInGoal, setCheckInGoal] = useState("lose_weight");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInResult, setCheckInResult] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);

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
        const nextSummary = (payload?.summary ?? null) as CoachPlanSummary | null;
        setSummary(nextSummary);
        setHasPlan(true);
        setCheckInWeight(nextSummary?.currentWeight ? String(nextSummary.currentWeight) : "");
        setCheckInBodyFat(nextSummary?.bodyFatPercent ? String(nextSummary.bodyFatPercent) : "");
        setCheckInGoal(nextSummary?.goalType ?? "lose_weight");
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
      <div className="premium-glass-card p-5">
        <p className="text-sm font-semibold text-[#667085]">Loading coach plan...</p>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="premium-glass-card flex min-h-[320px] flex-col items-start justify-center gap-4 p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">No active plan</p>
          <h2 className="mt-2 text-2xl font-bold text-[#17141F]">Start your coach plan</h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#667085]">
            You don&apos;t have an active nutrition plan yet. Set one up to get target macros and weekly check-ins.
          </p>
        </div>
        <Link
          href="/member/nutrition-coach"
          className="rounded-2xl bg-[#14D2DC] px-5 py-3 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105"
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

  async function submitCheckIn() {
    setCheckInBusy(true);
    setCheckInError(null);
    setCheckInResult(null);
    try {
      const response = await fetch("/api/coach/nutrition-plan/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "member_check_in",
          bodyWeightLbs: checkInWeight,
          bodyFatPercent: checkInBodyFat.trim() ? checkInBodyFat : null,
          goalType: checkInGoal,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Check-in failed.");
      }

      const rec = payload?.recommendation;
      const nextDate = payload?.nextCheckInDate ? formatDate(payload.nextCheckInDate) : "the next check-in";
      if (payload?.action === "adjusted") {
        setCheckInResult(
          `Check-in complete. Calories ${rec?.calorieDelta > 0 ? "increased" : "decreased"} by ${Math.abs(
            rec?.calorieDelta ?? 0
          )} kcal/day. Next check-in: ${nextDate}.`
        );
      } else if (payload?.action === "counter_reset") {
        setCheckInResult(`Check-in complete. Tracking was not adherent, so the 10-day counter restarted. Next check-in: ${nextDate}.`);
      } else {
        setCheckInResult(`Check-in complete. Plan held. Next check-in: ${nextDate}.`);
      }

      const refreshed = await fetch("/api/coach/nutrition-plan-status", { cache: "no-store" });
      const refreshedPayload = await refreshed.json().catch(() => null);
      if (refreshed.ok && refreshedPayload?.summary) {
        setSummary(refreshedPayload.summary);
      }
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setCheckInBusy(false);
    }
  }

  return (
    <div className="grid w-full gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.65fr)]">
      <div className="flex flex-col gap-5">
        <div className="hidden lg:block">
          <NutritionCheckInBanner />
        </div>

      {checkInDue ? (
        <div className="premium-glass-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B42368]">Check-In Due</p>
              <h2 className="mt-1 text-[22px] font-bold text-[#17141F]">Weekly coach review</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                Confirm bodyweight, body fat, and goal. If tracking was adherent, the app will adjust calories based on progress.
              </p>
            </div>
            <div className="w-fit rounded-full border border-[rgba(255,92,168,0.18)] bg-[rgba(255,92,168,0.08)] px-3 py-1 text-xs font-bold text-[#B42368]">
              10-day review
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="block space-y-2 text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
              Bodyweight
              <input
                value={checkInWeight}
                onChange={(event) => setCheckInWeight(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
                placeholder="lb"
              />
            </label>
            <label className="block space-y-2 text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
              Body fat
              <input
                value={checkInBodyFat}
                onChange={(event) => setCheckInBodyFat(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
                placeholder="%"
              />
            </label>
            <label className="block space-y-2 text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
              Goal
              <select
                value={checkInGoal}
                onChange={(event) => setCheckInGoal(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/72 px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              >
                {Object.entries(GOAL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {checkInError ? <p className="mt-3 text-sm font-bold text-rose-700">{checkInError}</p> : null}
          {checkInResult ? <p className="mt-3 text-sm font-bold text-emerald-700">{checkInResult}</p> : null}

          <button
            type="button"
            onClick={() => void submitCheckIn()}
            disabled={checkInBusy}
            className="mt-5 rounded-2xl bg-[#14D2DC] px-5 py-3 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105 disabled:opacity-60"
          >
            {checkInBusy ? "Checking in..." : "Complete check-in"}
          </button>
        </div>
      ) : null}

      <div className="premium-glass-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Plan Overview</p>
            <h2 className="mt-1 text-[28px] font-bold leading-tight text-[#17141F]">
              {GOAL_LABEL[summary?.goalType ?? ""] ?? "Not set"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
              Active daily targets and progress markers from your coach plan.
            </p>
          </div>
          <Link
            href="/member/nutrition-coach"
            className="rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/70 px-4 py-2.5 text-sm font-bold text-[#17141F] transition hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.08)]"
          >
            Change Plan
          </Link>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {progressMetrics.map(([label, value]) => metricCard(label, value))}
        </dl>
      </div>
      </div>

      <aside className="flex flex-col gap-5">
        <div className="premium-glass-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Daily Targets</p>
          <div className="mt-4 rounded-[24px] border border-[rgba(20,210,220,0.18)] bg-[rgba(20,210,220,0.08)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#667085]">Calories</p>
            <p className="mt-2 text-4xl font-bold leading-none text-[#17141F]">{formatCalories(summary?.targetCalories)}</p>
            <p className="mt-2 text-sm font-semibold text-[#667085]">Estimated metabolism: {formatCalories(summary?.estimatedMetabolism)}</p>
          </div>

          <dl className="mt-3 grid gap-3">
            {macroTargets.map(([label, value, accent]) => metricCard(label, value, accent))}
          </dl>
        </div>

        <div className="premium-glass-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Check-In Status</p>
          <h2 className="mt-1 text-[22px] font-bold text-[#17141F]">
            {checkInDue ? "Due now" : daysUntilCheckIn === null ? "Not scheduled" : `${daysUntilCheckIn} days away`}
          </h2>
          <div className="mt-4 grid gap-3">
            {metricCard("Next check-in", formatDate(summary?.nextCheckInDate), checkInDue ? "pink" : "teal")}
            {metricCard(
              "Metabolism source",
              summary?.metabolismSource === "empirical" ? "Empirical" : summary?.metabolismSource === "formula" ? "Formula" : "-"
            )}
            {metricCard("Estimate updated", formatDate(summary?.metabolismEstimatedAt))}
          </div>
        </div>

        <div className="premium-glass-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#667085]">Coach Note</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#475467]">
            Keep your logging consistent and use the check-in cadence to let the plan adjust from real progress, not guesswork.
          </p>
        </div>
      </aside>

    </div>
  );
}
