import { NextResponse } from "next/server";

import {
  calculateNutritionPlan,
  WEEKLY_RATE_PERCENT_BOUNDS,
  type AthleteSex,
  type GoalType,
  type IntensityPreset,
} from "@/lib/nutrition-calculations";
import { NEXT_CHECK_IN_DAYS } from "@/lib/nutrition-check-in";
import { getCoachNutritionPlan, hasCoachNutritionPlan } from "@/lib/coach-plan";
import { hasRole, requireRequestUserContext } from "@/lib/member";
import {
  applyMetabolismLearningToPlan,
  loadMetabolismLearning,
  preserveMetabolismLearning,
} from "@/lib/metabolism-learning";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const goalTypeSet = new Set<GoalType>([
  "lose_weight",
  "gain_weight",
  "maintain_weight",
  "performance_reverse_diet",
]);
const intensitySet = new Set<IntensityPreset>(["conservative", "moderate", "aggressive"]);
const sexSet = new Set<AthleteSex>(["male", "female"]);

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMeasuredBodyFatPercentage(value: unknown) {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 2 && parsed < 70 ? parsed : null;
}

function toIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function datePlusDays(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return isoDate;
  }
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function calculateAgeFromBirthDate(birthDate: string) {
  const dob = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  if (age < 13 || age > 100) {
    return null;
  }
  return age;
}

function normalizeSessionsPerWeek(value: number | null) {
  if (value === null) {
    return 3;
  }
  return Math.max(0, Math.min(14, Math.round(value * 10) / 10));
}

async function getSessionsPerWeek(memberId: string, effectiveDate: string) {
  const startDate = datePlusDays(effectiveDate, -27);
  const { count, error } = await supabaseAdmin
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", effectiveDate);

  if (error) {
    return 3;
  }

  const totalSessions = count ?? 0;
  return normalizeSessionsPerWeek(totalSessions / 4);
}

