"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Atom, Salad, Sparkles } from "lucide-react";

import {
  clampPercent,
  formatGoalLabel,
  hasTargetWeightGoal,
  type CoachPlanSummary,
} from "./lib";

export default function CoachPanel() {
  const [status, setStatus] = useState<"loading" | "has" | "none">("loading");
  const [summary, setSummary] = useState<CoachPlanSummary | null>(null);

  useEffect(() => {
    let isActive = true;

    fetch("/api/coach/nutrition-plan-status", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          setStatus("has");
          setSummary(null);
          return;
        }
        setStatus(payload?.hasPlan ? "has" : "none");
        setSummary((payload?.summary ?? null) as CoachPlanSummary | null);
      })
      .catch(() => {
        if (isActive) {
          setStatus("has");
          setSummary(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const coachWeights = {
    start: Number(summary?.startWeight ?? 0),
    trend: Number(summary?.currentWeight ?? summary?.startWeight ?? 0),
    goal: Number(summary?.targetWeight ?? summary?.currentWeight ?? summary?.startWeight ?? 0),
  };

  const coachGoalLabel = formatGoalLabel(summary?.goalType);
  const showCoachGoalProgress =
    hasTargetWeightGoal(summary?.goalType) && typeof summary?.targetWeight === "number";

  const weightProgressPercent = useMemo(() => {
    if (!coachWeights.start || !coachWeights.goal || !coachWeights.trend) {
      return 0;
    }
    const totalDelta = Math.abs(coachWeights.start - coachWeights.goal);
    if (totalDelta === 0) {
      return 100;
    }
    const progressedDelta = Math.abs(coachWeights.start - coachWeights.trend);
    return clampPercent((progressedDelta / totalDelta) * 100);
  }, [coachWeights.goal, coachWeights.start, coachWeights.trend]);

  const checkInTimeline = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    if (Number.isNaN(current.getTime())) {
      return {
        lastDateLabel: "TBD",
        nextDateLabel: "TBD",
        filledBars: 0,
        daysUntilNext: 10,
      };
    }

    const baseLast = summary?.lastCheckInDate ?? summary?.effectiveDate ?? null;
    const baseNext = summary?.nextCheckInDate ?? null;
    const dayInMs = 24 * 60 * 60 * 1000;

    const parsedLast = baseLast ? new Date(`${baseLast}T00:00:00`) : null;
    const parsedNext = baseNext
      ? new Date(`${baseNext}T00:00:00`)
      : parsedLast
        ? new Date(parsedLast.getTime() + 10 * dayInMs)
        : null;

    if (parsedLast && parsedNext && !Number.isNaN(parsedLast.getTime()) && !Number.isNaN(parsedNext.getTime())) {
      const totalDays = Math.max(1, Math.round((parsedNext.getTime() - parsedLast.getTime()) / dayInMs));
      const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((current.getTime() - parsedLast.getTime()) / dayInMs)));
      const filledBars = Math.max(0, Math.min(10, Math.floor((elapsedDays / totalDays) * 10)));
      const daysUntilNext = Math.max(0, Math.ceil((parsedNext.getTime() - current.getTime()) / dayInMs));

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
    const elapsedSinceLast = ((epochDays % 10) + 10) % 10;
    const filledBars = elapsedSinceLast + 1;

    const lastCheckIn = new Date(current);
    lastCheckIn.setDate(current.getDate() - elapsedSinceLast);

    const nextCheckIn = new Date(lastCheckIn);
    nextCheckIn.setDate(lastCheckIn.getDate() + 10);

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
      daysUntilNext: Math.max(0, 10 - filledBars),
    };
  }, [summary?.effectiveDate, summary?.lastCheckInDate, summary?.nextCheckInDate]);

  const weeklyCheckInTracker = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const progress = clampPercent((checkInTimeline.filledBars / 10) * 100) / 100;
    const completeThrough = Math.floor(progress * labels.length);
    const hasPartial = completeThrough < labels.length && progress > 0 && progress * labels.length > completeThrough;

    return labels.map((label, index) => ({
      label,
      state:
        index < completeThrough
          ? "complete"
          : index === completeThrough && hasPartial
            ? "partial"
            : "empty",
    }));
  }, [checkInTimeline.filledBars]);

  if (status === "loading") {
    return (
      <div className="premium-glass-card p-4 text-sm font-bold text-[#475467]">
        Loading coach plan...
      </div>
    );
  }

  if (status === "none") {
    return (
      <div className="nutrition-coach-hero premium-glass-card flex h-full flex-col overflow-hidden p-5 text-[#17141F] sm:p-6">
        {/* Macro ring visual */}
        <div className="relative mx-auto mb-4 flex h-40 w-full max-w-[280px] items-center justify-center sm:mb-5 sm:h-48">
          <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
            <span className="absolute inset-0 rounded-full border border-[rgba(20,210,220,0.28)]" aria-hidden="true" />
            <span className="absolute inset-[10px] rounded-full border border-[rgba(255,92,168,0.2)]" aria-hidden="true" />
            <span
              className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(20,210,220,0.42),rgba(255,92,168,0.34))] shadow-[inset_0_2px_10px_rgba(255,255,255,0.7),0_12px_26px_rgba(20,210,220,0.18)] sm:h-24 sm:w-24"
              aria-hidden="true"
            >
              <Salad className="h-9 w-9 text-[#0B7C84] sm:h-10 sm:w-10" />
            </span>
          </div>
          {/* Floating macro chips */}
          <span className="absolute left-0 top-[42%] rounded-[12px] border border-[rgba(20,210,220,0.22)] bg-white/82 px-2.5 py-1.5 shadow-[0_8px_18px_rgba(16,24,40,0.08)]">
            <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#0B7C84]">Protein</span>
            <span className="block text-[13px] font-extrabold leading-none text-[#0B7C84]">30%</span>
          </span>
          <span className="absolute right-1 top-2 rounded-[12px] border border-[rgba(255,92,168,0.22)] bg-white/82 px-2.5 py-1.5 shadow-[0_8px_18px_rgba(16,24,40,0.08)]">
            <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#B4236A]">Carbs</span>
            <span className="block text-[13px] font-extrabold leading-none text-[#B4236A]">40%</span>
          </span>
          <span className="absolute bottom-2 right-2 rounded-[12px] border border-[rgba(124,92,224,0.22)] bg-white/82 px-2.5 py-1.5 shadow-[0_8px_18px_rgba(16,24,40,0.08)]">
            <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#6B4FD6]">Fats</span>
            <span className="block text-[13px] font-extrabold leading-none text-[#6B4FD6]">30%</span>
          </span>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[rgba(20,210,220,0.12)] px-3 py-1 text-[11px] font-bold text-[#0B7C84]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Nutrition Coach
        </span>
        <h2 className="mt-3 font-head text-[28px] font-extrabold leading-[1.05] tracking-tight text-[#17141F] sm:text-[32px]">
          Start your plan
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
          Set your goal, get your macros, and build a plan that fits your training.
        </p>
        <Link
          href="/member/nutrition/coach"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#6D3DD4] px-5 py-3.5 text-[15px] font-extrabold text-white shadow-none transition hover:bg-[#5B32B6] sm:mt-5"
        >
          Set My Goal
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`nutrition-coach-panel premium-glass-card flex h-full flex-col overflow-hidden p-3 text-[#17141F] sm:p-5 ${
        checkInTimeline.daysUntilNext === 0 ? "ring-2 ring-[#FF5CA8]/50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-[16px] font-extrabold text-[#17141F] sm:gap-2 sm:text-[19px]">
          <Atom className="h-4 w-4 text-[#FF5CA8] sm:h-5 sm:w-5" aria-hidden="true" />
          Coach
        </div>
        {showCoachGoalProgress ? (
          <span className="rounded-full border border-[#DDE2EA] bg-white/78 px-2 py-0.5 text-[10.5px] font-extrabold text-[#475467] sm:px-2.5 sm:py-1 sm:text-xs">
            {Math.round(weightProgressPercent)}% to goal
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 sm:mt-4">
        <p className="min-w-0 truncate text-[16px] font-semibold leading-tight text-[#17141F] sm:text-[19px]">
          Goal: <span className="font-extrabold">{coachGoalLabel}</span>
        </p>
        <Link
          href="/member/nutrition/coach"
          className="shrink-0 rounded-full bg-[#101828] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_22px_rgba(16,24,40,0.16)] transition hover:brightness-110 sm:px-4 sm:py-2 sm:text-xs"
        >
          View plan
        </Link>
      </div>
      <div className="mt-3 rounded-[16px] border border-[#DDE2EA]/80 bg-white/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] sm:mt-4 sm:rounded-[20px] sm:p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[12.5px] font-extrabold text-[#344054] sm:text-[15px] ${checkInTimeline.daysUntilNext === 0 ? "uppercase text-[#B4236A]" : ""}`}>
          {checkInTimeline.daysUntilNext === 0
            ? "Check-in due today"
            : `${checkInTimeline.daysUntilNext} day${checkInTimeline.daysUntilNext === 1 ? "" : "s"} until check-in`}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 sm:mt-3 sm:gap-1.5">
          {weeklyCheckInTracker.map((day) => (
            <span key={`coach-week-${day.label}`} className="min-w-0 text-center">
              <span
                className={`mx-auto block h-5 rounded-[7px] border sm:h-8 sm:rounded-[10px] ${
                  day.state === "complete"
                    ? "border-[#14D2DC]/45 bg-[#14D2DC]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]"
                    : day.state === "partial"
                      ? "border-[#FF5CA8]/38 bg-[linear-gradient(135deg,rgba(255,92,168,0.2)_0%,rgba(255,92,168,0.2)_50%,rgba(255,255,255,0.74)_50%,rgba(255,255,255,0.74)_100%)]"
                      : "border-[#DDE2EA] bg-white/72"
                }`}
              />
              <span
                className={`mt-1 block text-[8.5px] font-extrabold uppercase tracking-[0.02em] sm:mt-1.5 sm:text-[10.5px] sm:tracking-[0.06em] ${
                  day.state === "complete"
                    ? "text-[#0C7D85]"
                    : day.state === "partial"
                      ? "text-[#B4236A]"
                      : "text-[#667085]"
                }`}
              >
                <span className="sm:hidden">{day.label.slice(0, 1)}</span>
                <span className="hidden sm:inline">{day.label}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
      <Link
        href="/member/nutrition/coach"
        className={`mt-3 flex items-center justify-center rounded-[16px] px-4 py-2.5 text-[12px] font-extrabold transition sm:mt-4 sm:rounded-[20px] sm:text-[13px] ${
          checkInTimeline.daysUntilNext === 0
            ? "bg-[#FF5CA8] text-white shadow-[0_10px_22px_rgba(255,92,168,0.28)] hover:brightness-110"
            : "bg-[#101828] text-white shadow-[0_10px_22px_rgba(16,24,40,0.16)] hover:brightness-110"
        }`}
      >
        {checkInTimeline.daysUntilNext === 0 ? "Start weekly check-in" : "Check-in"}
      </Link>
    </div>
  );
}
