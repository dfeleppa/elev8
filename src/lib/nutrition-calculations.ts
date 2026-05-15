export type GoalType = "lose_weight" | "gain_weight" | "maintain_weight" | "performance_reverse_diet";

export type IntensityPreset = "conservative" | "moderate" | "aggressive";

export type AthleteSex = "male" | "female";

export type CalculationInputs = {
  goalType: GoalType;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: AthleteSex;
  bodyFatPercentage?: number | null;
  sessionsPerWeek: number;
  intensityPreset: IntensityPreset;
  weeklyRatePercentOverride?: number | null;
  reverseDietWeeklyKcalOverride?: number | null;
};

export type CalculationResult = {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round0(value: number) {
  return Math.round(value);
}

function safePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function deriveActivityMultiplier(sessionsPerWeek: number) {
  const sessions = safePositive(sessionsPerWeek, 1);
  if (sessions <= 1) {
    return 1.2;
  }
  if (sessions <= 3) {
    return 1.375;
  }
  if (sessions <= 5) {
    return 1.55;
  }
  if (sessions <= 7) {
    return 1.725;
  }
  return 1.9;
}

function getWeeklyRatePercent(goalType: GoalType, preset: IntensityPreset, override?: number | null) {
  if (goalType === "maintain_weight" || goalType === "performance_reverse_diet") {
    return 0;
  }

  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return clamp(override, 0.1, 2);
  }

  if (preset === "conservative") {
    return 0.25;
  }
  if (preset === "aggressive") {
    return 0.75;
  }
  return 0.5;
}

function getReverseDietWeeklyKcal(preset: IntensityPreset, override?: number | null) {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
    return clamp(override, 0, 700);
  }

  if (preset === "conservative") {
    return 70;
  }
  if (preset === "aggressive") {
    return 175;
  }
  return 105;
}

function katchMcArdleBmr(weightKg: number, bodyFatPercentage: number) {
  const leanMassKg = weightKg * (1 - bodyFatPercentage / 100);
  return 370 + 21.6 * leanMassKg;
}

function mifflinStJeorBmr(weightKg: number, heightCm: number, ageYears: number, sex: AthleteSex) {
  const sexAdjustment = sex === "male" ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexAdjustment;
}

const LBS_PER_KG = 2.20462;
export const PROTEIN_GRAMS_PER_LB_LEAN_BODY_MASS = 1.0;
const IDEAL_FAT_CALORIE_FRACTION = 0.3;

export function estimateBodyFatPercentageFromBmi(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: AthleteSex
) {
  const heightM = safePositive(heightCm, 100) / 100;
  const bmi = safePositive(weightKg, 1) / (heightM * heightM);
  const sexValue = sex === "male" ? 1 : 0;
  return clamp(1.2 * bmi + 0.23 * ageYears - 10.8 * sexValue - 5.4, 5, 60);
}

function leanBodyMassLbs(weightKg: number, bodyFatPercentage: number) {
  return weightKg * LBS_PER_KG * (1 - bodyFatPercentage / 100);
}

export function buildMacroTargetsFromLeanMassLbs(targetCalories: number, leanMassLbs: number) {
  const safeCalories = safePositive(targetCalories, 1200);
  const safeLeanMassLbs = safePositive(leanMassLbs, 1);
  const proteinGrams = safeLeanMassLbs * PROTEIN_GRAMS_PER_LB_LEAN_BODY_MASS;

  const idealFatGrams = (safeCalories * IDEAL_FAT_CALORIE_FRACTION) / 9;
  const caloriesAfterProtein = safeCalories - proteinGrams * 4;
  const fatGrams = Math.max(0, Math.min(idealFatGrams, caloriesAfterProtein / 9));
  const carbsGrams = Math.max(0, (safeCalories - proteinGrams * 4 - fatGrams * 9) / 4);

  return {
    proteinGrams: round1(proteinGrams),
    carbsGrams: round1(carbsGrams),
    fatGrams: round1(fatGrams),
  };
}

export function buildMacroTargetsFromWeightLbs(targetCalories: number, weightLbs: number) {
  return buildMacroTargetsFromLeanMassLbs(targetCalories, weightLbs);
}

function buildMacroTargets(targetCalories: number, leanMassLbs: number) {
  return buildMacroTargetsFromLeanMassLbs(targetCalories, leanMassLbs);
}

export function calculateNutritionPlan(inputs: CalculationInputs): CalculationResult {
  const weightKg = safePositive(inputs.weightKg, 1);
  const heightCm = safePositive(inputs.heightCm, 100);
  const ageYears = clamp(safePositive(inputs.ageYears, 18), 13, 100);
  const activityMultiplier = deriveActivityMultiplier(inputs.sessionsPerWeek);

  const hasValidBodyFat =
    typeof inputs.bodyFatPercentage === "number" &&
    Number.isFinite(inputs.bodyFatPercentage) &&
    inputs.bodyFatPercentage > 2 &&
    inputs.bodyFatPercentage < 70;
  const proteinBodyFatPercentage = hasValidBodyFat
    ? (inputs.bodyFatPercentage as number)
    : estimateBodyFatPercentageFromBmi(weightKg, heightCm, ageYears, inputs.sex);
  const leanMassLbs = leanBodyMassLbs(weightKg, proteinBodyFatPercentage);

  const bmr = hasValidBodyFat
    ? katchMcArdleBmr(weightKg, inputs.bodyFatPercentage as number)
    : mifflinStJeorBmr(weightKg, heightCm, ageYears, inputs.sex);

  const maintenanceCalories = bmr * activityMultiplier;
  const weeklyRatePercent = getWeeklyRatePercent(
    inputs.goalType,
    inputs.intensityPreset,
    inputs.weeklyRatePercentOverride
  );
  const reverseDietWeeklyKcal = getReverseDietWeeklyKcal(
    inputs.intensityPreset,
    inputs.reverseDietWeeklyKcalOverride
  );

  const kcalPerKg = 7700;
  const dailyWeightChangeKcal = (weeklyRatePercent / 100) * weightKg * (kcalPerKg / 7);

  const goalAdjustment =
    inputs.goalType === "lose_weight"
      ? -dailyWeightChangeKcal
      : inputs.goalType === "gain_weight"
        ? dailyWeightChangeKcal
        : inputs.goalType === "performance_reverse_diet"
          ? reverseDietWeeklyKcal / 7
          : 0;

  const targetCalories = Math.max(1200, maintenanceCalories + goalAdjustment);
  const macros = buildMacroTargets(targetCalories, leanMassLbs);

  return {
    formulaUsed: hasValidBodyFat ? "katch_mcardle" : "mifflin_st_jeor",
    bmr: round0(bmr),
    activityMultiplier: round1(activityMultiplier),
    maintenanceCalories: round0(maintenanceCalories),
    targetCalories: round0(targetCalories),
    proteinGrams: macros.proteinGrams,
    carbsGrams: macros.carbsGrams,
    fatGrams: macros.fatGrams,
    leanBodyMassLbs: round1(leanMassLbs),
    proteinBodyFatPercentage: round1(proteinBodyFatPercentage),
    proteinBasis: hasValidBodyFat ? "measured_body_fat" : "bmi_estimated_body_fat",
    bodyFatRecommendation: hasValidBodyFat
      ? null
      : "Body fat was estimated from BMI for protein. Recommend testing body fat for a more accurate lean body mass target.",
    weeklyRatePercent: round1(weeklyRatePercent),
    reverseDietWeeklyKcal: round0(reverseDietWeeklyKcal),
  };
}
