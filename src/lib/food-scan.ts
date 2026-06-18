export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const USDA_NUTRIENT_IDS = {
  energy: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  sugar: 2000,
  fiber: 1079,
  saturatedFat: 1258,
} as const;

export type ScanConfidence = "low" | "medium" | "high";

export type ImageClassification = {
  foodName: string | null;
  confidence: ScanConfidence;
  notes: string | null;
  isLabel: boolean;
};

export type LabelScanNutrition = {
  name: string | null;
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
  notes: string | null;
  source: "label" | "usda";
  identifiedFoodName?: string | null;
};

export type FoodScanStatus = "food" | "label" | "unsupported";

export type FoodScanResult = {
  isLabel: boolean;
  status: FoodScanStatus;
  result: LabelScanNutrition | null;
  message?: string;
  statusCode?: number;
};

export function isFoodImageScanEnabled() {
  return process.env.ENABLE_FOOD_IMAGE_SCAN !== "false";
}

export function validateImageFile(image: unknown) {
  if (!(image instanceof File)) {
    return { ok: false as const, error: "Food image is required." };
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return { ok: false as const, error: "Upload a JPG, PNG, or WebP image." };
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return { ok: false as const, error: "Image must be 8 MB or smaller." };
  }

  return { ok: true as const, file: image };
}

