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
      <div className="rounded-[24px] border border-white/80 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_42px_rgba(79,102,124,0.12)] backdrop-blur-2xl lg:rounded-[10px] lg:border-[var(--line)] lg:bg-[var(--panel)] lg:p-6 lg:shadow-[var(--shadow-md)]">
        <p className="text-sm font-semibold text-slate-500 lg:text-[var(--text-muted)]">Loading coach plan...</p>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[24px] border border-white/80 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_42px_rgba(79,102,124,0.12)] backdrop-blur-2xl lg:rounded-[10px] lg:border-[var(--line)] lg:bg-[var(--panel)] lg:p-6 lg:shadow-[var(--shadow-md)]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:text-[var(--text-soft)]">No active plan</p>
          <p className="mt-3 text-sm font-medium text-slate-500 lg:text-[var(--text-muted)]">
            You don&apos;t have an active nutrition plan yet. Set one up to get target macros and weekly check-ins.
          </p>
        </div>
        <Link
          href="/member/nutrition-coach"
          className="rounded-xl bg-[#ffb1c4] px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#230012] transition hover:brightness-105 lg:accent-pink lg:text-current"
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
    <div className="space-y-4 lg:space-y-6">
      <div className="hidden lg:block">
        <NutritionCheckInBanner />
      </div>

      {checkInDue ? (
        <div className="rounded-[24px] border border-[#ff9fb9]/60 bg-[#ffb1c4] p-4 text-[#230012] shadow-[0_18px_42px_rgba(255,74,141,0.18)] lg:rounded-[10px] lg:border-[var(--pink)]/40 lg:bg-[var(--panel)] lg:p-6 lg:text-[var(--text)] lg:shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70 lg:text-[var(--text-soft)]">Check-In Due</p>
              <p className="mt-2 text-sm font-semibold opacity-80 lg:text-[var(--text-muted)]">
                Confirm bodyweight, body fat, and goal. If tracking was adherent, the app will adjust calories based on progress.
              </p>
            </div>
            <div className="w-fit rounded-full bg-[#230012]/12 px-3 py-1 text-xs font-bold lg:bg-[var(--pink)]/12 lg:text-[var(--pink)]">
              10-day review
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="block space-y-2 text-xs font-bold uppercase tracking-[0.14em] opacity-70 lg:text-[var(--text-soft)]">
              Bodyweight
              <input
                value={checkInWeight}
                onChange={(event) => setCheckInWeight(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-950 focus:border-[#230012]/30 focus:outline-none lg:border-[var(--line-strong)] lg:bg-[var(--panel-2)] lg:text-[var(--text)] lg:focus:border-[var(--pink)]/50"
                placeholder="lb"
              />
            </label>
            <label className="block space-y-2 text-xs font-bold uppercase tracking-[0.14em] opacity-70 lg:text-[var(--text-soft)]">
              Body fat
              <input
                value={checkInBodyFat}
                onChange={(event) => setCheckInBodyFat(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-950 focus:border-[#230012]/30 focus:outline-none lg:border-[var(--line-strong)] lg:bg-[var(--panel-2)] lg:text-[var(--text)] lg:focus:border-[var(--pink)]/50"
                placeholder="%"
              />
            </label>
            <label className="block space-y-2 text-xs font-bold uppercase tracking-[0.14em] opacity-70 lg:text-[var(--text-soft)]">
              Goal
              <select
                value={checkInGoal}
                onChange={(event) => setCheckInGoal(event.target.value)}
                className="w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-950 focus:border-[#230012]/30 focus:outline-none lg:border-[var(--line-strong)] lg:bg-[var(--panel-2)] lg:text-[var(--text)] lg:focus:border-[var(--pink)]/50"
              >
                {Object.entries(GOAL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {checkInError ? <p className="mt-3 text-sm font-bold text-rose-700 lg:text-rose-300">{checkInError}</p> : null}
          {checkInResult ? <p className="mt-3 text-sm font-bold text-emerald-900 lg:text-emerald-300">{checkInResult}</p> : null}

          <button
            type="button"
            onClick={() => void submitCheckIn()}
            disabled={checkInBusy}
            className="mt-5 rounded-xl bg-[#230012] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 lg:bg-[var(--pink)] lg:text-slate-950 lg:hover:brightness-110"
          >
            {checkInBusy ? "Checking in..." : "Complete check-in"}
          </button>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-[#ff9fb9]/60 bg-[#ffb1c4] p-4 text-[#230012] shadow-[0_18px_42px_rgba(255,74,141,0.18)] lg:rounded-[10px] lg:border-[var(--line)] lg:bg-[var(--panel)] lg:p-6 lg:text-[var(--text)] lg:shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70 lg:text-[var(--text-soft)]">Plan Overview</p>
            <p className="mt-2 text-[26px] font-bold leading-none tracking-[-0.02em] lg:text-lg lg:tracking-normal">
              {GOAL_LABEL[summary?.goalType ?? ""] ?? "Not set"}
            </p>
          </div>
          <Link
            href="/member/nutrition-coach"
            className="hidden rounded-xl border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--pink)]/40 hover:text-[var(--pink)] lg:block"
          >
            Change Plan
          </Link>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm md:grid-cols-3 lg:gap-x-6 lg:gap-y-4">
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Start weight</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatWeight(summary?.startWeight)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Current weight</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatWeight(summary?.currentWeight)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Target weight</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatWeight(summary?.targetWeight)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Body fat</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatBodyFat(summary?.bodyFatPercent)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Plan started</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatDate(summary?.effectiveDate)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Last check-in</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatDate(summary?.lastCheckInDate)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Next check-in</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatDate(summary?.nextCheckInDate)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Estimated metabolism</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatCalories(summary?.estimatedMetabolism)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Daily calorie target</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatCalories(summary?.targetCalories)}</dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Macros (P/C/F)</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">
              {formatGrams(summary?.proteinGrams)} / {formatGrams(summary?.carbsGrams)} / {formatGrams(summary?.fatGrams)}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Metabolism source</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">
              {summary?.metabolismSource === "empirical" ? "Empirical" : summary?.metabolismSource === "formula" ? "Formula" : "-"}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/35 p-3 lg:bg-transparent lg:p-0">
            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60 lg:text-[var(--text-soft)]">Estimate updated</dt>
            <dd className="mt-1 font-bold lg:font-normal lg:text-[var(--text)]">{formatDate(summary?.metabolismEstimatedAt)}</dd>
          </div>
        </dl>
      </div>

    </div>
  );
}
