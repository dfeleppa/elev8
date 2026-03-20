import { NextResponse } from "next/server";

import { requireUserContextFromBearer } from "../../../../lib/member";

export const runtime = "nodejs";

const baseUrl = "https://api.nal.usda.gov/fdc/v1/foods/search";

const USDA_NUTRIENT_IDS = {
  energy: 1008,      // kcal
  protein: 1003,     // g
  carbs: 1005,       // g
  fat: 1004,         // g
} as const;

type FoodNutrient = {
  nutrientId?: number;
  value?: number;
};

type FoodResult = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: FoodNutrient[];
};

function pickNutrient(foods: FoodNutrient[] | undefined, nutrientId: number) {
  const value = foods?.find((nutrient) => nutrient.nutrientId === nutrientId)?.value;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { error } = await requireUserContextFromBearer(request);
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }
  }

  const apiKey = process.env.USDA_API_KEY;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!apiKey) {
    return NextResponse.json({ error: "Missing USDA_API_KEY." }, { status: 500 });
  }

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters." }, { status: 400 });
  }

  const url = new URL(baseUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("pageSize", "12");
  url.searchParams.set("requireAllWords", "true");

  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? "USDA request failed.";
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const foods: FoodResult[] = Array.isArray(payload?.foods) ? payload.foods : [];
  const results = foods.map((food) => ({
    fdcId: food.fdcId,
    description: food.description,
    brandOwner: food.brandOwner,
    servingSize: food.servingSize,
    servingSizeUnit: food.servingSizeUnit,
    calories: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.energy),
    protein: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.protein),
    carbs: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.carbs),
    fat: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.fat),
  }));

  return NextResponse.json({ results });
}
