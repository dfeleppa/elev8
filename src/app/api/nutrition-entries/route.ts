import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

const allowedMeals = new Set(["breakfast", "lunch", "dinner", "snack"]);

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";
  const mealType = typeof body?.mealType === "string" ? body.mealType : "";
  const entryName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!isValidDate(dayDate) || !allowedMeals.has(mealType) || !entryName) {
    return NextResponse.json({ error: "Invalid nutrition entry payload." }, { status: 400 });
  }

  const { data: day, error: dayError } = await supabaseAdmin
    .from("nutrition_days")
    .upsert(
      {
        member_id: userId,
        day_date: dayDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    )
    .select("id")
    .single();

  if (dayError || !day) {
    return NextResponse.json({ error: dayError?.message ?? "Day not found." }, { status: 500 });
  }

  const { data: entry, error } = await supabaseAdmin
    .from("nutrition_entries")
    .insert({
      member_id: userId,
      day_id: day.id,
      meal_type: mealType,
      entry_name: entryName,
      calories: toOptionalInt(body?.calories),
      protein: toOptionalInt(body?.protein),
      carbs: toOptionalInt(body?.carbs),
      fat: toOptionalInt(body?.fat),
      updated_at: new Date().toISOString(),
    })
    .select("id, meal_type, entry_name, calories, protein, carbs, fat, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry }, { status: 201 });
}
