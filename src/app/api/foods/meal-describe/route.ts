import { NextResponse } from "next/server";

import { parseMealDescription } from "@/lib/food-describe";
import { requireUserContext } from "@/lib/member";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error: userError } = await requireUserContext();
  if (userError) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!description) {
    return NextResponse.json({ error: "Meal description is required." }, { status: 400 });
  }

  const result = await parseMealDescription(description, apiKey);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ items: result.data.items });
}