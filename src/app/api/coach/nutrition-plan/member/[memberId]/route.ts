import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

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

  const [memberRes, plansRes, checkInsRes, weightsRes] = await Promise.all([
    supabaseAdmin.from("app_users").select("id, full_name, email").eq("id", memberId).maybeSingle(),
    supabaseAdmin
      .from("coach_nutrition_plans")
      .select(
        "id, goal_type, target_calories, protein_grams, carbs_grams, fat_grams, fiber_grams, effective_date, last_check_in_date, next_check_in_date, adjustment_reason, previous_plan_id, adherence_snapshot"
      )
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
  ]);

  if (memberRes.error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
  if (!memberRes.data) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  return NextResponse.json({
    member: memberRes.data,
    plans: plansRes.data ?? [],
    checkIns: checkInsRes.data ?? [],
    weights: weightsRes.data ?? [],
  });
}