export async function fileToDataUrl(file: File) {
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${imageBuffer.toString("base64")}`;
}

export function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return null;
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

function toConfidence(value: unknown): ScanConfidence {
  return value === "low" || value === "medium" || value === "high" ? value : "low";
}

export function normalizeLabelScan(value: Record<string, unknown>): LabelScanNutrition {
  return {
    name: toNullableString(value.name),
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
    notes: toNullableString(value.notes),
    source: "label",
  };
}

export function normalizeImageClassification(value: Record<string, unknown>): ImageClassification {
  return {
    foodName: toNullableString(value.foodName),
    confidence: toConfidence(value.confidence),
    notes: toNullableString(value.notes),
    isLabel: value.isLabel === true,
  };
}

async function callOpenAiStructuredResponse(options: {
  apiKey: string;
  model: string;
  prompt: string;
  imageUrl: string;
  schemaName: string;
  schema: Record<string, unknown>;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: options.prompt,
            },
            {
              type: "input_image",
              image_url: options.imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: options.schemaName,
          strict: true,
          schema: options.schema,
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
        : "Vision request failed.";
    return { ok: false as const, status: response.status || 500, error: message };
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    return { ok: false as const, status: 502, error: "No vision data was returned." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText) as unknown;
  } catch {
    return { ok: false as const, status: 502, error: "Vision returned invalid data." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false as const, status: 502, error: "Vision returned invalid data." };
  }

  return { ok: true as const, data: parsed as Record<string, unknown> };
}

const IMAGE_CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    foodName: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: ["string", "null"] },
    isLabel: { type: "boolean" },
  },
  required: ["foodName", "confidence", "notes", "isLabel"],
} as const;

const COMBINED_FOOD_SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    imageType: { type: "string", enum: ["food_item", "nutrition_label", "other"] },
    foodName: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    servingSize: { type: ["number", "null"] },
    servingUnit: { type: ["string", "null"] },
    calories: { type: ["number", "null"] },
    protein: { type: ["number", "null"] },
    carbs: { type: ["number", "null"] },
    fat: { type: ["number", "null"] },
    sugar: { type: ["number", "null"] },
    fiber: { type: ["number", "null"] },
    saturatedFat: { type: ["number", "null"] },
  },
  required: [
    "imageType",
    "foodName",
    "confidence",
    "notes",
    "name",
    "servingSize",
    "servingUnit",
    "calories",
    "protein",
    "carbs",
    "fat",
    "sugar",
    "fiber",
    "saturatedFat",
  ],
} as const;

const LABEL_SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"] },
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
    notes: { type: ["string", "null"] },
  },
  required: [
    "name",
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
    "notes",
  ],
} as const;

function unsupportedFoodScan(message: string, statusCode = 422): FoodScanResult {
  return {
    isLabel: false,
    status: "unsupported",
    result: null,
    message,
    statusCode,
  };
}

export async function scanFoodImage(imageUrl: string, apiKey: string): Promise<FoodScanResult> {
  const response = await callOpenAiStructuredResponse({
    apiKey,
    model: process.env.OPENAI_FOOD_IMAGE_MODEL ?? "gpt-4.1-mini",
    prompt:
      "Analyze this image for nutrition logging. Choose exactly one imageType: " +
      "'nutrition_label' if the image is primarily a readable Nutrition Facts label; " +
      "'food_item' if it is a photo of an actual food item, meal, produce, or packaged food where the label is not the focus; " +
      "or 'other' if it is not food-related or is too unclear to classify. " +
      "For nutrition_label, return per-serving values only, use grams for macros and nutrients, include the product name when visible, " +
      "and return null for values that are not visible. Do not infer from daily values. " +
      "For food_item, set foodName to the most specific common food name you can identify. If multiple foods are visible, pick the most prominent single item. " +
      "Use notes for uncertainty, preparation style, or multiple-item warnings.",
    imageUrl,
    schemaName: "combined_food_scan",
    schema: COMBINED_FOOD_SCAN_SCHEMA,
  });

  if (!response.ok) {
    return unsupportedFoodScan(response.error, response.status);
  }

  const imageType = typeof response.data.imageType === "string" ? response.data.imageType : null;

  if (imageType === "nutrition_label") {
    return {
      isLabel: true,
      status: "label",
      result: normalizeLabelScan(response.data),
    };
  }

  if (imageType === "food_item") {
    const foodName = toNullableString(response.data.foodName);
    if (!foodName) {
      return unsupportedFoodScan("Could not identify a food item in this photo. Try a clearer single-item photo.");
    }

    const usdaMatch = await lookupUsdaFood(foodName);
    if (!usdaMatch) {
      return unsupportedFoodScan(
        `Identified "${foodName}" but could not find matching USDA nutrition data. Try searching manually.`,
        404,
      );
    }

    return {
      isLabel: false,
      status: "food",
      result: usdaMatchToScanResult(
        {
          foodName,
          confidence: toConfidence(response.data.confidence),
          notes: toNullableString(response.data.notes),
          isLabel: false,
        },
        usdaMatch,
      ),
    };
  }

  const reason = toNullableString(response.data.notes);
  return unsupportedFoodScan(reason ?? "Could not classify this image as a food item or Nutrition Facts label.");
}

export async function classifyFoodImage(imageUrl: string, apiKey: string) {
  return callOpenAiStructuredResponse({
    apiKey,
    model: process.env.OPENAI_FOOD_IMAGE_MODEL ?? "gpt-4.1-mini",
    prompt:
      "Classify this image for nutrition logging. " +
      "Set isLabel true only if the image is primarily a Nutrition Facts label with readable macro values. " +
      "Set isLabel false for photos of actual food items, meals, produce, or packaged food where the label is not the focus. " +
      "If isLabel is false, set foodName to the most specific common food name you can identify (e.g. 'banana', 'grilled chicken breast'). " +
      "If multiple foods are visible, pick the most prominent single item. " +
      "Use notes for uncertainty, preparation style, or multiple-item warnings.",
    imageUrl,
    schemaName: "food_image_classification",
    schema: IMAGE_CLASSIFICATION_SCHEMA,
  });
}

export async function extractLabelNutrition(imageUrl: string, apiKey: string) {
  return callOpenAiStructuredResponse({
    apiKey,
    model: process.env.OPENAI_NUTRITION_LABEL_MODEL ?? "gpt-4.1-mini",
    prompt:
      "Read this Nutrition Facts label. Return values per serving only. " +
      "Use grams for macros and nutrients. If the product name is visible, include it. " +
      "If a value is not visible, return null. Do not infer from daily values.",
    imageUrl,
    schemaName: "nutrition_label_scan",
    schema: LABEL_SCAN_SCHEMA,
  });
}

type UsdaFoodMatch = {
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
};

function pickNutrient(foods: Array<{ nutrientId?: number; value?: number }> | undefined, nutrientId: number) {
  const value = foods?.find((nutrient) => nutrient.nutrientId === nutrientId)?.value;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

export async function lookupUsdaFood(query: string): Promise<UsdaFoodMatch | null> {
  const apiKey = process.env.USDA_API_KEY?.trim();
  const normalizedQuery = query.trim().toLowerCase();
  if (!apiKey || normalizedQuery.length < 2) {
    return null;
  }

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", normalizedQuery);
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("requireAllWords", "true");

  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return null;
  }

  type FoodResult = {
    description?: string;
    brandOwner?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    foodNutrients?: Array<{ nutrientId?: number; value?: number }>;
  };

  const foods = (Array.isArray(payload?.foods) ? payload.foods : []) as FoodResult[];
  const best = foods.find((food) => typeof food?.description === "string" && food.description.trim().length > 0);
  if (!best?.description) {
    return null;
  }

  const nutrients = Array.isArray(best.foodNutrients) ? best.foodNutrients : [];
  return {
    description: best.description.trim(),
    brandOwner: best.brandOwner,
    servingSize: typeof best.servingSize === "number" && Number.isFinite(best.servingSize) ? best.servingSize : undefined,
    servingSizeUnit: best.servingSizeUnit,
    calories: pickNutrient(nutrients, USDA_NUTRIENT_IDS.energy),
    protein: pickNutrient(nutrients, USDA_NUTRIENT_IDS.protein),
    carbs: pickNutrient(nutrients, USDA_NUTRIENT_IDS.carbs),
    fat: pickNutrient(nutrients, USDA_NUTRIENT_IDS.fat),
    sugar: pickNutrient(nutrients, USDA_NUTRIENT_IDS.sugar),
    fiber: pickNutrient(nutrients, USDA_NUTRIENT_IDS.fiber),
    saturatedFat: pickNutrient(nutrients, USDA_NUTRIENT_IDS.saturatedFat),
  };
}

export function usdaMatchToScanResult(
  classification: ImageClassification,
  usda: UsdaFoodMatch,
): LabelScanNutrition {
  const displayName = usda.brandOwner ? `${usda.description} (${usda.brandOwner})` : usda.description;
  const notes = [classification.notes, `Matched USDA entry for "${usda.description}".`]
    .filter(Boolean)
    .join(" ");

  return {
    name: displayName,
    servingSize: usda.servingSize ?? 100,
    servingUnit: usda.servingSizeUnit ?? "gram",
    calories: usda.calories,
    protein: usda.protein,
    carbs: usda.carbs,
    fat: usda.fat,
    sugar: usda.sugar,
    fiber: usda.fiber,
    saturatedFat: usda.saturatedFat,
    confidence: classification.confidence,
    notes: notes || null,
    source: "usda",
    identifiedFoodName: classification.foodName,
  };
}
