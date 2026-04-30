import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import {
  omitNutritionKeys,
  readNutritionNumberField,
  runNutritionQueryWithFallbacks,
} from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  const { data: plan, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("coach_nutrition_plans")
        .select("target_calories, protein_grams, carbs_grams, fat_grams, fiber_grams")
        .eq("member_id", memberId)
        .lte("effective_date", date)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("coach_nutrition_plans")
        .select("target_calories, protein_grams, carbs_grams, fat_grams")
        .eq("member_id", memberId)
        .lte("effective_date", date)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
  ]);

  if (error || !plan) {
    return null;
  }

  const planRecord = plan as Record<string, unknown>;

  return {
    calorie_target: toOptionalDecimal(readNutritionNumberField(planRecord, "target_calories")),
    protein_target: toOptionalDecimal(readNutritionNumberField(planRecord, "protein_grams")),
    carbs_target: toOptionalDecimal(readNutritionNumberField(planRecord, "carbs_grams")),
    fat_target: toOptionalDecimal(readNutritionNumberField(planRecord, "fat_grams")),
    fiber_target: toOptionalDecimal(readNutritionNumberField(planRecord, "fiber_grams")),
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

  const { data: day, error: dayError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
        .eq("member_id", userId)
        .eq("day_date", date)
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .eq("member_id", userId)
        .eq("day_date", date)
        .maybeSingle(),
  ]);

  if (dayError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  let resolvedDay = day;

  if (!resolvedDay) {
    const planTargets = await getCoachPlanTargets(userId, date);
    if (planTargets) {
      const payload = {
        member_id: userId,
        day_date: date,
        ...planTargets,
        updated_at: new Date().toISOString(),
      };
      const createdResult = await runNutritionQueryWithFallbacks([
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .upsert(payload, { onConflict: "member_id,day_date" })
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
            .single(),
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .upsert(omitNutritionKeys(payload, ["fiber_target"]), { onConflict: "member_id,day_date" })
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
            .single(),
      ]);

      if (createdResult.error) {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
      }

      resolvedDay = createdResult.data;
    }
  } else if (resolvedDay && areTargetsUnset(resolvedDay)) {
    const planTargets = await getCoachPlanTargets(userId, date);
    if (planTargets) {
      const resolvedExistingDay = resolvedDay as { id: string };
      const resolvedDayId = resolvedExistingDay.id;
      const payload = {
        ...planTargets,
        updated_at: new Date().toISOString(),
      };
      const updatedResult = await runNutritionQueryWithFallbacks([
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .update(payload)
            .eq("id", resolvedDayId)
            .eq("member_id", userId)
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
            .single(),
        () =>
          supabaseAdmin
            .from("nutrition_days")
            .update(omitNutritionKeys(payload, ["fiber_target"]))
            .eq("id", resolvedDayId)
            .eq("member_id", userId)
            .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
            .single(),
      ]);

      if (updatedResult.error) {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
      }

      resolvedDay = updatedResult.data;
    }
  }

  if (!resolvedDay) {
    return NextResponse.json({ day: null, entries: [] });
  }

  const resolvedDayId = (resolvedDay as { id: string }).id;

  const { data: entries, error: entriesError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select(
          "id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, sugar, saturated_fat, created_at"
        )
        .eq("day_id", resolvedDayId)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, created_at")
        .eq("day_id", resolvedDayId)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at")
        .eq("day_id", resolvedDayId)
        .order("created_at", { ascending: true }),
  ]);

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

  const payload = {
    member_id: userId,
    day_date: dayDate,
    calorie_target: toOptionalDecimal(body?.calorieTarget),
    protein_target: toOptionalDecimal(body?.proteinTarget),
    carbs_target: toOptionalDecimal(body?.carbsTarget),
    fat_target: toOptionalDecimal(body?.fatTarget),
    fiber_target: toOptionalDecimal(body?.fiberTarget),
    updated_at: new Date().toISOString(),
  };
  const { data: day, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .upsert(payload, { onConflict: "member_id,day_date" })
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target, fiber_target")
        .single(),
    () =>
      supabaseAdmin
        .from("nutrition_days")
        .upsert(omitNutritionKeys(payload, ["fiber_target"]), { onConflict: "member_id,day_date" })
        .select("id, day_date, calorie_target, protein_target, carbs_target, fat_target")
        .single(),
  ]);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ day });
}
