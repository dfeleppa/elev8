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
  const entryName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!id || !entryName) {
    return NextResponse.json({ error: "Invalid nutrition entry payload." }, { status: 400 });
  }

  const { data: entry, error } = await supabaseAdmin
    .from("nutrition_entries")
    .update({
      entry_name: entryName,
      calories: toOptionalInt(body?.calories),
      protein: toOptionalInt(body?.protein),
      carbs: toOptionalInt(body?.carbs),
      fat: toOptionalInt(body?.fat),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("member_id", userId)
    .select("id, meal_type, entry_name, calories, protein, carbs, fat, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry });
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
    return NextResponse.json({ error: "Missing entry id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("nutrition_entries")
    .delete()
    .eq("id", id)
    .eq("member_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
