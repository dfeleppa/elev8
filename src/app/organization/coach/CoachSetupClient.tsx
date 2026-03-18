"use client";

import { useEffect, useMemo, useState } from "react";

import type { GoalType, IntensityPreset } from "@/lib/nutrition-calculations";

type PlanPreview = {
  formulaUsed: "katch_mcardle" | "mifflin_st_jeor";
  bmr: number;
  activityMultiplier: number;
  maintenanceCalories: number;
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  weeklyRatePercent: number;
  reverseDietWeeklyKcal: number;
};

const GOAL_OPTIONS: Array<{ value: GoalType; label: string; description: string }> = [
  {
    value: "lose_weight",
    label: "Lose Weight",
    description: "Create a controlled calorie deficit while preserving muscle.",
  },
  {
    value: "gain_weight",
    label: "Gain Weight",
    description: "Build mass with a steady surplus and progressive training.",
  },
  {
    value: "maintain_weight",
    label: "Maintain Weight",
    description: "Hold bodyweight steady while optimizing performance and recovery.",
  },
  {
    value: "performance_reverse_diet",
    label: "Performance / Reverse Diet",
    description: "Increase intake gradually to support training output with controlled gain.",
  },
];

const INTENSITY_OPTIONS: Array<{ value: IntensityPreset; label: string }> = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDisplayNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "0";
}

