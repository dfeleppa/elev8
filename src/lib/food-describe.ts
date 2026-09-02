import { extractOutputText } from "./food-scan";

export type ScanConfidence = "low" | "medium" | "high";

const MEAL_DESCRIPTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    quantity: { type: "number" },
    servingSize: { type: ["number", "null"] },
    servingUnit: { type: ["string", "null"] },
    calories: { type: ["number", "null"] },
    protein: { type: ["number", "null"] },
    carbs: { type: ["number", "null"] },
    fat: { type: ["number", "null"] },
    sugar: { type: ["number", "null"] },
    fiber: { type: ["number", "null"] },
    saturatedFat: { type: ["number", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: [
    "name",
    "quantity",
    "servingSize",
    "servingUnit",
    "calories",
    "protein",
    "carbs",
    "fat",
    "sugar",
    "fiber",
    "saturatedFat",
    "confidence",
  ],
} as const;

const MEAL_DESCRIPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: MEAL_DESCRIPTION_ITEM_SCHEMA,
    },
  },
  required: ["items"],
} as const;

type MealDescriptionItemRaw = {
  name: string;
  quantity: number;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  saturatedFat: number | null;
  confidence: ScanConfidence;
};

export type MealDescriptionItem = MealDescriptionItemRaw;

function toConfidence(value: unknown): ScanConfidence {
  return value === "low" || value === "medium" || value === "high" ? value : "low";
}

function toNullableNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value * 10) / 10);
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeItem(value: Record<string, unknown>): MealDescriptionItem {
  return {
    name: String(value.name ?? ""),
    quantity: typeof value.quantity === "number" && Number.isFinite(value.quantity) && value.quantity > 0 ? value.quantity : 1,
    servingSize: toNullableNumber(value.servingSize),
    servingUnit: toNullableString(value.servingUnit),
    calories: toNullableNumber(value.calories),
    protein: toNullableNumber(value.protein),
    carbs: toNullableNumber(value.carbs),
    fat: toNullableNumber(value.fat),
    sugar: toNullableNumber(value.sugar),
    fiber: toNullableNumber(value.fiber),
    saturatedFat: toNullableNumber(value.saturatedFat),
    confidence: toConfidence(value.confidence),
  };
}

export function normalizeMealDescription(value: Record<string, unknown>): { items: MealDescriptionItem[] } | null {
  const items = Array.isArray(value.items) ? value.items : [];
  const normalized: MealDescriptionItem[] = [];

  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const name = String((item as { name?: unknown }).name ?? "").trim();
      if (name) {
        normalized.push(normalizeItem(item as Record<string, unknown>));
      }
    }
  }

  if (normalized.length === 0) {
    return null;
  }

  return { items: normalized };
}

async function callOpenAiStructuredResponse(options: {
  apiKey: string;
  prompt: string;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_FOOD_IMAGE_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: options.prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meal_description",
          strict: true,
          schema: MEAL_DESCRIPTION_SCHEMA,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    const error = payload?.error;
    const message =
      error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Request failed.";
    return { ok: false as const, status: response.status || 500, error: message };
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    return { ok: false as const, status: 502, error: "No data was returned." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText) as unknown;
  } catch {
    return { ok: false as const, status: 502, error: "Returned invalid data." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false as const, status: 502, error: "Returned invalid data." };
  }

  return { ok: true as const, data: parsed as Record<string, unknown> };
}

export async function parseMealDescription(description: string, apiKey: string) {
  const prompt =
    "Parse this meal description into individual food items. For each item, extract the name and quantity. " +
    "The user may specify quantity as: number of items (e.g., '2 apples'), units (e.g., '6 oz chicken', '1 cup rice'), " +
    "grams/oz (e.g., '200g salmon', '8 oz steak'), or leave it unspecified. " +
    "If no quantity is specified, use 1 as the default quantity and assume a standard serving size. " +
    "For each food item, estimate nutrition values per serving based on the quantity provided. " +
    "Assign a confidence level: 'high' for common foods with clear quantities, 'medium' for some ambiguity, 'low' for unusual or unclear items. " +
    "Return an items array with name, quantity, servingSize, servingUnit, and nutrition fields. " +
    "Include servingSize (e.g., 100 for grams) and servingUnit (e.g., 'gram', 'ounce', 'cup') to indicate how the nutrition values are measured.\n\n" +
    "Meal description: " + description;

  const result = await callOpenAiStructuredResponse({ apiKey, prompt });
  if (!result.ok) {
    return result;
  }

  const normalized = normalizeMealDescription(result.data);
  if (!normalized) {
    return { ok: false as const, status: 422, error: "No food items could be parsed from the description." };
  }

  return { ok: true as const, data: normalized };
}