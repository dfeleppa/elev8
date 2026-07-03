import { NextResponse } from "next/server";

import { requireRequestUserContext } from "@/lib/member";
import { omitNutritionKeys, runNutritionQueryWithFallbacks } from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const allowedMeals = new Set(["breakfast", "lunch", "dinner", "snack"]);

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

function toPositiveDecimal(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(0.01, parsed);
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

export async function POST(request: Request) {
  const { error: userError, userId } = await requireRequestUserContext(request);
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

  const { data: existingDay, error: dayLookupError } = await supabaseAdmin
    .from("nutrition_days")
    .select("id, calorie_target, protein_target, carbs_target, fat_target")
    .eq("member_id", userId)
    .eq("day_date", dayDate)
    .maybeSingle();

  if (dayLookupError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  let dayId = existingDay?.id ?? null;

  if (!existingDay) {
    const planTargets = await getCoachPlanTargets(userId, dayDate);
    const { data: createdDay, error: createDayError } = await supabaseAdmin
    .from("nutrition_days")
    .upsert(
      {
        member_id: userId,
        day_date: dayDate,
        ...(planTargets ?? {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    )
    .select("id")
    .single();

    if (createDayError || !createdDay) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    dayId = createdDay.id;
  } else if (areTargetsUnset(existingDay)) {
    const planTargets = await getCoachPlanTargets(userId, dayDate);
    if (planTargets) {
      await supabaseAdmin
        .from("nutrition_days")
        .update({
          ...planTargets,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDay.id)
        .eq("member_id", userId);
    }
  }

  const payload = {
    member_id: userId,
    day_id: dayId,
    meal_type: mealType,
    entry_name: entryName,
    quantity: toPositiveDecimal(body?.quantity),
    calories: toOptionalDecimal(body?.calories),
    protein: toOptionalDecimal(body?.protein),
    carbs: toOptionalDecimal(body?.carbs),
    fat: toOptionalDecimal(body?.fat),
    fiber: toOptionalDecimal(body?.fiber),
    sugar: toOptionalDecimal(body?.sugar),
    saturated_fat: toOptionalDecimal(body?.saturatedFat ?? body?.saturated_fat),
    updated_at: new Date().toISOString(),
  };
  const { data: entry, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .insert(payload)
        .select(
          "id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, sugar, saturated_fat, created_at"
        )
        .single(),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .insert(omitNutritionKeys(payload, ["sugar", "saturated_fat"]))
        .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, fiber, created_at")
        .single(),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .insert(omitNutritionKeys(payload, ["sugar", "saturated_fat", "fiber"]))
        .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at")
        .single(),
  ]);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ entry }, { status: 201 });
}
