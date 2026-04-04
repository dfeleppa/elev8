import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

const VALID_GOAL_TYPES = new Set([
  "lose_weight",
  "gain_weight",
  "maintain_weight",
  "performance_reverse_diet",
]);

export async function PATCH(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const goalType = typeof body?.goalType === "string" ? body.goalType.trim() : null;

  if (!goalType || !VALID_GOAL_TYPES.has(goalType)) {
    return NextResponse.json({ error: "Invalid goal type." }, { status: 400 });
  }

  const { data: latest, error: fetchError } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select("id")
    .eq("member_id", userId)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  if (!latest?.id) {
    return NextResponse.json({ error: "No active coach plan found." }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .update({ goal_type: goalType, updated_at: new Date().toISOString() })
    .eq("id", latest.id);

  if (updateError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ goalType });
}
