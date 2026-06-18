import { NextResponse } from "next/server";

import { fileToDataUrl, isFoodImageScanEnabled, scanFoodImage, validateImageFile } from "@/lib/food-scan";
import { requireUserContext } from "@/lib/member";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error: userError, userId } = await requireUserContext();
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
  const scan = await scanFoodImage(imageUrl, apiKey);

  if (scan.status === "unsupported") {
    return NextResponse.json(
      { error: scan.message ?? "Could not scan this image." },
      { status: scan.statusCode ?? 422 },
    );
  }

  return NextResponse.json(scan);
}
