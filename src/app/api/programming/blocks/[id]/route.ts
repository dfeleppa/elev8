import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../../lib/programming-access";
import {
  isWorkoutBlockType,
  isWorkoutScoreType,
  WORKOUT_BLOCK_TYPES,
  WORKOUT_SCORE_TYPES,
} from "../../../../../lib/programming";
import { requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type LevelInput = {
  level: number;
  title?: string;
  instructions?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing block id." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("workout_blocks")
    .select("id, organization_id, block_type")
    .eq("id", id)
    .single();

  if (existingError || !existing?.id) {
    return NextResponse.json({ error: existingError?.message ?? "Block not found." }, { status: 404 });
  }

  const isMember = await isOrgMember(userId, existing.organization_id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, existing.organization_id, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const blockType = body?.blockType;
  const scoreType = body?.scoreType;

  if (blockType !== undefined && !isWorkoutBlockType(blockType)) {
    return NextResponse.json(
      { error: `blockType must be one of: ${WORKOUT_BLOCK_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }

  if (scoreType !== undefined && !isWorkoutScoreType(scoreType)) {
    return NextResponse.json(
      { error: `scoreType must be one of: ${WORKOUT_SCORE_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }

  const nextBlockType = (blockType ?? existing.block_type) as string;
  const nextLeaderboardEnabled =
    body?.leaderboardEnabled !== undefined ? Boolean(body.leaderboardEnabled) : undefined;
  const nextBenchmarkEnabled =
    body?.benchmarkEnabled !== undefined ? Boolean(body.benchmarkEnabled) : undefined;

  if (
    (nextBlockType === "warmup" || nextBlockType === "cooldown") &&
    (nextLeaderboardEnabled || nextBenchmarkEnabled)
  ) {
    return NextResponse.json(
      { error: "Warmup and cooldown blocks cannot enable leaderboards or benchmarks." },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body?.blockOrder === "number") patch.block_order = body.blockOrder;
  if (typeof blockType === "string") patch.block_type = blockType;
  if (typeof body?.title === "string") patch.title = body.title.trim();
  if (typeof body?.description === "string") patch.description = body.description.trim();
  if (typeof scoreType === "string") patch.score_type = scoreType;
  if (typeof body?.leaderboardEnabled === "boolean") patch.leaderboard_enabled = body.leaderboardEnabled;
  if (typeof body?.benchmarkEnabled === "boolean") patch.benchmark_enabled = body.benchmarkEnabled;
  if (body?.benchmarkId !== undefined) patch.benchmark_id = body.benchmarkId || null;
  if (body?.movementId !== undefined) patch.movement_id = body.movementId || null;
  if (body?.percentPrescription !== undefined) patch.percent_prescription = body.percentPrescription;
  if (body?.rounds !== undefined) patch.rounds = body.rounds;
  if (Array.isArray(body?.tags)) patch.tags = body.tags.filter((tag: unknown) => typeof tag === "string");

  const { data: blockRow, error: patchError } = await supabaseAdmin
    .from("workout_blocks")
    .update(patch)
    .eq("id", id)
    .select("id, programming_day_id, block_order, block_type, title, description, score_type, leaderboard_enabled, benchmark_enabled, benchmark_id, movement_id, percent_prescription, rounds, tags")
    .single();

  if (patchError || !blockRow?.id) {
    return NextResponse.json({ error: patchError?.message ?? "Failed to update block." }, { status: 500 });
  }

  if (Array.isArray(body?.levels)) {
    const levels = body.levels.filter(
      (level: unknown): level is LevelInput =>
        typeof level === "object" && level !== null && Number.isInteger((level as LevelInput).level)
    );

    const { error: deleteError } = await supabaseAdmin
      .from("workout_block_levels")
      .delete()
      .eq("block_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const levelRows = levels
      .filter((level: LevelInput) => level.level >= 1 && level.level <= 3)
      .map((level: LevelInput) => ({
        block_id: id,
        level: level.level,
        title: typeof level.title === "string" ? level.title.trim() : null,
        instructions: typeof level.instructions === "string" ? level.instructions.trim() : null,
        updated_at: new Date().toISOString(),
      }));

    if (levelRows.length > 0) {
      const { error: insertLevelsError } = await supabaseAdmin
        .from("workout_block_levels")
        .insert(levelRows);
      if (insertLevelsError) {
        return NextResponse.json({ error: insertLevelsError.message }, { status: 500 });
      }
    }
  }

  const { data: levelsData, error: levelsError } = await supabaseAdmin
    .from("workout_block_levels")
    .select("id, block_id, level, title, instructions")
    .eq("block_id", id)
    .order("level", { ascending: true });

  if (levelsError) {
    return NextResponse.json({ error: levelsError.message }, { status: 500 });
  }

  return NextResponse.json({ block: { ...blockRow, levels: levelsData ?? [] } });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing block id." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("workout_blocks")
    .select("id, organization_id")
    .eq("id", id)
    .single();

  if (existingError || !existing?.id) {
    return NextResponse.json({ error: existingError?.message ?? "Block not found." }, { status: 404 });
  }

  const canWrite = await hasOrgRole(userId, existing.organization_id, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin.from("workout_blocks").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
