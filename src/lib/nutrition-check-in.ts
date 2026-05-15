import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  analyzeNutritionAdjustment,
  estimateMetabolism,
  type AdjustmentRecommendation,
  type CurrentPlan,
  type DailyLog,
  type MetabolismEstimate,
  type WeightEntry,
} from "@/lib/nutrition-adjustment";
import type { GoalType } from "@/lib/nutrition-calculations";

export const ADHERENCE_WINDOW_DAYS = 14;
export const WEIGHT_WINDOW_DAYS = 21;
export const METABOLISM_WINDOW_DAYS = 7;
export const NEXT_CHECK_IN_DAYS = 10;
/**
 * Auto-update threshold: only overwrite stored maintenance_calories when the
 * empirical estimate differs by more than this many kcal/day, to avoid noise.
 */
export const METABOLISM_AUTO_UPDATE_DELTA_KCAL = 100;

export type LatestPlanRow = {
  id: string;
  goal_type: GoalType;
  weekly_rate_percent: number | null;
  reverse_diet_weekly_kcal: number | null;
  target_weight_lbs: number | null;
  maintenance_calories: number;
  target_calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  fiber_grams: number | null;
  effective_date: string;
  next_check_in_date: string | null;
  intensity_preset: string;
  formula_used: string;
  activity_multiplier: number;
  sessions_per_week: number;
  plan_payload: Record<string, unknown> | null;
  coach_id: string;
};

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function datePlusDays(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export async function loadLatestPlan(memberId: string): Promise<LatestPlanRow | null> {
  const { data, error } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select(
      "id, goal_type, weekly_rate_percent, reverse_diet_weekly_kcal, target_weight_lbs, maintenance_calories, target_calories, protein_grams, carbs_grams, fat_grams, fiber_grams, effective_date, next_check_in_date, intensity_preset, formula_used, activity_multiplier, sessions_per_week, plan_payload, coach_id"
    )
    .eq("member_id", memberId)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle<LatestPlanRow>();

  if (error) throw new Error(error.message);
  return data;
}

async function loadDailyLogs(memberId: string, sinceIso: string): Promise<DailyLog[]> {
  const { data: days, error: daysError } = await supabaseAdmin
    .from("nutrition_days")
    .select("id, day_date")
    .eq("member_id", memberId)
    .gte("day_date", sinceIso);

  if (daysError) throw new Error(daysError.message);
  const dayRows = days ?? [];
  if (dayRows.length === 0) return [];

  const dayIds = dayRows.map((d) => d.id as string);
  const { data: entries, error: entryError } = await supabaseAdmin
    .from("nutrition_entries")
    .select("day_id, calories, protein, fiber, quantity")
    .in("day_id", dayIds);

  if (entryError) throw new Error(entryError.message);

  type DayTotals = { calories: number; protein: number; fiber: number; fiberSeen: boolean };
  const totalsByDayId = new Map<string, DayTotals>();
  for (const entry of entries ?? []) {
    const id = entry.day_id as string;
    const qty = Number(entry.quantity ?? 1) || 1;
    const cur = totalsByDayId.get(id) ?? { calories: 0, protein: 0, fiber: 0, fiberSeen: false };
    cur.calories += (Number(entry.calories) || 0) * qty;
    cur.protein += (Number(entry.protein) || 0) * qty;
    if (entry.fiber !== null && entry.fiber !== undefined) {
      cur.fiber += (Number(entry.fiber) || 0) * qty;
      cur.fiberSeen = true;
    }
    totalsByDayId.set(id, cur);
  }

  return dayRows.map((d) => {
    const totals = totalsByDayId.get(d.id as string);
    return {
      date: d.day_date as string,
      calories: totals?.calories ?? 0,
      proteinGrams: totals?.protein ?? 0,
      fiberGrams: totals?.fiberSeen ? totals.fiber : null,
    };
  });
}

async function loadWeights(memberId: string, sinceIso: string): Promise<WeightEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("health_stat_entries")
    .select("entry_date, value, unit")
    .eq("member_id", memberId)
    .eq("stat_key", "body_weight")
    .gte("entry_date", sinceIso)
    .order("entry_date", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const value = Number(row.value) || 0;
    const unit = String(row.unit ?? "lb").toLowerCase();
    const weightLbs = unit.startsWith("kg") ? value * 2.20462 : value;
    return { date: row.entry_date as string, weightLbs };
  });
}