export default function CoachSetupClient() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [goalType, setGoalType] = useState<GoalType>("lose_weight");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [birthDate, setBirthDate] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState("82");
  const [targetWeightKg, setTargetWeightKg] = useState("78");
  const [heightCm, setHeightCm] = useState("178");
  const [bodyFatPercentage, setBodyFatPercentage] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("4");

  const [intensityPreset, setIntensityPreset] = useState<IntensityPreset>("moderate");
  const [useAdvancedOverride, setUseAdvancedOverride] = useState(false);
  const [weeklyRatePercentOverride, setWeeklyRatePercentOverride] = useState("");
  const [reverseDietWeeklyKcalOverride, setReverseDietWeeklyKcalOverride] = useState("");

  const [effectiveDate, setEffectiveDate] = useState(() => todayIsoDate());
  const [planPreview, setPlanPreview] = useState<PlanPreview | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/coach/nutrition-plan")
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load coach setup data.");
        }
        if (!active) {
          return;
        }

        const profile = payload?.profile;
        const latestPlan = payload?.latestPlan;

        if (profile?.sex === "male" || profile?.sex === "female") {
          setSex(profile.sex);
        }
        if (typeof profile?.birth_date === "string") {
          setBirthDate(profile.birth_date);
        }
        if (typeof profile?.height_cm === "number") {
          setHeightCm(String(profile.height_cm));
        }
        if (typeof profile?.current_weight_kg === "number") {
          setCurrentWeightKg(String(profile.current_weight_kg));
        }
        if (typeof profile?.body_fat_percent === "number") {
          setBodyFatPercentage(String(profile.body_fat_percent));
        }

        if (latestPlan?.goal_type) {
          setGoalType(latestPlan.goal_type as GoalType);
        }
        if (latestPlan?.intensity_preset) {
          setIntensityPreset(latestPlan.intensity_preset as IntensityPreset);
        }
        if (typeof latestPlan?.target_weight_kg === "number") {
          setTargetWeightKg(String(latestPlan.target_weight_kg));
        }
        if (typeof latestPlan?.sessions_per_week === "number") {
          setSessionsPerWeek(String(latestPlan.sessions_per_week));
        }
        if (typeof latestPlan?.effective_date === "string") {
          setEffectiveDate(latestPlan.effective_date);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load coach setup data.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const stepTitle = useMemo(() => {
    if (step === 1) {
      return "Step 1: Goal";
    }
    if (step === 2) {
      return "Step 2: Metrics";
    }
    if (step === 3) {
      return "Step 3: Macro Calculation";
    }
    if (step === 4) {
      return "Step 4: Intensity";
    }
    return "Step 5: Review";
  }, [step]);

  async function runPlan(action: "preview" | "apply") {
    setSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/coach/nutrition-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        goalType,
        sex,
        birthDate,
        currentWeightKg,
        targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
        heightCm,
        bodyFatPercentage: bodyFatPercentage ? Number(bodyFatPercentage) : null,
        sessionsPerWeek: sessionsPerWeek ? Number(sessionsPerWeek) : null,
        intensityPreset,
        weeklyRatePercentOverride:
          useAdvancedOverride && weeklyRatePercentOverride
            ? Number(weeklyRatePercentOverride)
            : null,
        reverseDietWeeklyKcalOverride:
          useAdvancedOverride && reverseDietWeeklyKcalOverride
            ? Number(reverseDietWeeklyKcalOverride)
            : null,
        effectiveDate,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to generate plan.");
      setSaving(false);
      return;
    }

    setPlanPreview(payload.plan as PlanPreview);

    if (action === "apply") {
      setMessage("Plan saved and nutrition targets applied.");
    } else {
      setMessage("Plan generated. Review and continue.");
    }

    setSaving(false);
  }

  function goNext() {
    if (step === 2) {
      if (!currentWeightKg || !heightCm || !birthDate) {
        setError("Current weight, height, and birth date are required.");
        return;
      }
    }
    if (step === 3 && !planPreview) {
      setError("Generate plan before continuing.");
      return;
    }
    setError(null);
    setStep((current) => Math.min(5, current + 1));
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading coach setup...</p>;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">Coach Setup</h1>
        <p className="mt-3 text-sm text-slate-400">
          Build a nutrition plan in 5 steps, then apply today&apos;s targets.
        </p>
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{stepTitle}</p>
          <p className="text-xs font-semibold text-slate-600">{step}/5</p>
        </div>

        <div className="mb-5 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={`step-${index}`}
              className={`h-1.5 rounded-full ${index + 1 <= step ? "bg-sky-500" : "bg-slate-200"}`}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGoalType(option.value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  goalType === option.value
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                <p className="mt-1 text-xs text-slate-500">{option.description}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sex</span>
              <select
                value={sex}
                onChange={(event) => setSex(event.target.value as "male" | "female")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Birth Date</span>
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Current Weight (kg)</span>
              <input
                value={currentWeightKg}
                onChange={(event) => setCurrentWeightKg(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Body Fat % (optional)</span>
              <input
                value={bodyFatPercentage}
                onChange={(event) => setBodyFatPercentage(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Height (cm)</span>
              <input
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Target Weight (kg)</span>
              <input
                value={targetWeightKg}
                onChange={(event) => setTargetWeightKg(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sessions / Week</span>
                <input
                  value={sessionsPerWeek}
                  onChange={(event) => setSessionsPerWeek(event.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Effective Date</span>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void runPlan("preview")}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-[#00c5ff] to-[#39a8ff] px-4 py-2 text-sm font-semibold text-[#031525] disabled:opacity-60"
            >
              {saving ? "Calculating..." : "Generate Targets"}
            </button>

            {planPreview ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <p className="text-sm text-slate-700">Formula: <span className="font-semibold">{planPreview.formulaUsed}</span></p>
                <p className="text-sm text-slate-700">BMR: <span className="font-semibold">{planPreview.bmr}</span></p>
                <p className="text-sm text-slate-700">Maintenance: <span className="font-semibold">{planPreview.maintenanceCalories} kcal</span></p>
                <p className="text-sm text-slate-700">Target: <span className="font-semibold">{planPreview.targetCalories} kcal</span></p>
                <p className="text-sm text-slate-700">Protein: <span className="font-semibold">{toDisplayNumber(planPreview.proteinGrams)} g</span></p>
                <p className="text-sm text-slate-700">Carbs: <span className="font-semibold">{toDisplayNumber(planPreview.carbsGrams)} g</span></p>
                <p className="text-sm text-slate-700">Fat: <span className="font-semibold">{toDisplayNumber(planPreview.fatGrams)} g</span></p>
                <p className="text-sm text-slate-700">Activity: <span className="font-semibold">x{toDisplayNumber(planPreview.activityMultiplier)}</span></p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Intensity Preset</span>
              <select
                value={intensityPreset}
                onChange={(event) => setIntensityPreset(event.target.value as IntensityPreset)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                {INTENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={useAdvancedOverride}
                onChange={(event) => setUseAdvancedOverride(event.target.checked)}
              />
              Use advanced override
            </label>

            {useAdvancedOverride ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Weekly Rate % Override</span>
                  <input
                    value={weeklyRatePercentOverride}
                    onChange={(event) => setWeeklyRatePercentOverride(event.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Reverse Diet Weekly kcal Override</span>
                  <input
                    value={reverseDietWeeklyKcalOverride}
                    onChange={(event) => setReverseDietWeeklyKcalOverride(event.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  />
                </label>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void runPlan("preview")}
              disabled={saving}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Recalculate with intensity
            </button>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Review</p>
            <p className="text-sm text-slate-700">Goal: {goalType.replaceAll("_", " ")}</p>
            <p className="text-sm text-slate-700">Current Weight: {currentWeightKg} kg</p>
            <p className="text-sm text-slate-700">Target Weight: {targetWeightKg || "-"} kg</p>
            <p className="text-sm text-slate-700">Intensity: {intensityPreset}</p>
            {planPreview ? (
              <p className="text-sm text-slate-700">
                Targets: {planPreview.targetCalories} kcal, {toDisplayNumber(planPreview.proteinGrams)}p, {toDisplayNumber(planPreview.carbsGrams)}c, {toDisplayNumber(planPreview.fatGrams)}f
              </p>
            ) : (
              <p className="text-sm text-amber-700">Generate targets before applying.</p>
            )}

            <button
              type="button"
              onClick={() => void runPlan("apply")}
              disabled={saving || !planPreview}
              className="rounded-full bg-gradient-to-r from-[#00c5ff] to-[#39a8ff] px-5 py-2 text-sm font-semibold text-[#031525] disabled:opacity-60"
            >
              {saving ? "Applying..." : "Apply Now"}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={step === 5}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
