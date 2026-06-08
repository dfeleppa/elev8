"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Loader2, RotateCcw, Target, X } from "lucide-react";

import NutritionCheckInBanner from "./NutritionCheckInBanner";

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

function clampPercent(v: number) {
  return Math.max(0, Math.min(100, v));
}

function formatDecimal(v: number) {
  return v.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatGoalLabel(goalType: string | null | undefined) {
  if (!goalType) return "Plan Active";
  if (goalType === "lose_weight") return "Lose Weight";
  if (goalType === "gain_weight") return "Gain Weight";
  if (goalType === "maintain_weight") return "Maintain Weight";
  if (goalType === "performance_reverse_diet") return "Performance / Reverse Diet";
  return goalType.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NutritionCoachCard() {
  const [status, setStatus] = useState<"loading" | "has" | "none">("loading");
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsGoal, setSettingsGoal] = useState<GoalType>("lose_weight");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setExpanded(window.matchMedia("(min-width: 1024px)").matches);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/coach/nutrition-plan-status", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setStatus("has");
          setSummary(null);
          return;
        }
        setStatus(payload?.hasPlan ? "has" : "none");
        const s = (payload?.summary ?? null) as CoachPlanSummary | null;
        setSummary(s);
        if (s?.goalType) setSettingsGoal(s.goalType as GoalType);
      })
      .catch(() => {
        if (active) {
          setStatus("has");
          setSummary(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const startWeight = Number(summary?.startWeight ?? 0);
  const trendWeight = Number(summary?.currentWeight ?? summary?.startWeight ?? 0);
  const goalWeight = Number(
    summary?.targetWeight ?? summary?.currentWeight ?? summary?.startWeight ?? 0
  );
  const goalLabel = formatGoalLabel(summary?.goalType);

  const weightProgressPercent = useMemo(() => {
    if (!startWeight || !goalWeight || !trendWeight) return 0;
    const totalDelta = Math.abs(startWeight - goalWeight);
    if (totalDelta === 0) return 100;
    return clampPercent((Math.abs(startWeight - trendWeight) / totalDelta) * 100);
  }, [startWeight, goalWeight, trendWeight]);

  const checkInTimeline = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    if (Number.isNaN(current.getTime())) {
      return { lastDateLabel: "TBD", nextDateLabel: "TBD", filledBars: 0, daysUntilNext: 7 };
    }
    const baseLast = summary?.lastCheckInDate ?? summary?.effectiveDate ?? null;
    const baseNext = summary?.nextCheckInDate ?? null;
    const dayInMs = 24 * 60 * 60 * 1000;
    const parsedLast = baseLast ? new Date(`${baseLast}T00:00:00`) : null;
    const parsedNext = baseNext
      ? new Date(`${baseNext}T00:00:00`)
      : parsedLast
        ? new Date(parsedLast.getTime() + 7 * dayInMs)
        : null;

    if (
      parsedLast &&
      parsedNext &&
      !Number.isNaN(parsedLast.getTime()) &&
      !Number.isNaN(parsedNext.getTime())
    ) {
      const totalDays = Math.max(
        1,
        Math.round((parsedNext.getTime() - parsedLast.getTime()) / dayInMs)
      );
      const elapsedDays = Math.max(
        0,
        Math.min(
          totalDays,
          Math.round((current.getTime() - parsedLast.getTime()) / dayInMs)
        )
      );
      const filledBars = Math.max(0, Math.min(10, Math.floor((elapsedDays / totalDays) * 10)));
      const daysUntilNext = Math.max(
        0,
        Math.ceil((parsedNext.getTime() - current.getTime()) / dayInMs)
      );
      return {
        lastDateLabel: parsedLast.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        nextDateLabel: parsedNext.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        filledBars,
        daysUntilNext,
      };
    }

    const epochDays = Math.floor(current.getTime() / dayInMs);
    const elapsedSinceLast = ((epochDays % 7) + 7) % 7;
    const lastCheckIn = new Date(current);
    lastCheckIn.setDate(current.getDate() - elapsedSinceLast);
    const nextCheckIn = new Date(lastCheckIn);
    nextCheckIn.setDate(lastCheckIn.getDate() + 7);
    const filledBars = Math.max(0, Math.min(10, Math.floor((elapsedSinceLast / 7) * 10)));

    return {
      lastDateLabel: lastCheckIn.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      nextDateLabel: nextCheckIn.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      filledBars,
      daysUntilNext: Math.max(0, 7 - elapsedSinceLast),
    };
  }, [summary?.effectiveDate, summary?.lastCheckInDate, summary?.nextCheckInDate]);

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsError(null);
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
      setSettingsError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function resetPlan() {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/coach/nutrition-plan/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Reset failed.");
      setSummary(null);
      setStatus("none");
      setResetOpen(false);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center panel rounded-3xl p-6 min-h-[120px]">
        <p className="text-sm text-[var(--text-muted)]">Loading coach plan...</p>
      </div>
    );
  }

  if (status === "none") {
    return (
      <div className="panel relative flex min-h-[220px] overflow-hidden rounded-3xl p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[rgba(99,247,255,0.16)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-[rgba(255,177,196,0.22)] blur-3xl" />
        <div className="relative flex w-full flex-col justify-between gap-6">
          <div>
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--pink)]">
              <Target className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Nutrition Coach
            </p>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-[var(--text)]">
              Build your first plan
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-5 text-[var(--text-muted)]">
              Set your goal, starting weight, and targets so your dashboard can show macros, progress, and check-ins.
            </p>
          </div>
        <Link
          href="/member/nutrition/coach"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--pink)] px-5 py-2.5 text-sm font-semibold text-[#0c1118] shadow-[0_14px_30px_rgba(255,177,196,0.22)] transition hover:brightness-110"
        >
          Start plan
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col panel rounded-3xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Coach</p>
          <p className="mt-1 text-sm text-[var(--text)]">{goalLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse coach card" : "Expand coach card"}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label="Coach card menu"
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <circle cx="12" cy="5" r="1.7" fill="currentColor" />
                <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                <circle cx="12" cy="19" r="1.7" fill="currentColor" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--panel)] p-2 shadow-[var(--shadow-md)]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--panel-2)]"
                >
                  Coach settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setResetError(null);
                    setResetOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-400 transition hover:bg-rose-500/10"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Reset plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <NutritionCheckInBanner canManage />

      {expanded ? (
        <>
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Weight Progress</p>
              <p className="text-xs font-semibold text-[var(--text)]">
                {Math.round(weightProgressPercent)}% to goal
              </p>
            </div>
            <div className="flex items-center">
              <div className="grid w-full grid-cols-[auto_1fr_auto_1fr_auto] items-center">
                <div className="flex min-w-[52px] flex-col items-center sm:min-w-[64px]">
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-sky-300/60 bg-[var(--panel-2)] text-[10px] font-semibold text-[var(--text)] sm:h-10 sm:w-10 sm:text-xs">
                    {formatDecimal(startWeight)}
                  </span>
                  <span className="mt-1 text-[10px] text-[var(--text-soft)] sm:text-[11px]">Start</span>
                </div>
                <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-[var(--line-strong)] sm:mx-2">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-500"
                    style={{ width: `${Math.min(100, weightProgressPercent * 2)}%` }}
                  />
                </div>
                <div className="flex min-w-[52px] flex-col items-center sm:min-w-[64px]">
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-semibold sm:h-10 sm:w-10 sm:text-xs ${
                      weightProgressPercent > 0
                        ? "border-cyan-400/60 bg-[var(--panel-2)] text-cyan-500"
                        : "border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-soft)]"
                    }`}
                  >
                    {formatDecimal(trendWeight)}
                  </span>
                  <span className="mt-1 text-[10px] text-[var(--text-soft)] sm:text-[11px]">Current</span>
                </div>
                <div className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-[var(--line-strong)] sm:mx-2">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-500"
                    style={{ width: `${Math.max(0, (weightProgressPercent - 50) * 2)}%` }}
                  />
                </div>
                <div className="flex min-w-[52px] flex-col items-center sm:min-w-[64px]">
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-semibold sm:h-10 sm:w-10 sm:text-xs ${
                      weightProgressPercent >= 100
                        ? "border-emerald-400/60 bg-[var(--panel-2)] text-emerald-500"
                        : "border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-soft)]"
                    }`}
                  >
                    {formatDecimal(goalWeight)}
                  </span>
                  <span className="mt-1 text-[10px] text-[var(--text-soft)] sm:text-[11px]">Goal</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
            <div className="mb-2 flex flex-col gap-1 text-xs font-medium text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
              <p>Last check-in: {checkInTimeline.lastDateLabel}</p>
              <p>Next check-in: {checkInTimeline.nextDateLabel}</p>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={`bar-${i}`}
                  className={`h-2 rounded-full ${
                    i < checkInTimeline.filledBars
                      ? "bg-gradient-to-r from-sky-400 to-cyan-500"
                      : "bg-[var(--line-strong)]"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {checkInTimeline.daysUntilNext === 0
                ? "Check-in due today"
                : `${checkInTimeline.daysUntilNext} day${checkInTimeline.daysUntilNext === 1 ? "" : "s"} until next check-in`}
            </p>
          </div>
        </>
      ) : null}

      {/* Coach Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="panel w-full max-w-sm rounded-2xl p-6 shadow-[var(--shadow-lg)]">
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
                      ? "border-sky-400/40 bg-sky-400/10 text-sky-500"
                      : "border-[var(--line)] bg-[var(--panel-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      settingsGoal === opt.value ? "bg-sky-400" : "bg-[var(--line-strong)]"
                    }`}
                  />
                  {opt.label}
                </button>
              ))}
            </div>

            {settingsError && (
              <p className="mt-3 text-sm text-rose-400">{settingsError}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={saveSettings}
                disabled={settingsSaving}
                className="flex-1 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_20px_rgba(56,189,248,0.2)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {settingsSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                disabled={settingsSaving}
                className="rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="panel w-full max-w-sm rounded-2xl p-6 shadow-[var(--shadow-lg)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[var(--text)]">Reset coach plan?</h3>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                disabled={resetting}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              This deletes your active plan and check-in history so you can rebuild from scratch.
              Food logs, weigh-ins, and learned metabolism data are kept.
            </p>
            {resetError ? <p className="mt-3 text-sm text-rose-400">{resetError}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void resetPlan()}
                disabled={resetting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Reset plan
              </button>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                disabled={resetting}
                className="rounded-lg border border-[var(--line-strong)] bg-[var(--panel-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
