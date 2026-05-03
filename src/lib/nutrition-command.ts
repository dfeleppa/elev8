import { omitNutritionKeys, readNutritionNumberField, readNutritionStringField, runNutritionQueryWithFallbacks } from "@/lib/nutrition-schema";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

export type CopyMealIntent = {
  intent: "copy_meal";
  mealType: MealKey;
  targetMealType: MealKey;
  sourceDate: string;
  targetDate: string;
  summary: string;
};

export type SearchFoodsIntent = {
  intent: "search_foods";
  mealType: MealKey | null;
  searchQuery: string;
  summary: string;
};

export type AddFoodIntent = {
  intent: "add_food";
  mealType: MealKey;
  targetDate: string;
  foodQuery: string;
  quantity: number;
  summary: string;
};

export type UnknownIntent = {
  intent: "unknown";
  summary: string;
};

export type NutritionIntent = CopyMealIntent | SearchFoodsIntent | AddFoodIntent | UnknownIntent;

type ParsedNutritionIntent = {
  intent?: string;
  mealType?: MealKey;
  targetMealType?: MealKey;
  sourceDate?: string;
  targetDate?: string;
  searchQuery?: string;
  foodQuery?: string;
  quantity?: number;
  summary?: string;
};

export type FoodCandidate = {
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  saturated_fat: number | null;
};

export type ResolvedFoodCandidate = {
  candidate: FoodCandidate;
  source: "local" | "usda";
};

const mealKeywords: Array<{ key: MealKey; terms: string[] }> = [
  { key: "breakfast", terms: ["breakfast"] },
  { key: "lunch", terms: ["lunch"] },
  { key: "dinner", terms: ["dinner", "supper"] },
  { key: "snack", terms: ["snack"] },
];

export function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toLocalDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function shiftDate(date: string, deltaDays: number) {
  const next = new Date(`${date}T00:00:00`);
  if (Number.isNaN(next.getTime())) {
    return date;
  }
  next.setDate(next.getDate() + deltaDays);
  return toLocalDateInputValue(next);
}

function pickMeal(text: string): MealKey | null {
  const normalized = text.toLowerCase();
  for (const meal of mealKeywords) {
    if (meal.terms.some((term) => normalized.includes(term))) {
      return meal.key;
    }
  }
  return null;
}

