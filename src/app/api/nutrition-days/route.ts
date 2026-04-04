import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

function areTargetsUnset(day: {
  calorie_target: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
}) {
  return (
    day.calorie_target === null &&
    day.protein_target === null &&
    day.carbs_target === null &&
    day.fat_target === null
  );
}

async function getCoachPlanTargets(memberId: string, date: string) {
  const { data: plan, error } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select("target_calories, protein_grams, carbs_grams, fat_grams")
    .eq("member_id", memberId)
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !plan) {
    return null;
  }

  return {
    calorie_target: toOptionalDecimal(plan.target_calories),
    protein_target: toOptionalDecimal(plan.protein_grams),
    carbs_target: toOptionalDecimal(plan.carbs_grams),
    fat_target: toOptionalDecimal(plan.fat_grams),
  };
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
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  let resolvedDay = day;

  if (!resolvedDay) {
    const planTargets = await getCoachPlanTargets(userId, date);
    if (planTargets) {
      const { data: createdDay, error: createError } = await supabaseAdmin
        .from("nutrition_days")
        .upsert(
          {
            member_id: userId,
            day_date: date,
            ...planTargets,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id,day_date" }
        )
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .single();

      if (createError) {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
      }

      resolvedDay = createdDay;
    }
  } else if (areTargetsUnset(resolvedDay)) {
    const planTargets = await getCoachPlanTargets(userId, date);
    if (planTargets) {
      const { data: updatedDay, error: updateError } = await supabaseAdmin
        .from("nutrition_days")
        .update({
          ...planTargets,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resolvedDay.id)
        .eq("member_id", userId)
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
      }

      resolvedDay = updatedDay;
    }
  }

  if (!resolvedDay) {
    return NextResponse.json({ day: null, entries: [] });
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("nutrition_entries")
    .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at")
    .eq("day_id", resolvedDay.id)
    .order("created_at", { ascending: true });

  if (entriesError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ day: resolvedDay, entries: entries ?? [] });
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
        calorie_target: toOptionalDecimal(body?.calorieTarget),
        protein_target: toOptionalDecimal(body?.proteinTarget),
        carbs_target: toOptionalDecimal(body?.carbsTarget),
        fat_target: toOptionalDecimal(body?.fatTarget),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    )
    .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ day });
}