export function buildCurrentPlan(plan: LatestPlanRow, latestWeightLbs: number | null): CurrentPlan {
  const payload = plan.plan_payload ?? {};
  const payloadWeightLbs = typeof payload.weightLbs === "number" ? (payload.weightLbs as number) : null;
  const leanBodyMassLbs = typeof payload.leanBodyMassLbs === "number" ? (payload.leanBodyMassLbs as number) : null;
  const currentWeightLbs = latestWeightLbs ?? payloadWeightLbs ?? Number(plan.target_weight_lbs ?? 0) ?? 0;
  return {
    goalType: plan.goal_type,
    targetCalories: Number(plan.target_calories),
    maintenanceCalories: Number(plan.maintenance_calories),
    proteinGrams: Number(plan.protein_grams),
    carbsGrams: Number(plan.carbs_grams),
    fatGrams: Number(plan.fat_grams),
    fiberGrams: plan.fiber_grams,
    weeklyRatePercent: Number(plan.weekly_rate_percent ?? 0),
    reverseDietWeeklyKcal: Number(plan.reverse_diet_weekly_kcal ?? 0),
    currentWeightLbs,
    targetWeightLbs: plan.target_weight_lbs,
    leanBodyMassLbs,
  };
}

export type CheckInResult =
  | { error: string; status: number }
  | {
      latestPlan: LatestPlanRow;
      currentPlan: CurrentPlan;
      recommendation: AdjustmentRecommendation;
      metabolismEstimate: MetabolismEstimate;
    };

export async function buildCheckInRecommendation(memberId: string): Promise<CheckInResult> {
  const latestPlan = await loadLatestPlan(memberId);
  if (!latestPlan) {
    return { error: "No coach nutrition plan found for member.", status: 404 };
  }

  const today = todayIsoDate();
  const adherenceSince = datePlusDays(today, -ADHERENCE_WINDOW_DAYS);
  const weightSince = datePlusDays(today, -WEIGHT_WINDOW_DAYS);

  const [dailyLogs, weights] = await Promise.all([
    loadDailyLogs(memberId, adherenceSince),
    loadWeights(memberId, weightSince),
  ]);

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weightLbs : null;
  const currentPlan = buildCurrentPlan(latestPlan, latestWeight);

  const recommendation = analyzeNutritionAdjustment({
    plan: currentPlan,
    dailyLogs,
    weights,
    adherenceWindowDays: ADHERENCE_WINDOW_DAYS,
    weightWindowDays: WEIGHT_WINDOW_DAYS,
  });

  const metabolismEstimate = estimateMetabolism({
    plan: currentPlan,
    dailyLogs,
    weights,
    windowDays: METABOLISM_WINDOW_DAYS,
    asOf: today,
  });

  return { latestPlan, currentPlan, recommendation, metabolismEstimate };
}

export async function applyAdjustmentAsNewPlan(
  memberId: string,
  latestPlan: LatestPlanRow,
  recommendation: AdjustmentRecommendation
): Promise<{ newPlanId: string | null; effectiveDate: string; nextCheckInDate: string }> {
  if (!recommendation.proposed) {
    throw new Error("Recommendation has no macro changes to apply");
  }

  const today = todayIsoDate();
  const nextCheckIn = datePlusDays(today, NEXT_CHECK_IN_DAYS);
  const proposed = recommendation.proposed;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .insert({
      coach_id: latestPlan.coach_id,
      member_id: memberId,
      goal_type: latestPlan.goal_type,
      intensity_preset: latestPlan.intensity_preset,
      weekly_rate_percent: latestPlan.weekly_rate_percent,
      reverse_diet_weekly_kcal: latestPlan.reverse_diet_weekly_kcal,
      target_weight_lbs: latestPlan.target_weight_lbs,
      maintenance_calories: latestPlan.maintenance_calories,
      target_calories: proposed.targetCalories,
      protein_grams: proposed.proteinGrams,
      carbs_grams: proposed.carbsGrams,
      fat_grams: proposed.fatGrams,
      fiber_grams: proposed.fiberGrams,
      formula_used: latestPlan.formula_used,
      activity_multiplier: latestPlan.activity_multiplier,
      sessions_per_week: latestPlan.sessions_per_week,
      effective_date: today,
      last_check_in_date: today,
      next_check_in_date: nextCheckIn,
      plan_payload: latestPlan.plan_payload ?? {},
      previous_plan_id: latestPlan.id,
      adjustment_reason: recommendation.reason,
      adherence_snapshot: {
        adherence: recommendation.adherence,
        weightTrend: recommendation.weightTrend,
        guardrails: recommendation.guardrails,
        calorieDelta: recommendation.calorieDelta,
        warnings: recommendation.warnings,
      },
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  const { error: targetError } = await supabaseAdmin
    .from("nutrition_days")
    .upsert(
      {
        member_id: memberId,
        day_date: today,
        calorie_target: proposed.targetCalories,
        protein_target: proposed.proteinGrams,
        carbs_target: proposed.carbsGrams,
        fat_target: proposed.fatGrams,
        fiber_target: proposed.fiberGrams,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    );

  if (targetError) throw new Error(targetError.message);

  return {
    newPlanId: (inserted?.id as string) ?? null,
    effectiveDate: today,
    nextCheckInDate: nextCheckIn,
  };
}