function parseQuantity(text: string) {
  const matched = text.match(/\b(\d+(?:\.\d+)?)\b/);
  const parsed = matched ? Number(matched[1]) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function heuristicInterpret(command: string, selectedDate: string): NutritionIntent {
  const normalized = command.trim().toLowerCase();
  const mealType = pickMeal(normalized);

  if (normalized.includes("copy")) {
    if (!mealType) {
      return {
        intent: "unknown",
        summary: "Tell me which meal to copy, like breakfast, lunch, dinner, or snack.",
      };
    }

    let sourceDate = selectedDate;
    let targetDate = selectedDate;
    let targetMealType = mealType;

    if (normalized.includes("yesterday")) {
      sourceDate = shiftDate(selectedDate, -1);
    } else if (normalized.includes("today")) {
      sourceDate = selectedDate;
    }

    if (normalized.includes("tomorrow")) {
      targetDate = shiftDate(selectedDate, 1);
    } else if (normalized.includes("today")) {
      targetDate = selectedDate;
    }

    const targetMeal = normalized.match(/\bto (breakfast|lunch|dinner|snack)\b/)?.[1] as MealKey | undefined;
    if (targetMeal) {
      targetMealType = targetMeal;
    }

    return {
      intent: "copy_meal",
      mealType,
      targetMealType,
      sourceDate,
      targetDate,
      summary: `Copy ${mealType} from ${sourceDate} to ${targetMealType} on ${targetDate}.`,
    };
  }

  if (/\b(add|log|track)\b/.test(normalized) && mealType) {
    let targetDate = selectedDate;
    if (normalized.includes("tomorrow")) {
      targetDate = shiftDate(selectedDate, 1);
    } else if (normalized.includes("yesterday")) {
      targetDate = shiftDate(selectedDate, -1);
    }

    const quantity = parseQuantity(normalized);
    const foodQuery = normalized
      .replace(/\b(add|log|track|my|please|for|to|into|today|tomorrow|yesterday)\b/g, " ")
      .replace(/\b(breakfast|lunch|dinner|snack|supper)\b/g, " ")
      .replace(/\b\d+(?:\.\d+)?\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (foodQuery.length >= 2) {
      return {
        intent: "add_food",
        mealType,
        targetDate,
        foodQuery,
        quantity,
        summary: `Add ${quantity} serving${quantity === 1 ? "" : "s"} of ${foodQuery} to ${mealType} on ${targetDate}.`,
      };
    }
  }

  const mealFromSearch = mealType;
  const searchQuery = normalized
    .replace(/\b(search|find|look up|show|add|log|track|for|me|my|please|using ai|with ai)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (searchQuery.length >= 2) {
    return {
      intent: "search_foods",
      mealType: mealFromSearch,
      searchQuery,
      summary: `Search foods for "${searchQuery}".`,
    };
  }

  return {
    intent: "unknown",
    summary: "Try something like 'search for greek yogurt' or 'copy my breakfast from yesterday'.",
  };
}

export async function aiInterpret(command: string, selectedDate: string): Promise<NutritionIntent | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_NUTRITION_MODEL?.trim() || "gpt-4.1-mini";
  const today = toLocalDateInputValue(new Date());

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You parse nutrition tracker commands into JSON only. Supported intents: copy_meal, search_foods, add_food, unknown. For copy_meal, include mealType, targetMealType, sourceDate, targetDate, summary. For search_foods, include mealType or null, searchQuery, summary. For add_food, include mealType, targetDate, foodQuery, quantity, summary. Use YYYY-MM-DD dates. If the user says yesterday or today, resolve relative to selectedDate unless the command clearly specifies another target date. Never include markdown.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                command,
                selectedDate,
                today,
                meals: ["breakfast", "lunch", "dinner", "snack"],
              }),
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const text = Array.isArray(payload?.output)
    ? payload.output
        .flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
        .map((item: { text?: string }) => item.text ?? "")
        .join("")
    : "";

  if (!response.ok || !text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as ParsedNutritionIntent;
    if (parsed.intent === "copy_meal" && parsed.mealType && parsed.targetMealType && parsed.sourceDate && parsed.targetDate) {
      return {
        intent: "copy_meal",
        mealType: parsed.mealType,
        targetMealType: parsed.targetMealType,
        sourceDate: parsed.sourceDate,
        targetDate: parsed.targetDate,
        summary: parsed.summary?.trim() || `Copy ${parsed.mealType} from ${parsed.sourceDate} to ${parsed.targetDate}.`,
      };
    }
    if (parsed.intent === "search_foods" && parsed.searchQuery) {
      return {
        intent: "search_foods",
        mealType: parsed.mealType ?? null,
        searchQuery: parsed.searchQuery.trim(),
        summary: parsed.summary?.trim() || `Search foods for "${parsed.searchQuery.trim()}".`,
      };
    }
    if (parsed.intent === "add_food" && parsed.mealType && parsed.targetDate && parsed.foodQuery) {
      return {
        intent: "add_food",
        mealType: parsed.mealType,
        targetDate: parsed.targetDate,
        foodQuery: parsed.foodQuery.trim(),
        quantity:
          typeof parsed.quantity === "number" && Number.isFinite(parsed.quantity) && parsed.quantity > 0
            ? parsed.quantity
            : 1,
        summary:
          parsed.summary?.trim() ||
          `Add ${parsed.quantity ?? 1} serving${parsed.quantity === 1 ? "" : "s"} of ${parsed.foodQuery.trim()}.`,
      };
    }
    if (parsed.intent === "unknown") {
      return {
        intent: "unknown",
        summary: parsed.summary?.trim() || "I couldn't interpret that nutrition command.",
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function interpretNutritionCommand(command: string, selectedDate: string) {
  return (await aiInterpret(command, selectedDate)) ?? heuristicInterpret(command, selectedDate);
}

export async function getOrCreateNutritionDay(memberId: string, date: string) {
  const { data: existingDay, error: existingDayError } = await supabaseAdmin
    .from("nutrition_days")
    .select("id")
    .eq("member_id", memberId)
    .eq("day_date", date)
    .maybeSingle();

  if (existingDayError) {
    throw new Error("Failed to load target day.");
  }

  if (existingDay?.id) {
    return existingDay.id;
  }

  const { data: plan } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select("target_calories, protein_grams, carbs_grams, fat_grams")
    .eq("member_id", memberId)
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: createdDay, error: createdDayError } = await supabaseAdmin
    .from("nutrition_days")
    .upsert(
      {
        member_id: memberId,
        day_date: date,
        calorie_target: typeof plan?.target_calories === "number" ? plan.target_calories : null,
        protein_target: typeof plan?.protein_grams === "number" ? plan.protein_grams : null,
        carbs_target: typeof plan?.carbs_grams === "number" ? plan.carbs_grams : null,
        fat_target: typeof plan?.fat_grams === "number" ? plan.fat_grams : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,day_date" }
    )
    .select("id")
    .single();

  if (createdDayError || !createdDay?.id) {
    throw new Error("Failed to create target day.");
  }

  return createdDay.id;
}

export async function executeCopyMeal(memberId: string, intent: CopyMealIntent) {
  const { data: sourceDay, error: sourceDayError } = await supabaseAdmin
    .from("nutrition_days")
    .select("id")
    .eq("member_id", memberId)
    .eq("day_date", intent.sourceDate)
    .maybeSingle();

  if (sourceDayError) {
    throw new Error("Failed to load source day.");
  }

  if (!sourceDay?.id) {
    throw new Error(`No nutrition day found for ${intent.sourceDate}.`);
  }

  const { data: sourceEntries, error: sourceEntriesError } = await runNutritionQueryWithFallbacks([
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("entry_name, quantity, calories, protein, carbs, fat, fiber, sugar, saturated_fat")
        .eq("day_id", sourceDay.id)
        .eq("member_id", memberId)
        .eq("meal_type", intent.mealType)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("entry_name, quantity, calories, protein, carbs, fat, fiber")
        .eq("day_id", sourceDay.id)
        .eq("member_id", memberId)
        .eq("meal_type", intent.mealType)
        .order("created_at", { ascending: true }),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .select("entry_name, quantity, calories, protein, carbs, fat")
        .eq("day_id", sourceDay.id)
        .eq("member_id", memberId)
        .eq("meal_type", intent.mealType)
        .order("created_at", { ascending: true }),
  ]);

  if (sourceEntriesError) {
    throw new Error("Failed to load source meal.");
  }

  if (!sourceEntries || sourceEntries.length === 0) {
    throw new Error(`No ${intent.mealType} entries found on ${intent.sourceDate}.`);
  }

  const targetDayId = await getOrCreateNutritionDay(memberId, intent.targetDate);

  const entryPayload = sourceEntries.map((entry) => {
    const rowRecord = entry as Record<string, unknown>;
    return {
      member_id: memberId,
      day_id: targetDayId,
      meal_type: intent.targetMealType,
      entry_name: readNutritionStringField(rowRecord, "entry_name"),
      quantity: readNutritionNumberField(rowRecord, "quantity"),
      calories: readNutritionNumberField(rowRecord, "calories"),
      protein: readNutritionNumberField(rowRecord, "protein"),
      carbs: readNutritionNumberField(rowRecord, "carbs"),
      fat: readNutritionNumberField(rowRecord, "fat"),
      fiber: readNutritionNumberField(rowRecord, "fiber"),
      sugar: readNutritionNumberField(rowRecord, "sugar"),
      saturated_fat: readNutritionNumberField(rowRecord, "saturated_fat"),
      updated_at: new Date().toISOString(),
    };
  });
  const { error: insertError } = await runNutritionQueryWithFallbacks([
    () => supabaseAdmin.from("nutrition_entries").insert(entryPayload),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .insert(entryPayload.map((entry) => omitNutritionKeys(entry, ["sugar", "saturated_fat"]))),
    () =>
      supabaseAdmin
        .from("nutrition_entries")
        .insert(entryPayload.map((entry) => omitNutritionKeys(entry, ["sugar", "saturated_fat", "fiber"]))),
  ]);

  if (insertError) {
    throw new Error("Failed to copy meal.");
  }

  return {
    copiedCount: sourceEntries.length,
    targetDate: intent.targetDate,
    mealType: intent.targetMealType,
    message: `Copied ${sourceEntries.length} ${sourceEntries.length === 1 ? "entry" : "entries"} into ${intent.targetMealType} for ${intent.targetDate}.`,
  };
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function scoreFoodMatch(candidateName: string, query: string) {
  const candidate = candidateName.trim().toLowerCase();
  if (!candidate) {
    return 0;
  }
  if (candidate === query) {
    return 100;
  }
  if (candidate.startsWith(query)) {
    return 80;
  }
  if (candidate.includes(query)) {
    return 60;
  }
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const matchedTerms = queryTerms.filter((term) => candidate.includes(term)).length;
  return matchedTerms * 10;
}

async function searchUsdFoods(query: string, limit = 3) {
  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("requireAllWords", "true");

  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return [];
  }

  type UsdaFood = {
    description?: string;
    brandOwner?: string;
    foodNutrients?: Array<{ nutrientId?: number; value?: number }>;
  };

  const foods = (Array.isArray(payload?.foods) ? payload.foods : []) as UsdaFood[];
  return foods
    .filter((food) => typeof food?.description === "string" && food.description.trim().length > 0)
    .map((food) => {
      const description = food.description as string;
      const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
      const pick = (id: number) => {
        const value = nutrients.find((item: { nutrientId?: number; value?: number }) => item.nutrientId === id)?.value;
        return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
      };

      return {
        candidate: {
          name: food.brandOwner ? `${description} (${food.brandOwner})` : description,
          calories: pick(1008),
          protein: pick(1003),
          carbs: pick(1005),
          fat: pick(1004),
          sugar: pick(2000),
          fiber: pick(1079),
          saturated_fat: pick(1258),
        } satisfies FoodCandidate,
        source: "usda" as const,
      };
    });
}

export async function searchFoodCandidates(memberId: string, query: string, limit = 5) {
  const normalizedQuery = normalizeQuery(query);

  const [customFoodsResult, recentEntriesResult, usdaCandidates] = await Promise.all([
    runNutritionQueryWithFallbacks([
      () =>
        supabaseAdmin
          .from("nutrition_custom_foods")
          .select("name, calories, protein, carbs, fat, fiber, sugar, saturated_fat")
          .eq("member_id", memberId),
      () =>
        supabaseAdmin
          .from("nutrition_custom_foods")
          .select("name, calories, protein, carbs, fat, fiber")
          .eq("member_id", memberId),
      () =>
        supabaseAdmin
          .from("nutrition_custom_foods")
          .select("name, calories, protein, carbs, fat")
          .eq("member_id", memberId),
    ]),
    runNutritionQueryWithFallbacks([
      () =>
        supabaseAdmin
          .from("nutrition_entries")
          .select("entry_name, calories, protein, carbs, fat, fiber, sugar, saturated_fat")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(100),
      () =>
        supabaseAdmin
          .from("nutrition_entries")
          .select("entry_name, calories, protein, carbs, fat, fiber")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(100),
      () =>
        supabaseAdmin
          .from("nutrition_entries")
          .select("entry_name, calories, protein, carbs, fat")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(100),
    ]),
    searchUsdFoods(normalizedQuery, Math.min(limit, 3)),
  ]);

  if (customFoodsResult.error) {
    throw new Error("Failed to search custom foods.");
  }
  if (recentEntriesResult.error) {
    throw new Error("Failed to search recent foods.");
  }

  const localCandidates: Array<ResolvedFoodCandidate & { score: number }> = [];

  for (const row of customFoodsResult.data ?? []) {
    const rowRecord = row as Record<string, unknown>;
    const name = readNutritionStringField(rowRecord, "name");
    const score = scoreFoodMatch(name, normalizedQuery);
    if (score <= 0) {
      continue;
    }
    localCandidates.push({
      candidate: {
        name,
        calories: readNutritionNumberField(rowRecord, "calories"),
        protein: readNutritionNumberField(rowRecord, "protein"),
        carbs: readNutritionNumberField(rowRecord, "carbs"),
        fat: readNutritionNumberField(rowRecord, "fat"),
        fiber: readNutritionNumberField(rowRecord, "fiber"),
        sugar: readNutritionNumberField(rowRecord, "sugar"),
        saturated_fat: readNutritionNumberField(rowRecord, "saturated_fat"),
      },
      source: "local",
      score,
    });
  }

  for (const row of recentEntriesResult.data ?? []) {
    const rowRecord = row as Record<string, unknown>;
    const name = readNutritionStringField(rowRecord, "entry_name");
    const score = scoreFoodMatch(name, normalizedQuery);
    if (score <= 0) {
      continue;
    }
    localCandidates.push({
      candidate: {
        name,
        calories: readNutritionNumberField(rowRecord, "calories"),
        protein: readNutritionNumberField(rowRecord, "protein"),
        carbs: readNutritionNumberField(rowRecord, "carbs"),
        fat: readNutritionNumberField(rowRecord, "fat"),
        fiber: readNutritionNumberField(rowRecord, "fiber"),
        sugar: readNutritionNumberField(rowRecord, "sugar"),
        saturated_fat: readNutritionNumberField(rowRecord, "saturated_fat"),
      },
      source: "local",
      score,
    });
  }

  const deduped = new Map<string, ResolvedFoodCandidate & { score: number }>();
  for (const item of localCandidates) {
    const key = item.candidate.name.trim().toLowerCase();
    const current = deduped.get(key);
    if (!current || item.score > current.score) {
      deduped.set(key, item);
    }
  }

  const rankedLocal = Array.from(deduped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const combined: ResolvedFoodCandidate[] = [
    ...rankedLocal.map(({ candidate, source }) => ({ candidate, source })),
    ...usdaCandidates,
  ];

  const uniqueCombined = new Map<string, ResolvedFoodCandidate>();
  for (const item of combined) {
    const key = item.candidate.name.trim().toLowerCase();
    if (!uniqueCombined.has(key)) {
      uniqueCombined.set(key, item);
    }
  }

  return Array.from(uniqueCombined.values()).slice(0, limit);
}

export async function resolveFoodCandidate(memberId: string, query: string, candidateName?: string) {
  const candidates = await searchFoodCandidates(memberId, query, 5);
  if (candidateName) {
    const match = candidates.find((item) => item.candidate.name.trim().toLowerCase() === candidateName.trim().toLowerCase());
    if (match) {
      return match;
    }
  }
  return candidates[0] ?? null;
}

export async function executeAddFood(memberId: string, intent: AddFoodIntent, candidateName?: string) {
  const resolved = await resolveFoodCandidate(memberId, intent.foodQuery, candidateName);
  if (!resolved) {
    throw new Error(`I couldn't find a food match for "${intent.foodQuery}".`);
  }

  const targetDayId = await getOrCreateNutritionDay(memberId, intent.targetDate);
  const quantity = Math.max(0.01, Math.round(intent.quantity * 100) / 100);

  const payload = {
    member_id: memberId,
    day_id: targetDayId,
    meal_type: intent.mealType,
    entry_name: resolved.candidate.name,
    quantity,
    calories: resolved.candidate.calories,
    protein: resolved.candidate.protein,
    carbs: resolved.candidate.carbs,
    fat: resolved.candidate.fat,
    fiber: resolved.candidate.fiber,
    sugar: resolved.candidate.sugar,
    saturated_fat: resolved.candidate.saturated_fat,
    updated_at: new Date().toISOString(),
  };
  const { error } = await runNutritionQueryWithFallbacks([
    () => supabaseAdmin.from("nutrition_entries").insert(payload),
    () => supabaseAdmin.from("nutrition_entries").insert(omitNutritionKeys(payload, ["sugar", "saturated_fat"])),
    () => supabaseAdmin.from("nutrition_entries").insert(omitNutritionKeys(payload, ["sugar", "saturated_fat", "fiber"])),
  ]);

  if (error) {
    throw new Error("Failed to add food.");
  }

  return {
    targetDate: intent.targetDate,
    mealType: intent.mealType,
    quantity,
    source: resolved.source,
    foodName: resolved.candidate.name,
    nutrition: resolved.candidate,
    message: `Added ${quantity} serving${quantity === 1 ? "" : "s"} of ${resolved.candidate.name} to ${intent.mealType} for ${intent.targetDate}.`,
  };
}
