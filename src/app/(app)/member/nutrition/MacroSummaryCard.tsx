"use client";

import { useState } from "react";
import { Flame } from "lucide-react";

import BodyMetricsForm from "./BodyMetricsForm";
import {
  CALORIE_TOLERANCE,
  MACRO_TOLERANCE_GRAMS,
  STATUS_TEXT_COLOR,
  clampPercent,
  ringDashArray,
  roundToWhole,
  statusFromDiff,
} from "./lib";

type MacroSummaryCardProps = {
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  targets: { calories: string; protein: string; carbs: string; fat: string; fiber: string };
  onError: (message: string | null) => void;
};

export default function MacroSummaryCard({ totals, targets, onError }: MacroSummaryCardProps) {
  const [macroViewMode, setMacroViewMode] = useState<"consumed" | "remaining">("consumed");

  const targetNumbers = {
    calories: targets.calories ? Number(targets.calories) : 0,
    protein: targets.protein ? Number(targets.protein) : 0,
    carbs: targets.carbs ? Number(targets.carbs) : 0,
    fat: targets.fat ? Number(targets.fat) : 0,
  };

  const remaining = {
    calories: targetNumbers.calories - totals.calories,
  };

  const proteinProgress = targetNumbers.protein
    ? clampPercent((totals.protein / targetNumbers.protein) * 100)
    : 0;

  const carbsProgress = targetNumbers.carbs
    ? clampPercent((totals.carbs / targetNumbers.carbs) * 100)
    : 0;

  const fatProgress = targetNumbers.fat
    ? clampPercent((totals.fat / targetNumbers.fat) * 100)
    : 0;

  const caloriesProgress = targetNumbers.calories
    ? clampPercent((totals.calories / targetNumbers.calories) * 100)
    : 0;

  // Fiber goal: prefer the coach plan's fiber target, otherwise 1 g per 72 kcal
  // of the calorie target (matching the plan formula), with a 25 g floor.
  const fiberTarget = targets.fiber
    ? Number(targets.fiber)
    : targetNumbers.calories
      ? Math.max(25, Math.round(targetNumbers.calories / 72))
      : 30;
  const fiberProgress = fiberTarget ? clampPercent((totals.fiber / fiberTarget) * 100) : 0;

  const consumedMacroBars = [
    {
      label: "Protein",
      value: totals.protein,
      target: targetNumbers.protein,
      progress: proteinProgress,
      status: statusFromDiff(totals.protein, targetNumbers.protein, MACRO_TOLERANCE_GRAMS),
    },
    {
      label: "Carbs",
      value: totals.carbs,
      target: targetNumbers.carbs,
      progress: carbsProgress,
      status: statusFromDiff(totals.carbs, targetNumbers.carbs, MACRO_TOLERANCE_GRAMS),
    },
    {
      label: "Fat",
      value: totals.fat,
      target: targetNumbers.fat,
      progress: fatProgress,
      status: statusFromDiff(totals.fat, targetNumbers.fat, MACRO_TOLERANCE_GRAMS),
    },
    {
      label: "Fiber",
      value: totals.fiber,
      target: fiberTarget,
      progress: fiberProgress,
      status: statusFromDiff(totals.fiber, fiberTarget, MACRO_TOLERANCE_GRAMS),
    },
  ];

  const remainingMacroBars = consumedMacroBars.map((bar) => ({
    ...bar,
    value: Math.max(0, bar.target - bar.value),
    progress: bar.target ? clampPercent((Math.max(0, bar.target - bar.value) / bar.target) * 100) : 0,
  }));

  const caloriesStatus = statusFromDiff(totals.calories, targetNumbers.calories, CALORIE_TOLERANCE);

  const showingRemaining = macroViewMode === "remaining";
  const displayCalories = showingRemaining ? Math.max(0, remaining.calories) : totals.calories;
  const displayCaloriesProgress = showingRemaining ? clampPercent(100 - caloriesProgress) : caloriesProgress;
  const macroBars = showingRemaining ? remainingMacroBars : consumedMacroBars;

  return (
    <div className="nutrition-macro-card premium-glass-card flex h-full flex-col p-3 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-[16px] font-extrabold text-[var(--nutrition-text-primary)] sm:gap-2 sm:text-[19px]">
          <Flame className="h-4 w-4 text-[var(--nutrition-accent-pink)] sm:h-5 sm:w-5" aria-hidden="true" />
          Macros
        </div>
        <div className="inline-flex rounded-full border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface-soft)] p-0.5 text-[10px] font-bold shadow-inner sm:text-[11px]">
          <button
            type="button"
            onClick={() => setMacroViewMode("consumed")}
            className={`rounded-full px-2 py-1 transition sm:px-2.5 ${
              !showingRemaining ? "bg-[var(--nutrition-button-bg)] text-[var(--nutrition-button-text)]" : "text-[var(--nutrition-text-soft)]"
            }`}
          >
            Consumed
          </button>
          <button
            type="button"
            onClick={() => setMacroViewMode("remaining")}
            className={`rounded-full px-2 py-1 transition sm:px-2.5 ${
              showingRemaining ? "bg-[var(--nutrition-button-bg)] text-[var(--nutrition-button-text)]" : "text-[var(--nutrition-text-soft)]"
            }`}
          >
            Left
          </button>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2.5 sm:hidden">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-[18px] border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_10px_20px_rgba(16,24,40,0.055)]">
          <svg className="h-[86px] w-[86px]" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="mobile-calorie-ring-compact" x1="14" y1="14" x2="106" y2="106">
                <stop stopColor="#14D2DC" />
                <stop offset="1" stopColor="#0BA7B0" />
              </linearGradient>
            </defs>
            <g transform="rotate(-90 60 60)">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#E7EAEE" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="none"
                stroke="url(#mobile-calorie-ring-compact)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={ringDashArray(displayCaloriesProgress, 45)}
              />
            </g>
          </svg>
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
            <p
              className="w-full truncate text-[17px] font-extrabold leading-none text-[var(--nutrition-text-primary)]"
              style={STATUS_TEXT_COLOR[caloriesStatus] ? { color: STATUS_TEXT_COLOR[caloriesStatus]! } : undefined}
            >
              {roundToWhole(displayCalories).toLocaleString()}
            </p>
            <span className="mt-1 text-[9.5px] font-extrabold uppercase leading-none tracking-[0.08em] text-[var(--nutrition-text-soft)]">
              Cal
            </span>
          </div>
        </div>

        <div className="grid gap-1.5">
          {macroBars.map((bar, index) => {
            const baseColor =
              index === 0
                ? "var(--nutrition-bar-protein)"
                : index === 1
                  ? "var(--nutrition-bar-carbs)"
                  : index === 2
                    ? "var(--nutrition-bar-fat)"
                    : "var(--nutrition-bar-fiber)";
            const statusColor = STATUS_TEXT_COLOR[bar.status];
            const shortLabel = index === 0 ? "P" : index === 1 ? "C" : index === 2 ? "F" : "Fb";
            return (
              <div key={`mobile-macro-${bar.label}`} className="nutrition-metric-card grid min-w-0 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface)] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
                <p className="text-[12px] font-extrabold text-[var(--nutrition-text-primary)]">{shortLabel}</p>
                <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[var(--nutrition-track)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${bar.progress}%`, backgroundColor: baseColor }}
                  />
                </div>
                <p
                  className="text-[11px] font-extrabold tabular-nums text-[var(--nutrition-text-primary)]"
                  style={statusColor ? { color: statusColor } : undefined}
                >
                  {roundToWhole(bar.value)}
                  <span className="font-bold text-[var(--nutrition-text-soft)]">/{roundToWhole(bar.target)}g</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid flex-1 gap-3 sm:mt-5 sm:grid-cols-[minmax(180px,230px)_1fr] sm:items-center sm:gap-5 lg:gap-8">
        <div className="relative mx-auto hidden aspect-square w-full max-w-[190px] place-items-center sm:grid lg:max-w-[230px]">
          <svg className="absolute inset-0" viewBox="0 0 150 150" aria-hidden="true">
            <defs>
              <linearGradient id="mobile-calorie-ring" x1="18" y1="18" x2="132" y2="132">
                <stop stopColor="#14D2DC" />
                <stop offset="1" stopColor="#0BA7B0" />
              </linearGradient>
            </defs>
            <g transform="rotate(-90 75 75)">
              <circle cx="75" cy="75" r="61" fill="none" stroke="#E7EAEE" strokeWidth="12" />
              <circle
                cx="75"
                cy="75"
                r="61"
                fill="none"
                stroke="url(#mobile-calorie-ring)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={ringDashArray(displayCaloriesProgress, 61)}
                filter="drop-shadow(0 4px 8px rgba(20,210,220,0.32))"
              />
            </g>
          </svg>
          <div className="text-center">
            <p
              className="text-[34px] font-bold leading-none tracking-[-0.02em] text-[var(--nutrition-text-primary)]"
              style={STATUS_TEXT_COLOR[caloriesStatus] ? { color: STATUS_TEXT_COLOR[caloriesStatus]! } : undefined}
            >
              {roundToWhole(displayCalories).toLocaleString()}
            </p>
            <p className="mt-1 text-[13px] font-bold text-[var(--nutrition-text-muted)]">
              / {roundToWhole(targetNumbers.calories || 0).toLocaleString()} Cal
            </p>
            <p
              className="mt-1 text-sm font-bold text-[var(--nutrition-teal-text)]"
              style={STATUS_TEXT_COLOR[caloriesStatus] ? { color: STATUS_TEXT_COLOR[caloriesStatus]! } : undefined}
            >
              {Math.round(displayCaloriesProgress)}%
            </p>
          </div>
        </div>

        <div className="hidden grid-cols-4 gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
          {macroBars.map((bar, index) => {
            const baseColor =
              index === 0
                ? "var(--nutrition-bar-protein)"
                : index === 1
                  ? "var(--nutrition-bar-carbs)"
                  : index === 2
                    ? "var(--nutrition-bar-fat)"
                    : "var(--nutrition-bar-fiber)";
            const statusColor = STATUS_TEXT_COLOR[bar.status];
            return (
              <div key={bar.label} className="nutrition-metric-card min-w-0 rounded-[14px] border border-[var(--nutrition-card-border)] bg-[var(--nutrition-surface)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_10px_20px_rgba(16,24,40,0.055)] sm:rounded-[18px] sm:p-4 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_14px_30px_rgba(16,24,40,0.075)]">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-extrabold text-[var(--nutrition-text-primary)] sm:text-[13px]">{bar.label}</p>
                  <p
                    className="mt-0.5 text-[12px] font-extrabold tabular-nums text-[var(--nutrition-text-primary)] sm:text-[15px]"
                    style={statusColor ? { color: statusColor } : undefined}
                  >
                    {roundToWhole(bar.value)}
                    <span
                      className="font-bold text-[var(--nutrition-text-muted)]"
                      style={statusColor ? { color: statusColor } : undefined}
                    >
                      /{roundToWhole(bar.target)}g
                    </span>
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--nutrition-track)] sm:mt-3 sm:h-3.5">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${bar.progress}%`, backgroundColor: baseColor }}
                  />
                </div>
                <p
                  className="mt-1 hidden text-right text-[11px] font-extrabold tabular-nums sm:block"
                  style={{ color: statusColor ?? baseColor }}
                >
                  {Math.round(bar.progress)}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <BodyMetricsForm onError={onError} />
    </div>
  );
}
