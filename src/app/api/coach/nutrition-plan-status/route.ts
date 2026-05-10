import { NextResponse } from "next/server";

import { getCoachNutritionPlan, hasCoachNutritionPlan } from "@/lib/coach-plan";
import { requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

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

    const [latestPlan, { data: profile, error: profileError }] = await Promise.all([
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
    });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
