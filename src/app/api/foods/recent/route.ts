import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

type RecentFood = {
  id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  quantity: number | null;
};

function safeId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "food";
}

export async function GET(request: Request) {
  const { error: userError, userId } = await requireUserContext();
  if (userError || !userId) {
    return NextResponse.json({ error: userError }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.round(limitRaw))) : 30;

  const { data, error } = await supabaseAdmin
    .from("nutrition_entries")
    .select("entry_name, calories, protein, carbs, fat, quantity")
    .eq("member_id", userId)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const items: RecentFood[] = [];

  for (const row of data ?? []) {
    const name = typeof row.entry_name === "string" ? row.entry_name.trim() : "";
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      id: safeId(name),
      name,
      calories: typeof row.calories === "number" ? row.calories : null,
      protein: typeof row.protein === "number" ? row.protein : null,
      carbs: typeof row.carbs === "number" ? row.carbs : null,
      fat: typeof row.fat === "number" ? row.fat : null,
      quantity: typeof row.quantity === "number" ? row.quantity : 1,
    });
    if (items.length >= limit) {
      break;
    }
  }

  return NextResponse.json({ items });
}
