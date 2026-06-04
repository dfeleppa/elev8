import { NextResponse } from "next/server";

import { canAccessMemberNutrition, hasRole, requireRequestUserContext } from "@/lib/member";
import {
  buildMacroTargetsFromLeanMassLbs,
  estimateBodyFatPercentageFromBmi,
  type AthleteSex,
} from "@/lib/nutrition-calculations";
import { runNutritionQueryWithFallbacks } from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type NutritionDayRow = {
  id: string;
  day_date: string | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carbs_target?: number | null;
  fat_target?: number | null;
  fiber_target?: number | null;
};

type NutritionEntryRow = {
  day_id: string | null;
  quantity?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
};

const PLAN_SELECT =
  "id, goal_type, intensity_preset, weekly_rate_percent, reverse_diet_weekly_kcal, target_weight_lbs, maintenance_calories, target_calories, maintenance_calories_source, maintenance_calories_estimated_at, last_metabolism_estimate, protein_grams, carbs_grams, fat_grams, fiber_grams, formula_used, activity_multiplier, sessions_per_week, effective_date, last_check_in_date, next_check_in_date, adjustment_reason, previous_plan_id, adherence_snapshot, plan_payload";

type CoachPlanRow = {
  id: string;
  target_calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  effective_date: string | null;
  plan_payload: Record<string, unknown> | null;
};

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundNutritionTotal(value: number) {
  return Math.round(value * 10) / 10;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getPayloadSex(payload: Record<string, unknown>, memberSex: unknown): AthleteSex | null {
  if (payload.sex === "male" || payload.sex === "female") return payload.sex;
  if (memberSex === "male" || memberSex === "female") return memberSex;
  return null;
}

function getWeightLbs(payload: Record<string, unknown>) {
  const weightLbs = toNullableNumber(payload.weightLbs);
  if (weightLbs !== null && weightLbs > 0) return weightLbs;
  const weightKg = toNullableNumber(payload.weightKg);
  return weightKg !== null && weightKg > 0 ? weightKg * 2.20462 : null;
}

async function repairLegacyLeanMassMacros(
  memberId: string,
  memberSex: unknown,
  plan: CoachPlanRow
) {
  const payload = plan.plan_payload ?? {};
  const weightLbs = getWeightLbs(payload);
  const heightCm = toNullableNumber(payload.heightCm);
  const ageYears = toNullableNumber(payload.ageYears);
  const measuredBodyFat = toNullableNumber(payload.bodyFatPercentage);
  const hasMeasuredBodyFat = measuredBodyFat !== null && measuredBodyFat > 2 && measuredBodyFat < 70;
  const sex = getPayloadSex(payload, memberSex);

  let proteinBodyFatPercentage = hasMeasuredBodyFat ? measuredBodyFat : toNullableNumber(payload.proteinBodyFatPercentage);
  if ((proteinBodyFatPercentage === null || proteinBodyFatPercentage <= 2 || proteinBodyFatPercentage >= 70) && weightLbs && heightCm && ageYears && sex) {
    proteinBodyFatPercentage = estimateBodyFatPercentageFromBmi(weightLbs / 2.20462, heightCm, ageYears, sex);
  }

  if (!weightLbs || !proteinBodyFatPercentage || proteinBodyFatPercentage <= 2 || proteinBodyFatPercentage >= 70) {
    return plan;
  }

  const leanBodyMassLbs = round1(weightLbs * (1 - proteinBodyFatPercentage / 100));
  const macros = buildMacroTargetsFromLeanMassLbs(plan.target_calories, leanBodyMassLbs);
  const macroMismatch =
    Math.abs(plan.protein_grams - macros.proteinGrams) > 0.5 ||
    Math.abs(plan.carbs_grams - macros.carbsGrams) > 0.5 ||
    Math.abs(plan.fat_grams - macros.fatGrams) > 0.5;
  const payloadMissing =
    toNullableNumber(payload.proteinBodyFatPercentage) === null ||
    toNullableNumber(payload.leanBodyMassLbs) === null ||
    payload.proteinBasis !== (hasMeasuredBodyFat ? "measured_body_fat" : "bmi_estimated_body_fat") ||
    measuredBodyFat === 0;

  if (!macroMismatch && !payloadMissing) {
    return plan;
  }

  const nextPayload = {
    ...payload,
    weightLbs,
    sex,
    bodyFatPercentage: hasMeasuredBodyFat ? measuredBodyFat : null,
    proteinBodyFatPercentage: round1(proteinBodyFatPercentage),
    leanBodyMassLbs,
    proteinBasis: hasMeasuredBodyFat ? "measured_body_fat" : "bmi_estimated_body_fat",
  };

  const { data: updatedPlan, error } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .update({
      protein_grams: macros.proteinGrams,
      carbs_grams: macros.carbsGrams,
      fat_grams: macros.fatGrams,
      plan_payload: nextPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .eq("member_id", memberId)
    .select(PLAN_SELECT)
    .single();

  if (error || !updatedPlan) {
    return plan;
  }

  if (plan.effective_date) {
    await supabaseAdmin
      .from("nutrition_days")
      .update({
        protein_target: macros.proteinGrams,
        carbs_target: macros.carbsGrams,
        fat_target: macros.fatGrams,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", memberId)
      .eq("day_date", plan.effective_date);
  }

  return updatedPlan as CoachPlanRow;
}

async function getRecentNutritionDays(memberId: string) {
  const { data: days, error: daysError } = await runNutritionQueryWithFallbacks<NutritionDayRow[]>([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
        .eq("member_id", memberId)
        .order("day_date", { ascending: false })
        .limit(90),
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .eq("member_id", memberId)
        .order("day_date", { ascending: false })
        .limit(90),
  ]);

  if (daysError || !days?.length) {
    return [];
  }

  const dayIds = days.map((day) => day.id).filter(Boolean);
  if (dayIds.length === 0) {
    return [];
  }

  const { data: entries, error: entriesError } = await runNutritionQueryWithFallbacks<NutritionEntryRow[]>([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("day_id, quantity, calories, protein, carbs, fat, fiber")
        .eq("member_id", memberId)
        .in("day_id", dayIds),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("day_id, quantity, calories, protein, carbs, fat")
        .eq("member_id", memberId)
        .in("day_id", dayIds),
  ]);

  if (entriesError || !entries?.length) {
    return [];
  }

  const totalsByDay = new Map<
    string,
    {
      entryCount: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
    }
  >();

  for (const entry of entries) {
    if (!entry.day_id) continue;
    const quantity = toFiniteNumber(entry.quantity) || 1;
    const totals =
      totalsByDay.get(entry.day_id) ??
      {
        entryCount: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };

    totals.entryCount += 1;
    totals.calories += toFiniteNumber(entry.calories) * quantity;
    totals.protein += toFiniteNumber(entry.protein) * quantity;
    totals.carbs += toFiniteNumber(entry.carbs) * quantity;
    totals.fat += toFiniteNumber(entry.fat) * quantity;
    totals.fiber += toFiniteNumber(entry.fiber) * quantity;
    totalsByDay.set(entry.day_id, totals);
  }

  return days
    .map((day) => {
      const totals = totalsByDay.get(day.id);
      if (!totals) return null;

      return {
        date: day.day_date,
        entryCount: totals.entryCount,
        calories: Math.round(totals.calories),
        protein: roundNutritionTotal(totals.protein),
        carbs: roundNutritionTotal(totals.carbs),
        fat: roundNutritionTotal(totals.fat),
        fiber: roundNutritionTotal(totals.fiber),
        calorieTarget: day.calorie_target ?? null,
        proteinTarget: day.protein_target ?? null,
        carbsTarget: day.carbs_target ?? null,
        fatTarget: day.fat_target ?? null,
        fiberTarget: day.fiber_target ?? null,
      };
    })
    .filter((day): day is NonNullable<typeof day> => day !== null)
    .slice(0, 14);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ memberId: string }> }
) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("coach", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { memberId } = await context.params;
  if (!memberId) {
    return NextResponse.json({ error: "memberId required." }, { status: 400 });
  }
  if (!(await canAccessMemberNutrition(userId, role, memberId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [memberRes, plansRes, checkInsRes, weightsRes, recentNutritionDays] = await Promise.all([
    supabaseAdmin.from("app_users").select("id, full_name, email, sex").eq("id", memberId).maybeSingle(),
    supabaseAdmin
      .from("coach_nutrition_plans")
      .select(PLAN_SELECT)
      .eq("member_id", memberId)
      .order("effective_date", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("nutrition_check_ins")
      .select("id, plan_id, status, recommendation, created_at, reviewed_at, applied_plan_id")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("health_stat_entries")
      .select("entry_date, value, unit")
      .eq("member_id", memberId)
      .eq("stat_key", "body_weight")
      .order("entry_date", { ascending: false })
      .limit(60),
    getRecentNutritionDays(memberId),
  ]);

  if (memberRes.error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
  if (!memberRes.data) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const plans = [...((plansRes.data ?? []) as CoachPlanRow[])];
  if (plans[0]) {
    plans[0] = await repairLegacyLeanMassMacros(memberId, memberRes.data.sex, plans[0]);
  }

  return NextResponse.json({
    member: memberRes.data,
    plans,
    checkIns: checkInsRes.data ?? [],
    weights: weightsRes.data ?? [],
    recentNutritionDays,
  });
}
