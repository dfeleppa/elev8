import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

function toOptionalDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, parsed);
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
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!id || !name) {
    return NextResponse.json({ error: "Food name is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("nutrition_custom_foods")
    .update({
      name,
      calories: toOptionalDecimal(body?.calories),
      protein: toOptionalDecimal(body?.protein),
      carbs: toOptionalDecimal(body?.carbs),
      fat: toOptionalDecimal(body?.fat),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("member_id", userId)
    .select("id, name, calories, protein, carbs, fat, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ food: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing food id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("nutrition_custom_foods")
    .delete()
    .eq("id", id)
    .eq("member_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