function canManageMember(role: string, currentUserId: string, memberId: string) {
  if (memberId === currentUserId) {
    return true;
  }
  return role === "admin" || role === "owner";
}

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedMemberId = searchParams.get("memberId")?.trim() || userId;

  if (!canManageMember(role, userId, requestedMemberId)) {
    return NextResponse.json(
      { error: "Cross-member coach setup is restricted to admin/owner for now." },
      { status: 403 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, sex, birth_date, height_cm, current_weight_kg, body_fat_percent")
    .eq("id", requestedMemberId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  let latestPlan: {
    id: string;
    goal_type: GoalType | null;
    intensity_preset: IntensityPreset | null;
    weekly_rate_percent: number | null;
    reverse_diet_weekly_kcal: number | null;
    target_weight_lbs: number | null;
    maintenance_calories: number | null;
    target_calories: number | null;
    protein_grams: number | null;
    carbs_grams: number | null;
    fat_grams: number | null;
    formula_used: "katch_mcardle" | "mifflin_st_jeor" | null;
    sessions_per_week: number | null;
    effective_date: string | null;
    last_check_in_date: string | null;
    next_check_in_date: string | null;
    plan_payload: Record<string, unknown> | null;
  } | null = null;

  try {
    latestPlan = await getCoachNutritionPlan(
      requestedMemberId,
      "id, goal_type, intensity_preset, weekly_rate_percent, reverse_diet_weekly_kcal, target_weight_lbs, maintenance_calories, target_calories, protein_grams, carbs_grams, fat_grams, formula_used, sessions_per_week, effective_date, last_check_in_date, next_check_in_date, plan_payload"
    );
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  let hasPlan = false;
  try {
    hasPlan = await hasCoachNutritionPlan(requestedMemberId);
  } catch {
    hasPlan = Boolean(latestPlan);
  }

  return NextResponse.json({
    memberId: requestedMemberId,
    profile: profile ?? null,
    hasPlan,
    latestPlan,
  });
}

export async function POST(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action === "apply" ? "apply" : "preview";
  const memberId = typeof body?.memberId === "string" && body.memberId.trim() ? body.memberId.trim() : userId;

  if (!canManageMember(role, userId, memberId)) {
    return NextResponse.json(
      { error: "Cross-member coach setup is restricted to admin/owner for now." },
      { status: 403 }
    );
  }

  const goalType = typeof body?.goalType === "string" ? (body.goalType as GoalType) : null;
  const intensityPreset = typeof body?.intensityPreset === "string" ? (body.intensityPreset as IntensityPreset) : null;
  const sex = typeof body?.sex === "string" ? (body.sex as AthleteSex) : null;
  const birthDate = toIsoDate(body?.birthDate);
  const effectiveDate = toIsoDate(body?.effectiveDate) ?? todayIsoDate();

  if (!goalType || !goalTypeSet.has(goalType)) {
    return NextResponse.json({ error: "Invalid goal type." }, { status: 400 });
  }
  if (!intensityPreset || !intensitySet.has(intensityPreset)) {
    return NextResponse.json({ error: "Invalid intensity preset." }, { status: 400 });
  }
  if (!sex || !sexSet.has(sex)) {
    return NextResponse.json({ error: "Sex is required for calculation fallback." }, { status: 400 });
  }

  const currentWeightLbs = toNumber(body?.currentWeightLbs);
  let weightKg: number | null = currentWeightLbs !== null ? currentWeightLbs / 2.20462 : null;
  const heightCm = toNumber(body?.heightCm);
  const bodyFatPercentage = toMeasuredBodyFatPercentage(body?.bodyFatPercentage);
  const weeklyRatePercentOverride = toNumber(body?.weeklyRatePercentOverride);
  const reverseDietWeeklyKcalOverride = toNumber(body?.reverseDietWeeklyKcalOverride);
  const targetWeightLbs = toNumber(body?.targetWeightLbs);
  const sessionsPerWeekInput = toNumber(body?.sessionsPerWeek);

  if (currentWeightLbs === null || currentWeightLbs <= 0 || heightCm === null || heightCm <= 0) {
    return NextResponse.json({ error: "Current weight and height are required." }, { status: 400 });
  }
  weightKg = currentWeightLbs / 2.20462;

  const derivedAge = birthDate ? calculateAgeFromBirthDate(birthDate) : null;
  const ageYears = derivedAge ?? toNumber(body?.ageYears);
  if (!ageYears || ageYears < 13 || ageYears > 100) {
    return NextResponse.json({ error: "Valid age is required (13-100)." }, { status: 400 });
  }

  // Severely guardrail the chosen rate: reject anything outside the goal-aware
  // safe bounds rather than silently clamping a wild value.
  if (weeklyRatePercentOverride !== null && goalType !== "performance_reverse_diet") {
    const bounds = WEEKLY_RATE_PERCENT_BOUNDS[goalType];
    if (weeklyRatePercentOverride < bounds.min || weeklyRatePercentOverride > bounds.max) {
      return NextResponse.json(
        {
          error: `Weekly rate must be between ${bounds.min}% and ${bounds.max}% of bodyweight for this goal.`,
        },
        { status: 400 }
      );
    }
  }

  const sessionsPerWeek =
    sessionsPerWeekInput === null ? await getSessionsPerWeek(memberId, effectiveDate) : normalizeSessionsPerWeek(sessionsPerWeekInput);

  const calculatedPlan = calculateNutritionPlan({
    goalType,
    weightKg,
    heightCm,
    ageYears,
    sex,
    bodyFatPercentage,
    sessionsPerWeek,
    intensityPreset,
    weeklyRatePercentOverride,
    reverseDietWeeklyKcalOverride,
  });
  const metabolismLearning = await loadMetabolismLearning(memberId);
  const plan = applyMetabolismLearningToPlan(calculatedPlan, metabolismLearning);

  if (action === "preview") {
    return NextResponse.json({
      action,
      memberId,
      inputs: {
        goalType,
        intensityPreset,
        sex,
        birthDate,
        ageYears,
        currentWeightLbs,
        heightCm,
        bodyFatPercentage,
        sessionsPerWeek,
        targetWeightLbs,
      },
      plan,
    });
  }

  const nextCheckInDate = datePlusDays(effectiveDate, NEXT_CHECK_IN_DAYS);
  const metabolismSource = metabolismLearning?.maintenanceCaloriesSource ?? "formula";

  const { error: profileError } = await supabaseAdmin
    .from("app_users")
    .update({
      sex,
      birth_date: birthDate,
      height_cm: heightCm,
      current_weight_kg: weightKg,
      body_fat_percent: bodyFatPercentage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (profileError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const { error: planError } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .upsert(
      {
        coach_id: userId,
        member_id: memberId,
        goal_type: goalType,
        intensity_preset: intensityPreset,
        weekly_rate_percent: plan.weeklyRatePercent,
        reverse_diet_weekly_kcal: plan.reverseDietWeeklyKcal,
        target_weight_lbs: targetWeightLbs,
        maintenance_calories: plan.maintenanceCalories,
        maintenance_calories_source: metabolismSource,
        maintenance_calories_estimated_at: metabolismLearning?.maintenanceCaloriesEstimatedAt ?? null,
        last_metabolism_estimate: metabolismLearning?.lastMetabolismEstimate ?? null,
        target_calories: plan.targetCalories,
        protein_grams: plan.proteinGrams,
        carbs_grams: plan.carbsGrams,
        fat_grams: plan.fatGrams,
        fiber_grams: Math.max(25, Math.round(plan.targetCalories / 72)),
        formula_used: plan.formulaUsed,
        activity_multiplier: plan.activityMultiplier,
        sessions_per_week: sessionsPerWeek,
        effective_date: effectiveDate,
        last_check_in_date: effectiveDate,
        next_check_in_date: nextCheckInDate,
        plan_payload: {
          weeklyRatePercentOverride,
          reverseDietWeeklyKcalOverride,
          ageYears,
          sex,
          bodyFatPercentage,
          proteinBodyFatPercentage: plan.proteinBodyFatPercentage,
          proteinBasis: plan.proteinBasis,
          leanBodyMassLbs: plan.leanBodyMassLbs,
          heightCm,
          weightLbs: currentWeightLbs,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,effective_date" }
    );

  if (planError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  if (metabolismLearning) {
    await preserveMetabolismLearning(memberId);
  }

  const { error: targetError } = await supabaseAdmin
    .from("nutrition_days")
    .upsert(
      {
        member_id: memberId,
        day_date: effectiveDate,
        calorie_target: plan.targetCalories,
        protein_target: plan.proteinGrams,
        carbs_target: plan.carbsGrams,
        fat_target: plan.fatGrams,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    );

  if (targetError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({
    action,
    memberId,
    effectiveDate,
    nextCheckInDate,
    plan,
    applied: true,
  });
}
