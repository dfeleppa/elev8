import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import { omitNutritionKeys, runNutritionQueryWithFallbacks } from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export async function GET() {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { data, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_custom_foods")
        .select("id, name, calories, protein, carbs, fat, sugar, fiber, saturated_fat, created_at")
        .eq("member_id", userId)
        .order("created_at", { ascending: false }),
    () =>
      supabaseAdmin
        .from("nutrition_custom_foods")
        .select("id, name, calories, protein, carbs, fat, fiber, created_at")
        .eq("member_id", userId)
        .order("created_at", { ascending: false }),
    () =>
      supabaseAdmin
        .from("nutrition_custom_foods")
        .select("id, name, calories, protein, carbs, fat, created_at")
        .eq("member_id", userId)
        .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ foods: data ?? [] });
}

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Food name is required." }, { status: 400 });
  }

  const payload = {
    member_id: userId,
    name,
    calories: toOptionalDecimal(body?.calories),
    protein: toOptionalDecimal(body?.protein),
    carbs: toOptionalDecimal(body?.carbs),
    fat: toOptionalDecimal(body?.fat),
    sugar: toOptionalDecimal(body?.sugar),
    fiber: toOptionalDecimal(body?.fiber),
    saturated_fat: toOptionalDecimal(body?.saturatedFat ?? body?.saturated_fat),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_custom_foods")
        .insert(payload)
        .select("id, name, calories, protein, carbs, fat, sugar, fiber, saturated_fat, created_at")
        .single(),
    () =>
      supabaseAdmin
        .from("nutrition_custom_foods")
        .insert(omitNutritionKeys(payload, ["sugar", "saturated_fat"]))
        .select("id, name, calories, protein, carbs, fat, fiber, created_at")
        .single(),
    () =>
      supabaseAdmin
        .from("nutrition_custom_foods")
        .insert(omitNutritionKeys(payload, ["sugar", "saturated_fat", "fiber"]))
        .select("id, name, calories, protein, carbs, fat, created_at")
        .single(),
  ]);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ food: data }, { status: 201 });
}
