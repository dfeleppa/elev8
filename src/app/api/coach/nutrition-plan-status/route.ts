import { NextResponse } from "next/server";

import { hasCoachNutritionPlan } from "@/lib/coach-plan";
import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const hasPlan = await hasCoachNutritionPlan(userId);
    if (!hasPlan) {
      return NextResponse.json({ hasPlan, summary: null });
    }

    const [{ data: latestPlan, error: planError }, { data: profile, error: profileError }] = await Promise.all([
      supabaseAdmin
        .from("coach_nutrition_plans")
        .select("goal_type, target_weight_lbs, effective_date, last_check_in_date, next_check_in_date, plan_payload")
        .eq("member_id", userId)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("app_users")
        .select("current_weight_kg")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (planError) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
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
