import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

type BlockJoin = {
  title: string | null;
  block_type: string | null;
  movement_id: string | null;
};

type LiftSetJoin = {
  set_order: number | null;
  reps: number | null;
  weight: number | null;
};

type ResultRow = {
  id: string;
  day_date: string | null;
  score_type: string | null;
  score_text: string | null;
  score_value: number | null;
  total_reps: number | null;
  notes: string | null;
  workout_blocks: BlockJoin | BlockJoin[] | null;
  workout_result_lift_sets: LiftSetJoin[] | null;
};

type MovementBlockJoin = {
  movement_id: string | null;
  movement_library: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

type MovementRow = {
  workout_blocks: MovementBlockJoin | MovementBlockJoin[] | null;
};

function resolveBlock(raw: BlockJoin | BlockJoin[] | null): BlockJoin | null {
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function GET(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const movementId = searchParams.get("movementId");

  if (movementId) {
    const [workoutRes, liftLogRes] = await Promise.all([
      supabaseAdmin
        .from("workout_results")
        .select(
          "id, day_date, score_type, score_text, score_value, total_reps, notes, workout_blocks!inner(title, block_type, movement_id), workout_result_lift_sets(set_order, reps, weight)"
        )
        .eq("member_id", userId)
        .eq("workout_blocks.movement_id", movementId)
        .order("day_date", { ascending: false }),
      supabaseAdmin
        .from("athlete_lift_logs")
        .select("id, day_date, notes, athlete_lift_log_sets(set_order, reps, weight)")
        .eq("member_id", userId)
        .eq("movement_id", movementId)
        .order("day_date", { ascending: false }),
    ]);

    if (workoutRes.error) {
      return NextResponse.json({ error: workoutRes.error.message }, { status: 500 });
    }

    const workoutResults = (workoutRes.data ?? []).map((row) => {
      const r = row as unknown as ResultRow;
      const block = resolveBlock(r.workout_blocks);
      const sets = (Array.isArray(r.workout_result_lift_sets) ? r.workout_result_lift_sets : [])
        .filter((s) => s.weight !== null || s.reps !== null)
        .sort((a, b) => (a.set_order ?? 0) - (b.set_order ?? 0));
      return {
        id: r.id,
        day_date: r.day_date,
        score_type: r.score_type,
        score_text: r.score_text,
        score_value: r.score_value,
        total_reps: r.total_reps,
        notes: r.notes,
        blockTitle: block?.title ?? null,
        blockType: block?.block_type ?? null,
        sets,
      };
    });

    type LiftLogRow = {
      id: string;
      day_date: string | null;
      notes: string | null;
      athlete_lift_log_sets: { set_order: number | null; reps: number | null; weight: number | null }[] | null;
    };

    const liftLogResults = (liftLogRes.data ?? []).map((row) => {
      const r = row as unknown as LiftLogRow;
      const sets = (Array.isArray(r.athlete_lift_log_sets) ? r.athlete_lift_log_sets : [])
        .filter((s) => s.weight !== null || s.reps !== null)
        .sort((a, b) => (a.set_order ?? 0) - (b.set_order ?? 0));
      return {
        id: r.id,
        day_date: r.day_date,
        score_type: null,
        score_text: null,
        score_value: null,
        total_reps: null,
        notes: r.notes,
        blockTitle: "Manual Log",
        blockType: "lift" as const,
        sets,
      };
    });

    const results = [...workoutResults, ...liftLogResults].sort((a, b) => {
      if (!a.day_date) return 1;
      if (!b.day_date) return -1;
      return b.day_date.localeCompare(a.day_date);
    });

    return NextResponse.json({ results });
  }

  // Return all movements that have results for this user
  const { data, error: queryError } = await supabaseAdmin
    .from("workout_results")
    .select("workout_blocks!inner(movement_id, movement_library!inner(id, name))")
    .eq("member_id", userId);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const movementMap = new Map<string, string>();

  for (const row of (data ?? []) as unknown as MovementRow[]) {
    const block = Array.isArray(row.workout_blocks)
      ? row.workout_blocks[0]
      : row.workout_blocks;
    if (!block?.movement_id) continue;
    const lib = Array.isArray(block.movement_library)
      ? block.movement_library[0]
      : block.movement_library;
    if (!lib?.name) continue;
    movementMap.set(block.movement_id, lib.name);
  }

  const movements = Array.from(movementMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ movements });
}
