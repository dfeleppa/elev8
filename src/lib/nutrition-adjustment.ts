import type { GoalType } from "@/lib/nutrition-calculations";

/**
 * Pure analyzer that proposes a nutrition plan adjustment based on adherence
 * (logging consistency) and weight trend, with hard guardrails.
 *
 * Adherence is the primary signal: if the member is not tracking consistently,
 * we never cut calories — the most likely cause of stalled progress is
 * mistracking, not a wrong target.
 */

export type AdjustmentStatus =
  | "insufficient_weight_data"
  | "low_adherence"
  | "likely_undertracking"
  | "on_track"
  | "adjust"
  | "guardrail_blocked";

export type DailyLog = {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Total calories logged that day, or 0 if no entries. */
  calories: number;
  proteinGrams: number;
  fiberGrams: number | null;
};

export type WeightEntry = {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Weight in lbs. */
  weightLbs: number;
};

export type CurrentPlan = {
  goalType: GoalType;
  /** Daily prescribed calories. */
  targetCalories: number;
  /** Estimated TDEE used when the plan was built. */
  maintenanceCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  /** Optional existing fiber target. */
  fiberGrams?: number | null;
  /** % bodyweight change per week (0 for maintain / reverse diet). */
  weeklyRatePercent: number;
  /** Daily kcal increment used for performance reverse diets. */
  reverseDietWeeklyKcal: number;
  /** Most recent body weight at plan creation, in lbs. */
  currentWeightLbs: number;
  /** Optional target body weight, in lbs. */
  targetWeightLbs?: number | null;
};

export type AdjustmentInputs = {
  plan: CurrentPlan;
  /** Daily log totals for the trailing window (ideally 14 days). */
  dailyLogs: DailyLog[];
  /** Weight entries for the trailing window (ideally 21 days). */
  weights: WeightEntry[];
  /** Window length in days for adherence (default 14). */
  adherenceWindowDays?: number;
  /** Window length in days for weight trend (default 21). */
  weightWindowDays?: number;
};

export type AdherenceSummary = {
  windowDays: number;
  daysLogged: number;
  daysExpected: number;
  adherencePercent: number;
  avgLoggedCalories: number;
  avgLoggedProtein: number;
  avgLoggedFiber: number | null;
  /** avgLoggedCalories / target */
  loggedVsTargetRatio: number;
};

export type WeightTrendSummary = {
  windowDays: number;
  entries: number;
  startWeightLbs: number | null;
  currentWeightLbs: number | null;
  observedWeeklyChangeLbs: number | null;
  expectedWeeklyChangeLbs: number;
};

