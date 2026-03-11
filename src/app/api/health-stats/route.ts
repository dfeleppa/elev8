import { NextResponse } from "next/server";
import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

const statUnitMap: Record<string, string> = {
  body_weight: "lb",
  body_fat: "%",
  lean_body_mass: "lb",
  squat: "lb",
  bench: "lb",
  deadlift: "lb",
  press: "lb",
  clean_jerk: "lb",
  snatch: "lb",
  running: "min",
  rowing: "min",
  biking: "min",
  crossfit: "min",
};

export async function GET() {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("health_stat_entries")
    .select("stat_key, value, unit, entry_date")
    .eq("member_id", userId)
    .order("entry_date", { ascending: false });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const latest: Record<string, { value: string; unit: string; entryDate: string | null }> = {};

  (data ?? []).forEach((row) => {
    if (!row?.stat_key || latest[row.stat_key]) {
      return;
    }
    latest[row.stat_key] = {
      value: row.value?.toString?.() ?? "",
      unit: row.unit ?? statUnitMap[row.stat_key] ?? "",
      entryDate: row.entry_date ?? null,
    };
  });

  return NextResponse.json({ stats: latest });
}

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const statKey = typeof body?.statKey === "string" ? body.statKey : "";
  const unit = statUnitMap[statKey];
  const numericValue = Number(body?.value);

  if (!statKey || !unit || !Number.isFinite(numericValue)) {
    return NextResponse.json({ error: "Invalid stat payload." }, { status: 400 });
  }

  const entryDate = new Date().toISOString().slice(0, 10);

  const { data, error: insertError } = await supabaseAdmin
    .from("health_stat_entries")
    .insert({
      member_id: userId,
      stat_key: statKey,
      value: numericValue,
      unit,
      entry_date: entryDate,
      updated_at: new Date().toISOString(),
    })
    .select("stat_key, value, unit, entry_date")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: insertError?.message ?? "Unable to save stat." }, { status: 500 });
  }

  return NextResponse.json({
    entry: {
      statKey: data.stat_key,
      value: data.value,
      unit: data.unit,
      entryDate: data.entry_date,
    },
  });
}
