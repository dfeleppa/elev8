import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type LabelScanResult = {
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
  confidence: "low" | "medium" | "high";
  notes: string | null;
};

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

function normalizeResult(value: Record<string, unknown>): LabelScanResult {
  const confidence = value.confidence;

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
    confidence: confidence === "low" || confidence === "medium" || confidence === "high" ? confidence : "low",
    notes: toNullableString(value.notes),
  };
}

function extractOutputText(payload: Record<string, unknown>) {
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

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Nutrition label image is required." }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG, or WebP label image." }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 8 MB or smaller." }, { status: 400 });
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const imageUrl = `data:${image.type};base64,${imageBuffer.toString("base64")}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_NUTRITION_LABEL_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Read this Nutrition Facts label. Return values per serving only. " +
                "Use grams for macros and nutrients. If the product name is visible, include it. " +
                "If a value is not visible, return null. Do not infer from daily values.",
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "nutrition_label_scan",
          strict: true,
          schema: {
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
          },
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
        : "Label scan failed.";
    return NextResponse.json({ error: message }, { status: response.status || 500 });
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    return NextResponse.json({ error: "No label data was returned." }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText) as unknown;
  } catch {
    return NextResponse.json({ error: "Label scan returned invalid data." }, { status: 502 });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Label scan returned invalid data." }, { status: 502 });
  }
  return NextResponse.json({ result: normalizeResult(parsed as Record<string, unknown>) });
}
