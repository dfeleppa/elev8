"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  WEEKLY_RATE_PERCENT_BOUNDS,
  clampWeeklyRatePercent,
  type GoalType,
  type IntensityPreset,
} from "@/lib/nutrition-calculations";

type PlanPreview = {
  formulaUsed: "katch_mcardle" | "mifflin_st_jeor";
  bmr: number;
  activityMultiplier: number;
  maintenanceCalories: number;
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  leanBodyMassLbs: number;
  proteinBodyFatPercentage: number;
  proteinBasis: "measured_body_fat" | "bmi_estimated_body_fat";
  bodyFatRecommendation: string | null;
  weeklyRatePercent: number;
  reverseDietWeeklyKcal: number;
};

type LatestPlanPayload = {
  weeklyRatePercentOverride?: number | null;
  reverseDietWeeklyKcalOverride?: number | null;
  weightLbs?: number | null;
  sex?: "male" | "female" | null;
  bodyFatPercentage?: number | null;
  proteinBodyFatPercentage?: number | null;
  leanBodyMassLbs?: number | null;
  proteinBasis?: PlanPreview["proteinBasis"] | null;
};

type LatestPlan = {
  goal_type?: GoalType | null;
  intensity_preset?: IntensityPreset | null;
  weekly_rate_percent?: number | null;
  reverse_diet_weekly_kcal?: number | null;
  target_weight_lbs?: number | null;
  maintenance_calories?: number | null;
  target_calories?: number | null;
  protein_grams?: number | null;
  carbs_grams?: number | null;
  fat_grams?: number | null;
  formula_used?: PlanPreview["formulaUsed"] | null;
  activity_multiplier?: number | null;
  sessions_per_week?: number | null;
  effective_date?: string | null;
  plan_payload?: LatestPlanPayload | null;
};

type Profile = {
  sex?: "male" | "female" | null;
  birth_date?: string | null;
  height_cm?: number | null;
  current_weight_kg?: number | null;
  body_fat_percent?: number | null;
};

const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: "Lose Weight",
  gain_weight: "Gain Weight",
  maintain_weight: "Maintain Weight",
  performance_reverse_diet: "Performance / Reverse Diet",
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

// Quick-pick %/week defaults per goal + intensity, kept inside the goal-aware caps.
const RATE_PRESET_DEFAULTS: Record<GoalType, Record<IntensityPreset, number>> = {
  lose_weight: { conservative: 0.25, moderate: 0.5, aggressive: 0.75 },
  gain_weight: { conservative: 0.2, moderate: 0.35, aggressive: 0.5 },
  maintain_weight: { conservative: 0, moderate: 0.1, aggressive: 0.25 },
  performance_reverse_diet: { conservative: 0, moderate: 0, aggressive: 0 },
};

function defaultRateFor(goal: GoalType, preset: IntensityPreset) {
  return clampWeeklyRatePercent(goal, RATE_PRESET_DEFAULTS[goal][preset]);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDisplayNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "0";
}

function toPositiveNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toNonNegativeNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toMeasuredBodyFatOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 2 && parsed < 70 ? parsed : null;
}

function formatDate(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatProteinCalculation(weightLbs: string, plan: PlanPreview) {
  const parsedWeight = Number(weightLbs);
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
    return `${toDisplayNumber(plan.leanBodyMassLbs)} lb lean mass x 1g/lb = ${toDisplayNumber(plan.proteinGrams)}g protein`;
  }

  return (
    `${toDisplayNumber(parsedWeight)} lb x (1 - ${toDisplayNumber(plan.proteinBodyFatPercentage)}% body fat est.) = ` +
    `${toDisplayNumber(plan.leanBodyMassLbs)} lb lean mass x 1g/lb = ${toDisplayNumber(plan.proteinGrams)}g protein`
  );
}

