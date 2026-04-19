import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { isValidDate } from "../../../../lib/programming";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

type LiftSet = { reps: number; weight: number };

function parseSets(value: unknown): LiftSet[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is LiftSet => {
      if (!s || typeof s !== "object") return false;
      const m = s as LiftSet;
      return Number.isFinite(m.reps) && Number.isFinite(m.weight);
    })
    .map((s) => ({ reps: Math.round(Number(s.reps)), weight: Number(s.weight) }))
    .filter((s) => s.reps > 0 && s.weight > 0);
}

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const movementId = typeof body?.movementId === "string" ? body.movementId : "";
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
  const sets = parseSets(body?.sets);

  if (!movementId || !isValidDate(dayDate)) {
    return NextResponse.json(
      { error: "movementId and dayDate are required." },
      { status: 400 }
    );
  }


  const { data: log, error: insertError } = await supabaseAdmin
    .from("athlete_lift_logs")
    .insert({
      member_id: userId,
      movement_id: movementId,
      day_date: dayDate,
      notes,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !log?.id) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create log." },
      { status: 500 }
    );
  }

  if (sets.length > 0) {
    const setRows = sets.map((s, i) => ({
      log_id: log.id,
      set_order: i + 1,
      reps: s.reps,
      weight: s.weight,
      updated_at: new Date().toISOString(),
    }));
    const { error: setError } = await supabaseAdmin
      .from("athlete_lift_log_sets")
      .insert(setRows);
    if (setError) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  }

  return NextResponse.json({ id: log.id }, { status: 201 });
}
