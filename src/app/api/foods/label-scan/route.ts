import { NextResponse } from "next/server";

import {
  classifyFoodImage,
  extractLabelNutrition,
  fileToDataUrl,
  isFoodImageScanEnabled,
  normalizeLabelScan,
  validateImageFile,
} from "@/lib/food-scan";
import { requireRequestUserContext } from "@/lib/member";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error: userError, userId } = await requireRequestUserContext(request);
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  const form = await request.formData().catch(() => null);
  const validated = validateImageFile(form?.get("image"));
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const imageUrl = await fileToDataUrl(validated.file);

  if (isFoodImageScanEnabled()) {
    const classificationResponse = await classifyFoodImage(imageUrl, apiKey);
    if (classificationResponse.ok && classificationResponse.data.isLabel === false) {
      return NextResponse.json(
        {
          error:
            "This looks like a food photo, not a Nutrition Facts label. Use Scan — it auto-detects labels and food items.",
          code: "FOOD_ITEM_DETECTED",
        },
        { status: 422 },
      );
    }
  }

  const labelResponse = await extractLabelNutrition(imageUrl, apiKey);
  if (!labelResponse.ok) {
    return NextResponse.json({ error: labelResponse.error }, { status: labelResponse.status });
  }

  return NextResponse.json({ result: normalizeLabelScan(labelResponse.data) });
}
