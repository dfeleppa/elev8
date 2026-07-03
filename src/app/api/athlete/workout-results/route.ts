import { NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

type WorkoutBlockJoin = {
  title: string | null;
  block_type: string | null;
  movement_library: { name: string | null } | Array<{ name: string | null }> | null;
};

type WorkoutResultRow = {
  id: string;
  day_date: string | null;
  score_type: string | null;
  score_text: string | null;
  total_reps: number | null;
  notes: string | null;
  workout_blocks: WorkoutBlockJoin | WorkoutBlockJoin[] | null;
};

function resolveBlock(raw: WorkoutBlockJoin | WorkoutBlockJoin[] | null) {
  const block = Array.isArray(raw) ? raw[0] : raw;
  if (!block) return { blockTitle: null, movementName: null, blockType: null };
  const movement = Array.isArray(block.movement_library)
    ? block.movement_library[0]
    : block.movement_library;
  return {
    blockTitle: block.title ?? null,
    movementName: movement?.name ?? null,
    blockType: block.block_type ?? null,
  };
}

export async function GET(request: Request) {
  const { error, role, userId } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error: queryError } = await supabaseAdmin
    .from("workout_results")
    .select(
      "id, day_date, score_type, score_text, total_reps, notes, workout_blocks(title, block_type, movement_library(name))",
      { count: "exact" }
    )
    .eq("member_id", userId)
    .order("day_date", { ascending: false })
    .range(from, to);

  if (queryError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const results = (data ?? []).map((row) => {
    const r = row as unknown as WorkoutResultRow;
    const { blockTitle, movementName, blockType } = resolveBlock(r.workout_blocks);
    return {
      id: r.id,
      day_date: r.day_date,
      score_type: r.score_type,
      score_text: r.score_text,
      total_reps: r.total_reps,
      notes: r.notes,
      blockTitle,
      movementName,
      blockType,
    };
  });

  return NextResponse.json({ results, totalCount, page, totalPages });
}
