import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !isValidDate(date)) {
    return NextResponse.json({ error: "Missing or invalid date." }, { status: 400 });
  }

  const { data: day, error: dayError } = await supabaseAdmin
    .from("nutrition_days")
    .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
    .eq("member_id", userId)
    .eq("day_date", date)
    .maybeSingle();

  if (dayError) {
    return NextResponse.json({ error: dayError.message }, { status: 500 });
  }

  if (!day) {
    return NextResponse.json({ day: null, entries: [] });
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("nutrition_entries")
    .select("id, meal_type, entry_name, calories, protein, carbs, fat, created_at")
    .eq("day_id", day.id)
    .order("created_at", { ascending: true });

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  return NextResponse.json({ day, entries: entries ?? [] });
}

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";

  if (!isValidDate(dayDate)) {
    return NextResponse.json({ error: "Invalid day date." }, { status: 400 });
  }

  const { data: day, error } = await supabaseAdmin
    .from("nutrition_days")
    .upsert(
      {
        member_id: userId,
        day_date: dayDate,
        calorie_target: toOptionalInt(body?.calorieTarget),
        protein_target: toOptionalInt(body?.proteinTarget),
        carbs_target: toOptionalInt(body?.carbsTarget),
        fat_target: toOptionalInt(body?.fatTarget),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    )
    .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ day });
}