function daysSince(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00`).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / 86_400_000));
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/66 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#17141F]">{value}</p>
    </div>
  );
}

type CoachSetupClientProps = {
  /** Force the wizard view on mount even when an active plan exists. */
  initialMode?: "dashboard" | "setup";
  /** When set, navigate here after successful save instead of switching to the internal dashboard view. */
  redirectAfterSaveTo?: string;
};

export default function CoachSetupClient({
  initialMode = "setup",
  redirectAfterSaveTo,
}: CoachSetupClientProps = {}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"dashboard" | "setup">(initialMode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hasPlan, setHasPlan] = useState(false);
  const [activePlan, setActivePlan] = useState<LatestPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState<GoalType>("lose_weight");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [birthDate, setBirthDate] = useState("");
  const [currentWeightLbs, setCurrentWeightLbs] = useState("180");
  const [targetWeightLbs, setTargetWeightLbs] = useState("172");
  const [heightCm, setHeightCm] = useState("178");
  const [bodyFatPercentage, setBodyFatPercentage] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("4");
  const [intensityPreset, setIntensityPreset] = useState<IntensityPreset>("moderate");
  // Explicit, goal-capped rate of change in % bodyweight / week.
  const [weeklyRatePercent, setWeeklyRatePercent] = useState<number>(() =>
    defaultRateFor("lose_weight", "moderate")
  );
  const [reverseDietWeeklyKcalOverride, setReverseDietWeeklyKcalOverride] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => todayIsoDate());
  const [planPreview, setPlanPreview] = useState<PlanPreview | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/coach/nutrition-plan")
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load nutrition coach data.");
        }
        if (!active) return;

        const prof = payload?.profile as Profile | null;
        const latestPlan = (payload?.latestPlan ?? null) as LatestPlan | null;
        const planExists = Boolean(payload?.hasPlan);

        setProfile(prof ?? null);
        setActivePlan(latestPlan);
        setHasPlan(planExists);

        if (prof?.sex === "male" || prof?.sex === "female") setSex(prof.sex);
        if (typeof prof?.birth_date === "string") setBirthDate(prof.birth_date);
        if (typeof prof?.height_cm === "number") setHeightCm(String(prof.height_cm));
        if (typeof prof?.current_weight_kg === "number") {
          setCurrentWeightLbs(String(Math.round(prof.current_weight_kg * 2.20462 * 10) / 10));
        }
        if (typeof prof?.body_fat_percent === "number" && prof.body_fat_percent > 2 && prof.body_fat_percent < 70) {
          setBodyFatPercentage(String(prof.body_fat_percent));
        }

        const loadedGoal = (latestPlan?.goal_type ?? "lose_weight") as GoalType;
        const loadedPreset = (latestPlan?.intensity_preset ?? "moderate") as IntensityPreset;
        if (latestPlan?.goal_type) setGoalType(loadedGoal);
        if (latestPlan?.intensity_preset) setIntensityPreset(loadedPreset);
        if (typeof latestPlan?.target_weight_lbs === "number") setTargetWeightLbs(String(latestPlan.target_weight_lbs));
        if (typeof latestPlan?.sessions_per_week === "number") setSessionsPerWeek(String(latestPlan.sessions_per_week));
        if (typeof latestPlan?.effective_date === "string") setEffectiveDate(latestPlan.effective_date);
        if (typeof latestPlan?.weekly_rate_percent === "number" && latestPlan.weekly_rate_percent > 0) {
          setWeeklyRatePercent(clampWeeklyRatePercent(loadedGoal, latestPlan.weekly_rate_percent));
        } else {
          setWeeklyRatePercent(defaultRateFor(loadedGoal, loadedPreset));
        }
        if (typeof latestPlan?.plan_payload?.reverseDietWeeklyKcalOverride === "number") {
          setReverseDietWeeklyKcalOverride(String(latestPlan.plan_payload.reverseDietWeeklyKcalOverride));
        }

        if (planExists && latestPlan && initialMode !== "setup") {
          setViewMode("dashboard");
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load nutrition coach data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const stepTitle = useMemo(() => {
    const titles = ["", "Step 1: Goal", "Step 2: Metrics", "Step 3: Macro Calculation", "Step 4: Intensity", "Step 5: Review"];
    return titles[step] ?? "Review";
  }, [step]);

  async function runPlan(action: "preview" | "apply") {
    setSaving(true);
    setError(null);
    setMessage(null);

    const currentWeightNumber = toPositiveNumberOrNull(currentWeightLbs);
    const heightNumber = toPositiveNumberOrNull(heightCm);
    const measuredBodyFatPercentage = toMeasuredBodyFatOrNull(bodyFatPercentage);

    const response = await fetch("/api/coach/nutrition-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        goalType,
        sex,
        birthDate,
        currentWeightLbs,
        targetWeightLbs: toPositiveNumberOrNull(targetWeightLbs),
        heightCm,
        bodyFatPercentage: measuredBodyFatPercentage,
        sessionsPerWeek: toPositiveNumberOrNull(sessionsPerWeek),
        intensityPreset,
        weeklyRatePercentOverride:
          goalType === "performance_reverse_diet"
            ? null
            : clampWeeklyRatePercent(goalType, weeklyRatePercent),
        reverseDietWeeklyKcalOverride:
          goalType === "performance_reverse_diet"
            ? toNonNegativeNumberOrNull(reverseDietWeeklyKcalOverride)
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

    const newPlan = payload.plan as PlanPreview;
    setPlanPreview(newPlan);

    if (action === "apply") {
      const updatedPlan: LatestPlan = {
        goal_type: goalType,
        intensity_preset: intensityPreset,
        weekly_rate_percent: newPlan.weeklyRatePercent,
        reverse_diet_weekly_kcal: newPlan.reverseDietWeeklyKcal,
        target_weight_lbs: targetWeightLbs ? Number(targetWeightLbs) : null,
        maintenance_calories: newPlan.maintenanceCalories,
        target_calories: newPlan.targetCalories,
        protein_grams: newPlan.proteinGrams,
        carbs_grams: newPlan.carbsGrams,
        fat_grams: newPlan.fatGrams,
        formula_used: newPlan.formulaUsed,
        activity_multiplier: newPlan.activityMultiplier,
        sessions_per_week: sessionsPerWeek ? Number(sessionsPerWeek) : null,
        effective_date: effectiveDate,
        plan_payload: {
          weeklyRatePercentOverride:
            goalType === "performance_reverse_diet"
              ? null
              : clampWeeklyRatePercent(goalType, weeklyRatePercent),
          reverseDietWeeklyKcalOverride:
            goalType === "performance_reverse_diet"
              ? toNonNegativeNumberOrNull(reverseDietWeeklyKcalOverride)
              : null,
          weightLbs: currentWeightNumber,
          sex,
          bodyFatPercentage: measuredBodyFatPercentage,
          proteinBodyFatPercentage: newPlan.proteinBodyFatPercentage,
          leanBodyMassLbs: newPlan.leanBodyMassLbs,
          proteinBasis: newPlan.proteinBasis,
        },
      };
      setActivePlan(updatedPlan);
      setProfile((prev) => ({
        ...prev,
        current_weight_kg: currentWeightNumber ? currentWeightNumber / 2.20462 : prev?.current_weight_kg,
        body_fat_percent: measuredBodyFatPercentage,
        sex,
        birth_date: birthDate || prev?.birth_date,
        height_cm: heightNumber ?? prev?.height_cm,
      }));
      setHasPlan(true);
      setMessage("Plan saved and nutrition targets applied.");
      if (redirectAfterSaveTo) {
        router.push(redirectAfterSaveTo);
        router.refresh();
      } else {
        setViewMode("dashboard");
      }
    } else {
      setMessage("Plan generated. Review and continue.");
    }

    setSaving(false);
  }

  function goNext() {
    if (step === 2 && (!currentWeightLbs || !heightCm || !birthDate)) {
      setError("Current weight, height, and birth date are required.");
      return;
    }
    if (step === 3 && !planPreview) {
      setError("Generate plan before continuing.");
      return;
    }
    setError(null);
    setStep((current) => Math.min(5, current + 1));
  }

  function startChangePlan() {
    setStep(1);
    setPlanPreview(null);
    setMessage(null);
    setError(null);
    setViewMode("setup");
  }

  if (loading) {
    return <p className="text-sm text-[#667085]">Loading nutrition coach...</p>;
  }

  // ── Dashboard (active plan exists) ───────────────────────────────────────
  if (viewMode === "dashboard" && hasPlan && activePlan) {
    const startWeightLbs = activePlan.plan_payload?.weightLbs ?? null;
    const payloadStartBf = activePlan.plan_payload?.bodyFatPercentage ?? null;
    const startBf = typeof payloadStartBf === "number" && payloadStartBf > 2 && payloadStartBf < 70 ? payloadStartBf : null;
    const currentWeightKg = profile?.current_weight_kg ?? null;
    const profileCurrentBf = profile?.body_fat_percent ?? null;
    const currentBf =
      typeof profileCurrentBf === "number" && profileCurrentBf > 2 && profileCurrentBf < 70 ? profileCurrentBf : null;
    const currentLbs = currentWeightKg !== null ? Math.round(currentWeightKg * 2.20462 * 10) / 10 : null;

    const weightDelta =
      startWeightLbs !== null && currentLbs !== null
        ? Math.round((currentLbs - startWeightLbs) * 10) / 10
        : null;

    const daysOnPlan = activePlan.effective_date ? daysSince(activePlan.effective_date) : null;

    return (
      <section className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[#17141F]">Nutrition Coach</h1>
            <p className="mt-1 text-sm text-[#667085]">Your active plan and progress.</p>
          </div>
          <button
            type="button"
            onClick={startChangePlan}
            className="shrink-0 rounded-full border border-[rgba(16,24,40,0.12)] bg-white/70 px-4 py-2 text-xs font-bold text-[#17141F] transition hover:bg-white"
          >
            Change Plan
          </button>
        </header>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        {/* Plan Overview */}
        <div className="rounded-3xl border border-[rgba(16,24,40,0.08)] bg-white/66 p-5 space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[#667085]">Plan Overview</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Goal"
              value={activePlan.goal_type ? GOAL_LABELS[activePlan.goal_type] : "—"}
            />
            <StatCard
              label="Plan Started"
              value={activePlan.effective_date ? formatDate(activePlan.effective_date) : "—"}
            />
            <StatCard
              label="Days on Plan"
              value={daysOnPlan !== null ? String(daysOnPlan) : "—"}
            />
            <StatCard
              label="Daily Calories"
              value={activePlan.target_calories !== null && activePlan.target_calories !== undefined ? `${activePlan.target_calories} kcal` : "—"}
            />
            <StatCard
              label="Protein Target"
              value={activePlan.protein_grams !== null && activePlan.protein_grams !== undefined ? `${toDisplayNumber(activePlan.protein_grams)} g` : "—"}
            />
            <StatCard
              label="Intensity"
              value={activePlan.intensity_preset
                ? activePlan.intensity_preset.charAt(0).toUpperCase() + activePlan.intensity_preset.slice(1)
                : "—"}
            />
          </div>
        </div>

        {/* Starting Stats */}
        <div className="rounded-3xl border border-[rgba(16,24,40,0.08)] bg-white/66 p-5 space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[#667085]">Starting Stats</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Start Weight"
              value={startWeightLbs !== null ? `${startWeightLbs} lbs` : "—"}
            />
            <StatCard
              label="Start Body Fat"
              value={startBf !== null ? `${startBf}%` : "—"}
            />
            <StatCard
              label="Target Weight"
              value={activePlan.target_weight_lbs !== null && activePlan.target_weight_lbs !== undefined ? `${activePlan.target_weight_lbs} lbs` : "—"}
            />
          </div>
        </div>

        {/* Current Stats & Progress */}
        <div className="rounded-3xl border border-[rgba(16,24,40,0.08)] bg-white/66 p-5 space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[#667085]">Current Stats & Progress</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Current Weight"
              value={currentLbs !== null ? `${currentLbs} lbs` : "—"}
            />
            <StatCard
              label="Current Body Fat"
              value={currentBf !== null ? `${currentBf}%` : "—"}
            />
            <StatCard
              label="Weight Change"
              value={
                weightDelta !== null
                  ? `${weightDelta > 0 ? "+" : ""}${weightDelta} lbs`
                  : "—"
              }
            />
            <StatCard
              label="Maintenance Calories"
              value={activePlan.maintenance_calories !== null && activePlan.maintenance_calories !== undefined ? `${activePlan.maintenance_calories} kcal` : "—"}
            />
            <StatCard
              label="Carbs Target"
              value={activePlan.carbs_grams !== null && activePlan.carbs_grams !== undefined ? `${toDisplayNumber(activePlan.carbs_grams)} g` : "—"}
            />
            <StatCard
              label="Fat Target"
              value={activePlan.fat_grams !== null && activePlan.fat_grams !== undefined ? `${toDisplayNumber(activePlan.fat_grams)} g` : "—"}
            />
          </div>
        </div>
      </section>
    );
  }

  // ── Setup Wizard ─────────────────────────────────────────────────────────
  const rateBounds = WEEKLY_RATE_PERCENT_BOUNDS[goalType];
  const rateWeightLbs = toPositiveNumberOrNull(currentWeightLbs) ?? 0;
  const rateLbsPerWeek = (weeklyRatePercent / 100) * rateWeightLbs;
  const rateLabel = goalType === "maintain_weight" ? "Allowed weekly gain" : "Target rate of change";
  const isReverseDiet = goalType === "performance_reverse_diet";

  return (
    <section className="space-y-5">
      {!redirectAfterSaveTo ? (
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[#17141F]">Nutrition Coach</h1>
            <p className="mt-3 text-sm text-[#667085]">
              {hasPlan ? "Update your nutrition plan." : "Build a nutrition plan in 5 steps, then apply today's targets."}
            </p>
          </div>
          {hasPlan ? (
            <button
              type="button"
              onClick={() => { setMessage(null); setError(null); setViewMode("dashboard"); }}
              className="shrink-0 rounded-full border border-[rgba(16,24,40,0.12)] bg-white/70 px-4 py-2 text-xs font-bold text-[#17141F] transition hover:bg-white"
            >
              Back to Plan
            </button>
          ) : null}
        </header>
      ) : null}

      <div className="premium-glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#667085]">{stepTitle}</p>
          <p className="text-xs font-bold text-[#475467]">{step}/5</p>
        </div>

        <div className="mb-5 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={`step-${index}`}
              className={`h-1.5 rounded-full ${index + 1 <= step ? "bg-[#14D2DC]" : "bg-[rgba(16,24,40,0.1)]"}`}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setGoalType(option.value);
                  setWeeklyRatePercent(defaultRateFor(option.value, intensityPreset));
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  goalType === option.value
                    ? "border-[rgba(20,210,220,0.4)] bg-[rgba(20,210,220,0.08)]"
                    : "border-[rgba(16,24,40,0.08)] bg-white/60 hover:border-[rgba(20,210,220,0.24)] hover:bg-[rgba(20,210,220,0.05)]"
                }`}
              >
                <p className="text-sm font-bold text-[#17141F]">{option.label}</p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">{option.description}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Sex</span>
              <select
                value={sex}
                onChange={(event) => setSex(event.target.value as "male" | "female")}
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Birth Date</span>
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Current Weight (lbs)</span>
              <input
                value={currentWeightLbs}
                onChange={(event) => setCurrentWeightLbs(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Body Fat % (optional)</span>
              <input
                value={bodyFatPercentage}
                onChange={(event) => setBodyFatPercentage(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              />
              <span className="block text-xs text-[#98A2B3]">
                If unknown, test body fat when you can. Until then, protein uses a BMI-based body fat estimate.
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Height (cm)</span>
              <input
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Target Weight (lbs)</span>
              <input
                value={targetWeightLbs}
                onChange={(event) => setTargetWeightLbs(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Sessions / Week</span>
                <input
                  value={sessionsPerWeek}
                  onChange={(event) => setSessionsPerWeek(event.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Effective Date</span>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void runPlan("preview")}
              disabled={saving}
              className="rounded-2xl bg-[#14D2DC] px-5 py-2.5 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105 disabled:opacity-60"
            >
              {saving ? "Calculating..." : "Generate Targets"}
            </button>

            {planPreview ? (
              <div className="grid gap-3 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/66 p-4 sm:grid-cols-2">
                <p className="text-sm text-[#475467]">Formula: <span className="font-semibold text-[#17141F]">{planPreview.formulaUsed}</span></p>
                <p className="text-sm text-[#475467]">BMR: <span className="font-semibold text-[#17141F]">{planPreview.bmr}</span></p>
                <p className="text-sm text-[#475467]">Maintenance: <span className="font-semibold text-[#17141F]">{planPreview.maintenanceCalories} kcal</span></p>
                <p className="text-sm text-[#475467]">Target: <span className="font-semibold text-[#17141F]">{planPreview.targetCalories} kcal</span></p>
                <p className="text-sm text-[#475467]">Protein: <span className="font-semibold text-[#17141F]">{toDisplayNumber(planPreview.proteinGrams)} g</span></p>
                {planPreview.proteinBasis === "bmi_estimated_body_fat" || !bodyFatPercentage.trim() ? (
                  <p className="sm:col-span-2 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-3 py-2 text-sm font-semibold text-[#92610A]">
                    <span className="font-semibold">Protein calculation:</span>{" "}
                    {formatProteinCalculation(currentWeightLbs, planPreview)}
                  </p>
                ) : null}
                <p className="text-sm text-[#475467]">Lean Mass: <span className="font-semibold text-[#17141F]">{toDisplayNumber(planPreview.leanBodyMassLbs)} lb</span></p>
                <p className="text-sm text-[#475467]">
                  Protein basis:{" "}
                  <span className="font-semibold text-[#17141F]">
                    {planPreview.proteinBasis === "measured_body_fat" ? "Measured body fat" : "BMI estimate"}
                  </span>
                </p>
                <p className="text-sm text-[#475467]">Carbs: <span className="font-semibold text-[#17141F]">{toDisplayNumber(planPreview.carbsGrams)} g</span></p>
                <p className="text-sm text-[#475467]">Fat: <span className="font-semibold text-[#17141F]">{toDisplayNumber(planPreview.fatGrams)} g</span></p>
                <p className="text-sm text-[#475467]">Activity: <span className="font-semibold text-[#17141F]">x{toDisplayNumber(planPreview.activityMultiplier)}</span></p>
                {planPreview.bodyFatRecommendation ? (
                  <p className="sm:col-span-2 text-sm font-semibold text-[#B45309]">{planPreview.bodyFatRecommendation}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            {isReverseDiet ? (
              <label className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Reverse Diet — Weekly kcal Increase</span>
                <input
                  value={reverseDietWeeklyKcalOverride}
                  onChange={(event) => setReverseDietWeeklyKcalOverride(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 105"
                  className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
                />
                <span className="block text-xs text-[#98A2B3]">
                  Calories step up gradually each week (0–700 kcal/week). Leave blank to use the intensity default.
                </span>
              </label>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">
                    {rateLabel} — % bodyweight / week
                  </span>
                  <span className="text-sm font-semibold text-[#0B7C84]">
                    {weeklyRatePercent.toFixed(2)} %/wk
                    {rateWeightLbs > 0 ? (
                      <span className="ml-2 text-[#667085]">
                        ≈ {rateLbsPerWeek.toFixed(1)} lb/week
                      </span>
                    ) : null}
                  </span>
                </div>
                <input
                  type="range"
                  min={rateBounds.min}
                  max={rateBounds.max}
                  step={0.05}
                  value={weeklyRatePercent}
                  onChange={(event) =>
                    setWeeklyRatePercent(clampWeeklyRatePercent(goalType, Number(event.target.value)))
                  }
                  className="w-full accent-[#14D2DC]"
                />
                <div className="flex justify-between text-xs text-[#98A2B3]">
                  <span>{rateBounds.min}% (min)</span>
                  <span>{rateBounds.max}% (max — hard cap)</span>
                </div>
                <p className="rounded-xl border border-[rgba(20,210,220,0.22)] bg-[rgba(20,210,220,0.07)] px-3 py-2 text-xs font-semibold text-[#475467]">
                  Capped to a safe range for this goal. Faster is not better — sustainable rates protect
                  muscle and adherence.
                </p>
              </div>
            )}

            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#667085]">Intensity Preset</span>
              <select
                value={intensityPreset}
                onChange={(event) => {
                  const preset = event.target.value as IntensityPreset;
                  setIntensityPreset(preset);
                  if (!isReverseDiet) {
                    setWeeklyRatePercent(defaultRateFor(goalType, preset));
                  }
                }}
                className="w-full rounded-xl border border-[rgba(16,24,40,0.1)] bg-white/72 px-3 py-2.5 text-sm font-semibold text-[#17141F] focus:border-[rgba(20,210,220,0.34)] focus:outline-none"
              >
                {INTENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!isReverseDiet ? (
                <span className="block text-xs text-[#98A2B3]">Picks a starting rate; fine-tune with the slider above.</span>
              ) : null}
            </label>

            <button
              type="button"
              onClick={() => void runPlan("preview")}
              disabled={saving}
              className="rounded-full border border-[rgba(16,24,40,0.12)] bg-white/70 px-4 py-2 text-sm font-semibold text-[#17141F] disabled:opacity-60"
            >
              Recalculate with rate
            </button>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4 rounded-2xl border border-[rgba(16,24,40,0.08)] bg-white/66 p-4">
            <p className="text-sm font-semibold text-[#17141F]">Review</p>
            <p className="text-sm text-[#475467]">Goal: {goalType ? GOAL_LABELS[goalType] : "—"}</p>
            <p className="text-sm text-[#475467]">Current Weight: {currentWeightLbs} lbs</p>
            <p className="text-sm text-[#475467]">Target Weight: {targetWeightLbs || "—"} lbs</p>
            <p className="text-sm text-[#475467]">Intensity: {intensityPreset}</p>
            {!isReverseDiet ? (
              <p className="text-sm text-[#475467]">
                {rateLabel}: {weeklyRatePercent.toFixed(2)} %/wk
                {rateWeightLbs > 0 ? ` (≈ ${rateLbsPerWeek.toFixed(1)} lb/week)` : ""}
              </p>
            ) : null}
            {planPreview ? (
              <p className="text-sm text-[#475467]">
                Targets: {planPreview.targetCalories} kcal, {toDisplayNumber(planPreview.proteinGrams)}p,{" "}
                {toDisplayNumber(planPreview.carbsGrams)}c, {toDisplayNumber(planPreview.fatGrams)}f
              </p>
            ) : (
              <p className="text-sm font-semibold text-[#B45309]">Generate targets before applying.</p>
            )}

            <button
              type="button"
              onClick={() => void runPlan("apply")}
              disabled={saving || !planPreview}
              className="rounded-2xl bg-[#14D2DC] px-5 py-2.5 text-sm font-bold text-[#071317] shadow-[0_14px_30px_rgba(20,210,220,0.24)] transition hover:brightness-105 disabled:opacity-60"
            >
              {saving ? "Applying..." : "Apply Now"}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="rounded-full border border-[rgba(16,24,40,0.12)] bg-white/70 px-4 py-2 text-xs font-semibold text-[#17141F] disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={step === 5}
            className="rounded-full border border-[rgba(16,24,40,0.12)] bg-white/70 px-4 py-2 text-xs font-semibold text-[#17141F] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
