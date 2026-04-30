import { NextResponse } from "next/server";

import { requireUserContext, requireUserContextFromBearer } from "@/lib/member";

export const runtime = "nodejs";

const baseUrl = "https://api.nal.usda.gov/fdc/v1/foods/search";

const USDA_NUTRIENT_IDS = {
  energy: 1008,      // kcal
  protein: 1003,     // g
  carbs: 1005,       // g
  fat: 1004,         // g
  sugar: 2000,       // g
  fiber: 1079,       // g
  saturatedFat: 1258, // g
} as const;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const SEARCH_CACHE_TTL_MS = 5 * 60_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

type CachedSearchResult = {
  results: Array<{
    fdcId: number;
    description: string;
    brandOwner?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    sugar: number | null;
    fiber: number | null;
    saturatedFat: number | null;
  }>;
  expiresAt: number;
};

const searchCache = new Map<string, CachedSearchResult>();

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

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) {
    return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function consumeRateLimit(key: string) {
  const now = Date.now();

  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
      if (bucket.resetAt <= now) {
        rateLimitBuckets.delete(bucketKey);
      }
    }
  }

  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function readCachedSearch(query: string) {
  const cached = searchCache.get(query);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(query);
    return null;
  }

  return cached.results;
}

function writeCachedSearch(query: string, results: CachedSearchResult["results"]) {
  if (searchCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
      if (value.expiresAt <= now) {
        searchCache.delete(key);
      }
    }
  }

  searchCache.set(query, {
    results,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });
}

export async function GET(request: Request) {
  let requesterId: string | null = null;
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { error, userId } = await requireUserContextFromBearer(request);
    if (error || !userId) {
      return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
    }
    requesterId = userId;
  } else {
    const { error, userId } = await requireUserContext();
    if (error || !userId) {
      return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
    }
    requesterId = userId;
  }

  const limiterKey = `${requesterId}:${getClientIp(request)}`;
  const limit = consumeRateLimit(limiterKey);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many search requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      }
    );
  }

  const apiKey = process.env.USDA_API_KEY;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!apiKey) {
    return NextResponse.json({ error: "Missing USDA_API_KEY." }, { status: 500 });
  }

  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters." }, { status: 400 });
  }

  const cachedResults = readCachedSearch(normalizedQuery);
  if (cachedResults) {
    return NextResponse.json({ results: cachedResults });
  }

  const url = new URL(baseUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", normalizedQuery);
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
    sugar: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.sugar),
    fiber: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.fiber),
    saturatedFat: pickNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.saturatedFat),
  }));

  writeCachedSearch(normalizedQuery, results);

  return NextResponse.json({ results });
}
