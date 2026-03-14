import { NextResponse } from "next/server";

import { getAgentConfig, isAuthorizedAgentRequest } from "../../../../../lib/agent-auth";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

const allowedMeals = new Set(["breakfast", "lunch", "dinner", "snack"]);

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse, token, memberId } = getAgentConfig();
  if (errorResponse) {
    return errorResponse;
  }

  if (!isAuthorizedAgentRequest(request, token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const entryName = typeof body?.name === "string" ? body.name.trim() : null;
  const mealType = typeof body?.mealType === "string" ? body.mealType : null;

  if (!id) {
    return NextResponse.json({ error: "Invalid nutrition entry payload." }, { status: 400 });
  }

  if (entryName !== null && !entryName) {
    return NextResponse.json({ error: "Invalid nutrition entry payload." }, { status: 400 });
  }

  if (mealType !== null && !allowedMeals.has(mealType)) {
    return NextResponse.json({ error: "Invalid meal type." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (entryName !== null) {
    updates.entry_name = entryName;
  }
  if (mealType !== null) {
    updates.meal_type = mealType;
  }
  if (body?.quantity !== undefined) {
    updates.quantity = toPositiveDecimal(body.quantity);
  }
  if (body?.calories !== undefined) {
    updates.calories = toOptionalDecimal(body.calories);
  }
  if (body?.protein !== undefined) {
    updates.protein = toOptionalDecimal(body.protein);
  }
  if (body?.carbs !== undefined) {
    updates.carbs = toOptionalDecimal(body.carbs);
  }
  if (body?.fat !== undefined) {
    updates.fat = toOptionalDecimal(body.fat);
  }

  const { data: entry, error } = await supabaseAdmin
    .from("nutrition_entries")
    .update(updates)
    .eq("id", id)
    .eq("member_id", memberId)
    .select("id, meal_type, entry_name, quantity, calories, protein, carbs, fat, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry });
}
