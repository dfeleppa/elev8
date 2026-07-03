import { NextResponse } from "next/server";

import { requireRequestUserContext } from "@/lib/member";
import {
  readNutritionNumberField,
  readNutritionStringField,
  runNutritionQueryWithFallbacks,
} from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RecentFood = {
  id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  saturated_fat: number | null;
  quantity: number | null;
};

function safeId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "food";
}

export async function GET(request: Request) {
  const { error: userError, userId } = await requireRequestUserContext(request);
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 30;

  const { data, error } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("entry_name, calories, protein, carbs, fat, sugar, fiber, saturated_fat, quantity")
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .limit(400),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("entry_name, calories, protein, carbs, fat, fiber, quantity")
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .limit(400),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("entry_name, calories, protein, carbs, fat, quantity")
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .limit(400),
  ]);

  if (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const seen = new Set<string>();
  const items: RecentFood[] = [];

  for (const row of data ?? []) {
    const rowRecord = row as Record<string, unknown>;
    const name = readNutritionStringField(rowRecord, "entry_name").trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      id: safeId(name),
      name,
      calories: readNutritionNumberField(rowRecord, "calories"),
      protein: readNutritionNumberField(rowRecord, "protein"),
      carbs: readNutritionNumberField(rowRecord, "carbs"),
      fat: readNutritionNumberField(rowRecord, "fat"),
      sugar: readNutritionNumberField(rowRecord, "sugar"),
      fiber: readNutritionNumberField(rowRecord, "fiber"),
      saturated_fat: readNutritionNumberField(rowRecord, "saturated_fat"),
      quantity: readNutritionNumberField(rowRecord, "quantity") ?? 1,
    });
    if (items.length >= limit) {
      break;
    }
  }

  return NextResponse.json({ items });
}
