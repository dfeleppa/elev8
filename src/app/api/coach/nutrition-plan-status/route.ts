import { NextResponse } from "next/server";

import { getCoachNutritionPlan, hasCoachNutritionPlan } from "@/lib/coach-plan";
import { requireRequestUserContext } from "@/lib/member";
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

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundNutritionTotal(value: number) {
  return Math.round(value * 10) / 10;
}

async function getRecentNutritionDays(userId: string) {
  const { data: days, error: daysError } = await runNutritionQueryWithFallbacks<NutritionDayRow[]>([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
        .eq("member_id", userId)
        .order("day_date", { ascending: false })
        .limit(90),
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .eq("member_id", userId)
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
        .eq("member_id", userId)
        .in("day_id", dayIds),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("day_id, quantity, calories, protein, carbs, fat")
        .eq("member_id", userId)
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

export async function GET(request: Request) {
  const { error, userId } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const hasPlan = await hasCoachNutritionPlan(userId);
    if (!hasPlan) {
      return NextResponse.json({ hasPlan, summary: null });
    }

    const [latestPlan, { data: profile, error: profileError }, recentNutritionDays] = await Promise.all([
      getCoachNutritionPlan<{
        goal_type: string | null;
        target_weight_lbs: number | null;
        maintenance_calories: number | null;
        target_calories: number | null;
        protein_grams: number | null;
        carbs_grams: number | null;
        fat_grams: number | null;
        maintenance_calories_source: "formula" | "empirical" | null;
        maintenance_calories_estimated_at: string | null;
        effective_date: string | null;
        last_check_in_date: string | null;
        next_check_in_date: string | null;
        plan_payload: { weightLbs?: number | null; weightKg?: number | null } | null;
      }>(
        userId,
        "goal_type, target_weight_lbs, maintenance_calories, target_calories, protein_grams, carbs_grams, fat_grams, maintenance_calories_source, maintenance_calories_estimated_at, effective_date, last_check_in_date, next_check_in_date, plan_payload"
      ),
      supabaseAdmin
        .from("app_users")
        .select("current_weight_kg")
        .eq("id", userId)
        .maybeSingle(),
      getRecentNutritionDays(userId),
    ]);
    if (profileError) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    const { data: currentWeightEntry } = await supabaseAdmin
      .from("health_stat_entries")
      .select("value, entry_date")
      .eq("member_id", userId)
      .eq("stat_key", "body_weight")
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planPayload = (latestPlan?.plan_payload ?? {}) as { weightLbs?: number | null; weightKg?: number | null };

    // Prefer lbs stored directly; fall back to converting kg for legacy rows.
    const startWeight =
      typeof planPayload.weightLbs === "number" && Number.isFinite(planPayload.weightLbs)
        ? planPayload.weightLbs
        : typeof planPayload.weightKg === "number" && Number.isFinite(planPayload.weightKg)
          ? Math.round(planPayload.weightKg * 2.20462 * 10) / 10
          : typeof profile?.current_weight_kg === "number" && Number.isFinite(profile.current_weight_kg)
            ? Math.round(profile.current_weight_kg * 2.20462 * 10) / 10
            : null;

    const currentWeight =
      typeof currentWeightEntry?.value === "number" && Number.isFinite(currentWeightEntry.value)
        ? currentWeightEntry.value
        : typeof profile?.current_weight_kg === "number" && Number.isFinite(profile.current_weight_kg)
          ? Math.round(profile.current_weight_kg * 2.20462 * 10) / 10
          : startWeight;

    return NextResponse.json({
      hasPlan,
      summary: latestPlan
        ? {
            goalType: latestPlan.goal_type,
            startWeight,
            currentWeight,
            targetWeight:
              typeof latestPlan.target_weight_lbs === "number" && Number.isFinite(latestPlan.target_weight_lbs)
                ? latestPlan.target_weight_lbs
                : null,
            estimatedMetabolism:
              typeof latestPlan.maintenance_calories === "number" && Number.isFinite(latestPlan.maintenance_calories)
                ? latestPlan.maintenance_calories
                : null,
            metabolismSource: latestPlan.maintenance_calories_source,
            metabolismEstimatedAt: latestPlan.maintenance_calories_estimated_at,
            targetCalories:
              typeof latestPlan.target_calories === "number" && Number.isFinite(latestPlan.target_calories)
                ? latestPlan.target_calories
                : null,
            proteinGrams:
              typeof latestPlan.protein_grams === "number" && Number.isFinite(latestPlan.protein_grams)
                ? latestPlan.protein_grams
                : null,
            carbsGrams:
              typeof latestPlan.carbs_grams === "number" && Number.isFinite(latestPlan.carbs_grams)
                ? latestPlan.carbs_grams
                : null,
            fatGrams:
              typeof latestPlan.fat_grams === "number" && Number.isFinite(latestPlan.fat_grams)
                ? latestPlan.fat_grams
                : null,
            effectiveDate: latestPlan.effective_date,
            lastCheckInDate: latestPlan.last_check_in_date,
            nextCheckInDate: latestPlan.next_check_in_date,
          }
        : null,
      recentNutritionDays,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
