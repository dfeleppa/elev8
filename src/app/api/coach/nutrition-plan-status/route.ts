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
        .select("goal_type, target_weight_kg, effective_date, last_check_in_date, next_check_in_date, plan_payload")
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
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { data: currentWeightEntry } = await supabaseAdmin
      .from("health_stat_entries")
      .select("value, entry_date")
      .eq("member_id", userId)
      .eq("stat_key", "body_weight")
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planPayload = (latestPlan?.plan_payload ?? {}) as { weightKg?: number | null };

    const startWeight =
      typeof planPayload.weightKg === "number" && Number.isFinite(planPayload.weightKg)
        ? planPayload.weightKg
        : typeof profile?.current_weight_kg === "number" && Number.isFinite(profile.current_weight_kg)
          ? profile.current_weight_kg
          : null;

    const currentWeight =
      typeof currentWeightEntry?.value === "number" && Number.isFinite(currentWeightEntry.value)
        ? currentWeightEntry.value
        : typeof profile?.current_weight_kg === "number" && Number.isFinite(profile.current_weight_kg)
          ? profile.current_weight_kg
          : startWeight;

    return NextResponse.json({
      hasPlan,
      summary: latestPlan
        ? {
            goalType: latestPlan.goal_type,
            startWeight,
            currentWeight,
            targetWeight:
              typeof latestPlan.target_weight_kg === "number" && Number.isFinite(latestPlan.target_weight_kg)
                ? latestPlan.target_weight_kg
                : null,
            effectiveDate: latestPlan.effective_date,
            lastCheckInDate: latestPlan.last_check_in_date,
            nextCheckInDate: latestPlan.next_check_in_date,
          }
        : null,
    });
  } catch (queryError) {
    const message = queryError instanceof Error ? queryError.message : "Unable to check coach plan status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