export type ProposedMacros = {
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

export type Guardrails = {
  calorieFloor: number;
  calorieCeiling: number;
  perCheckInDeltaCap: number;
  proteinFloorGrams: number;
  fatFloorGrams: number;
  fiberFloorGrams: number;
};

export type AdjustmentRecommendation = {
  status: AdjustmentStatus;
  reason: string;
  warnings: string[];
  adherence: AdherenceSummary;
  weightTrend: WeightTrendSummary;
  guardrails: Guardrails;
  /** Proposed new macros if status is "adjust" or "on_track" (when fiber/protein floor is enforced). */
  proposed: ProposedMacros | null;
  /** Net calorie delta from current plan to proposed (signed). */
  calorieDelta: number;
};

const ABSOLUTE_CALORIE_FLOOR = 1300; // unisex; coach-overridable in future
const ABSOLUTE_CALORIE_CEILING = 4000;
const MAINT_FLOOR_FRACTION = 0.75;
const MAINT_CEILING_FRACTION = 1.3;
const MAX_DELTA_PER_CHECK_IN = 200;
const STEP_SMALL = 100;
const STEP_LARGE = 200;
/** Adherence below this and we will not adjust calories down. */
const ADHERENCE_GATE = 0.7;
/** Logged-vs-target ratio below this when weight is not moving → undertracking flag. */
const UNDERTRACK_RATIO = 0.85;
/** Tolerance band around expected weekly change before we adjust. */
const TOLERANCE_FRAC = 0.4;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round0(value: number) {
  return Math.round(value);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function trimmedMean(values: number[], n: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(0, Math.min(n, values.length));
  return average(slice);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function summarizeAdherence(plan: CurrentPlan, logs: DailyLog[], windowDays: number): AdherenceSummary {
  const recent = logs.slice(-windowDays);
  const loggedDays = recent.filter((d) => d.calories > 0);
  const daysLogged = loggedDays.length;
  const adherencePercent = windowDays > 0 ? daysLogged / windowDays : 0;

  const avgLoggedCalories = daysLogged > 0 ? average(loggedDays.map((d) => d.calories)) : 0;
  const avgLoggedProtein = daysLogged > 0 ? average(loggedDays.map((d) => d.proteinGrams)) : 0;
  const fiberValues = loggedDays
    .map((d) => d.fiberGrams)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const avgLoggedFiber = fiberValues.length > 0 ? average(fiberValues) : null;

  const loggedVsTargetRatio =
    plan.targetCalories > 0 && avgLoggedCalories > 0 ? avgLoggedCalories / plan.targetCalories : 0;

  return {
    windowDays,
    daysLogged,
    daysExpected: windowDays,
    adherencePercent: round1(adherencePercent * 100) / 100,
    avgLoggedCalories: round0(avgLoggedCalories),
    avgLoggedProtein: round1(avgLoggedProtein),
    avgLoggedFiber: avgLoggedFiber === null ? null : round1(avgLoggedFiber),
    loggedVsTargetRatio: round1(loggedVsTargetRatio * 100) / 100,
  };
}

function summarizeWeightTrend(plan: CurrentPlan, weights: WeightEntry[], windowDays: number): WeightTrendSummary {
  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const recent =
    sorted.length === 0
      ? []
      : sorted.filter((w) => {
          const last = sorted[sorted.length - 1].date;
          return daysBetween(w.date, last) <= windowDays;
        });

  const expectedWeeklyChangeLbs =
    plan.goalType === "lose_weight"
      ? -(plan.weeklyRatePercent / 100) * plan.currentWeightLbs
      : plan.goalType === "gain_weight"
        ? (plan.weeklyRatePercent / 100) * plan.currentWeightLbs
        : 0;

  if (recent.length < 4) {
    return {
      windowDays,
      entries: recent.length,
      startWeightLbs: recent.length > 0 ? round1(recent[0].weightLbs) : null,
      currentWeightLbs: recent.length > 0 ? round1(recent[recent.length - 1].weightLbs) : null,
      observedWeeklyChangeLbs: null,
      expectedWeeklyChangeLbs: round1(expectedWeeklyChangeLbs),
    };
  }

  const firstAvg = trimmedMean(
    recent.map((w) => w.weightLbs),
    3
  );
  const lastAvg = trimmedMean(
    [...recent].reverse().map((w) => w.weightLbs),
    3
  );
  const span = Math.max(1, daysBetween(recent[0].date, recent[recent.length - 1].date));
  const observedWeeklyChangeLbs = ((lastAvg - firstAvg) / span) * 7;

  return {
    windowDays,
    entries: recent.length,
    startWeightLbs: round1(firstAvg),
    currentWeightLbs: round1(lastAvg),
    observedWeeklyChangeLbs: round1(observedWeeklyChangeLbs),
    expectedWeeklyChangeLbs: round1(expectedWeeklyChangeLbs),
  };
}

function computeGuardrails(plan: CurrentPlan): Guardrails {
  const referenceWeight = plan.targetWeightLbs ?? plan.currentWeightLbs;
  return {
    calorieFloor: Math.max(ABSOLUTE_CALORIE_FLOOR, Math.round(plan.maintenanceCalories * MAINT_FLOOR_FRACTION)),
    calorieCeiling: Math.min(ABSOLUTE_CALORIE_CEILING, Math.round(plan.maintenanceCalories * MAINT_CEILING_FRACTION)),
    perCheckInDeltaCap: MAX_DELTA_PER_CHECK_IN,
    proteinFloorGrams: round1(0.8 * referenceWeight),
    fatFloorGrams: round1(0.3 * referenceWeight),
    fiberFloorGrams: Math.max(25, Math.round((14 * plan.targetCalories) / 1000)),
  };
}

function recomposeMacros(
  plan: CurrentPlan,
  newCalories: number,
  guardrails: Guardrails
): ProposedMacros {
  // Hold protein at max(plan protein, floor); hold fat at max(plan fat scaled, floor); fill carbs.
  let protein = Math.max(plan.proteinGrams, guardrails.proteinFloorGrams);
  let fat = Math.max(guardrails.fatFloorGrams, plan.fatGrams);

  // If protein + fat already exceed budget, push fat down toward its floor.
  let remaining = newCalories - protein * 4 - fat * 9;
  if (remaining < 0) {
    fat = Math.max(guardrails.fatFloorGrams, fat + remaining / 9);
    remaining = newCalories - protein * 4 - fat * 9;
  }
  // Last resort: shave protein toward its floor.
  if (remaining < 0) {
    protein = Math.max(guardrails.proteinFloorGrams, protein + remaining / 4);
    remaining = newCalories - protein * 4 - fat * 9;
  }
  const carbs = Math.max(0, remaining / 4);

  const fiber = Math.max(plan.fiberGrams ?? 0, guardrails.fiberFloorGrams);

  return {
    targetCalories: round0(newCalories),
    proteinGrams: round1(protein),
    carbsGrams: round1(carbs),
    fatGrams: round1(fat),
    fiberGrams: round0(fiber),
  };
}

export function analyzeNutritionAdjustment(inputs: AdjustmentInputs): AdjustmentRecommendation {
  const plan = inputs.plan;
  const adherenceWindow = inputs.adherenceWindowDays ?? 14;
  const weightWindow = inputs.weightWindowDays ?? 21;

  const adherence = summarizeAdherence(plan, inputs.dailyLogs, adherenceWindow);
  const weightTrend = summarizeWeightTrend(plan, inputs.weights, weightWindow);
  const guardrails = computeGuardrails(plan);
  const warnings: string[] = [];

  // Always fold in protein/fiber floor enforcement, even when calories don't change.
  const baselineProposal = recomposeMacros(plan, plan.targetCalories, guardrails);
  const proteinFloorBumped = baselineProposal.proteinGrams > plan.proteinGrams + 0.5;
  const fiberFloorBumped = (plan.fiberGrams ?? 0) < guardrails.fiberFloorGrams;
  if (proteinFloorBumped) {
    warnings.push(
      `Protein bumped to floor (${guardrails.proteinFloorGrams}g ≈ 0.8 g/lb of reference weight).`
    );
  }
  if (fiberFloorBumped) {
    warnings.push(`Fiber target set to ${guardrails.fiberFloorGrams}g (floor: 14 g/1000 kcal, min 25 g).`);
  }

  // Gate 1: adherence
  if (adherence.adherencePercent < ADHERENCE_GATE) {
    return {
      status: "low_adherence",
      reason: `Only ${adherence.daysLogged}/${adherence.daysExpected} days logged in the last ${adherenceWindow} days. Focus on consistent tracking before changing the plan.`,
      warnings,
      adherence,
      weightTrend,
      guardrails,
      proposed: proteinFloorBumped || fiberFloorBumped ? baselineProposal : null,
      calorieDelta: 0,
    };
  }

  // Gate 2: insufficient weight data
  if (weightTrend.observedWeeklyChangeLbs === null) {
    return {
      status: "insufficient_weight_data",
      reason: `Need at least 4 weight entries spanning ~${weightWindow} days; have ${weightTrend.entries}.`,
      warnings,
      adherence,
      weightTrend,
      guardrails,
      proposed: proteinFloorBumped || fiberFloorBumped ? baselineProposal : null,
      calorieDelta: 0,
    };
  }

  // Gate 3: undertracking sniff test — logged calories far below target while weight is not moving in the goal direction.
  const goalDirection: 1 | -1 | 0 =
    plan.goalType === "lose_weight" ? -1 : plan.goalType === "gain_weight" ? 1 : 0;
  const movingTowardGoal =
    goalDirection === 0
      ? Math.abs(weightTrend.observedWeeklyChangeLbs) < 0.5
      : Math.sign(weightTrend.observedWeeklyChangeLbs) === goalDirection;

  if (
    goalDirection !== 0 &&
    !movingTowardGoal &&
    adherence.loggedVsTargetRatio > 0 &&
    adherence.loggedVsTargetRatio < UNDERTRACK_RATIO
  ) {
    return {
      status: "likely_undertracking",
      reason: `Logged ~${Math.round(adherence.loggedVsTargetRatio * 100)}% of target calories but weight is not moving toward goal. Likely undertracking — verify portion sizes and weekend logging before changing calories.`,
      warnings,
      adherence,
      weightTrend,
      guardrails,
      proposed: proteinFloorBumped || fiberFloorBumped ? baselineProposal : null,
      calorieDelta: 0,
    };
  }

  // Maintain / reverse diet handled separately.
  if (plan.goalType === "maintain_weight") {
    if (Math.abs(weightTrend.observedWeeklyChangeLbs) < 0.5) {
      return {
        status: "on_track",
        reason: "Weight stable within ±0.5 lb/week. Holding calories.",
        warnings,
        adherence,
        weightTrend,
        guardrails,
        proposed: proteinFloorBumped || fiberFloorBumped ? baselineProposal : null,
        calorieDelta: 0,
      };
    }
    // drifting — small nudge opposite to drift
    const delta = weightTrend.observedWeeklyChangeLbs > 0 ? -STEP_SMALL : STEP_SMALL;
    return buildAdjustment(plan, guardrails, delta, warnings, adherence, weightTrend);
  }

  if (plan.goalType === "performance_reverse_diet") {
    // Reverse diets follow the prescribed weekly kcal increment, not weight trend.
    const dailyIncrement = Math.round(plan.reverseDietWeeklyKcal / 7);
    return buildAdjustment(plan, guardrails, dailyIncrement, warnings, adherence, weightTrend, "Reverse diet weekly increment applied.");
  }

  // Lose / gain: compare observed vs expected weekly change.
  const expected = weightTrend.expectedWeeklyChangeLbs;
  const observed = weightTrend.observedWeeklyChangeLbs;
  const lowerBand = expected - Math.abs(expected) * TOLERANCE_FRAC;
  const upperBand = expected + Math.abs(expected) * TOLERANCE_FRAC;
  const inBand = observed >= Math.min(lowerBand, upperBand) && observed <= Math.max(lowerBand, upperBand);

  if (inBand) {
    return {
      status: "on_track",
      reason: `Observed ${observed} lb/week is within ±${Math.round(TOLERANCE_FRAC * 100)}% of expected ${expected} lb/week.`,
      warnings,
      adherence,
      weightTrend,
      guardrails,
      proposed: proteinFloorBumped || fiberFloorBumped ? baselineProposal : null,
      calorieDelta: 0,
    };
  }

  // Lose: observed > expected (less loss than wanted) → cut calories.
  // Lose: observed < expected (faster loss than wanted) → raise calories.
  // Gain: mirror.
  const undershoot = goalDirection === -1 ? observed > expected : observed < expected;
  const farOff = Math.abs(observed - expected) > Math.abs(expected);
  const step = farOff ? STEP_LARGE : STEP_SMALL;
  const signedDelta = undershoot
    ? goalDirection === -1
      ? -step
      : step
    : goalDirection === -1
      ? step
      : -step;

  return buildAdjustment(plan, guardrails, signedDelta, warnings, adherence, weightTrend);
}

function buildAdjustment(
  plan: CurrentPlan,
  guardrails: Guardrails,
  rawDelta: number,
  warnings: string[],
  adherence: AdherenceSummary,
  weightTrend: WeightTrendSummary,
  reasonOverride?: string
): AdjustmentRecommendation {
  const cappedDelta = clamp(rawDelta, -guardrails.perCheckInDeltaCap, guardrails.perCheckInDeltaCap);
  const desiredCalories = plan.targetCalories + cappedDelta;
  const boundedCalories = clamp(desiredCalories, guardrails.calorieFloor, guardrails.calorieCeiling);
  const finalDelta = boundedCalories - plan.targetCalories;

  const hitFloor = boundedCalories === guardrails.calorieFloor && desiredCalories < guardrails.calorieFloor;
  const hitCeiling = boundedCalories === guardrails.calorieCeiling && desiredCalories > guardrails.calorieCeiling;

  if (hitFloor || hitCeiling) {
    warnings.push(
      hitFloor
        ? `Calorie floor of ${guardrails.calorieFloor} kcal reached. Further cuts blocked — recommend coach review (possible tracking issue or medical factor).`
        : `Calorie ceiling of ${guardrails.calorieCeiling} kcal reached. Further increases blocked — recommend coach review (possible tracking issue or medical factor).`
    );
    if (Math.abs(finalDelta) < 25) {
      const proposed = recomposeMacros(plan, boundedCalories, guardrails);
      return {
        status: "guardrail_blocked",
        reason: hitFloor
          ? "Calorie floor reached; cannot cut further."
          : "Calorie ceiling reached; cannot raise further.",
        warnings,
        adherence,
        weightTrend,
        guardrails,
        proposed,
        calorieDelta: finalDelta,
      };
    }
  }

  const proposed = recomposeMacros(plan, boundedCalories, guardrails);
  const direction = finalDelta < 0 ? "decrease" : finalDelta > 0 ? "increase" : "hold";
  const reason =
    reasonOverride ??
    (direction === "hold"
      ? "No change after guardrails."
      : `Proposed ${direction} of ${Math.abs(finalDelta)} kcal/day based on weight trend vs expected rate.`);

  return {
    status: finalDelta === 0 ? "on_track" : "adjust",
    reason,
    warnings,
    adherence,
    weightTrend,
    guardrails,
    proposed,
    calorieDelta: finalDelta,
  };
}
