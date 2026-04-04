import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params are required." }, { status: 400 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("health_stat_entries")
    .select("stat_key, value, entry_date")
    .eq("member_id", userId)
    .in("stat_key", ["body_weight", "body_fat", "lean_body_mass"])
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: true });

  if (queryError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  type DayEntry = { body_weight: number | null; body_fat: number | null; lean_body_mass: number | null };
  const byDate = new Map<string, DayEntry>();

  for (const row of data ?? []) {
    if (!row.entry_date) continue;
    if (!byDate.has(row.entry_date)) {
      byDate.set(row.entry_date, { body_weight: null, body_fat: null, lean_body_mass: null });
    }
    const entry = byDate.get(row.entry_date)!;
    const key = row.stat_key as keyof DayEntry;
    if (key in entry && typeof row.value === "number") {
      entry[key] = row.value;
    }
  }

  const entries = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  return NextResponse.json({ entries });
}
