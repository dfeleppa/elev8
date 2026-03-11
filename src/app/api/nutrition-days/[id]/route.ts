import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

function toOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.round(parsed));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (!id) {
    return NextResponse.json({ error: "Missing day id." }, { status: 400 });
  }

  const { data: day, error } = await supabaseAdmin
    .from("nutrition_days")
    .update({
      calorie_target: toOptionalInt(body?.calorieTarget),
      protein_target: toOptionalInt(body?.proteinTarget),
      carbs_target: toOptionalInt(body?.carbsTarget),
      fat_target: toOptionalInt(body?.fatTarget),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("member_id", userId)
    .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ day });
}
