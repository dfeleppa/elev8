import { NextResponse } from "next/server";

import {
  classifyFoodImage,
  fileToDataUrl,
  isFoodImageScanEnabled,
  lookupUsdaFood,
  normalizeImageClassification,
  usdaMatchToScanResult,
  validateImageFile,
} from "@/lib/food-scan";
import { requireRequestUserContext } from "@/lib/member";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error: userError, userId } = await requireRequestUserContext(request);
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  if (!isFoodImageScanEnabled()) {
    return NextResponse.json({ error: "Food image scan is disabled." }, { status: 503 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  if (!process.env.USDA_API_KEY?.trim()) {
    return NextResponse.json({ error: "Missing USDA_API_KEY." }, { status: 500 });
  }

  const form = await request.formData().catch(() => null);
  const validated = validateImageFile(form?.get("image"));
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const imageUrl = await fileToDataUrl(validated.file);
  const classificationResponse = await classifyFoodImage(imageUrl, apiKey);
  if (!classificationResponse.ok) {
    return NextResponse.json({ error: classificationResponse.error }, { status: classificationResponse.status });
  }

  const classification = normalizeImageClassification(classificationResponse.data);
  if (classification.isLabel) {
    return NextResponse.json({
      isLabel: true,
      result: null,
      message: "Nutrition label detected. Running label scan.",
    });
  }

  const foodName = classification.foodName?.trim();
  if (!foodName) {
    return NextResponse.json(
      {
        error: "Could not identify a food item in this photo. Try a clearer single-item photo.",
      },
      { status: 422 },
    );
  }

  const usdaMatch = await lookupUsdaFood(foodName);
  if (!usdaMatch) {
    return NextResponse.json(
      {
        error: `Identified "${foodName}" but could not find matching USDA nutrition data. Try searching manually.`,
        identifiedFoodName: foodName,
        confidence: classification.confidence,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    isLabel: false,
    result: usdaMatchToScanResult(classification, usdaMatch),
  });
}
