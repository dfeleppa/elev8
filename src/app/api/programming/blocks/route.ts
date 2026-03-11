import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../lib/programming-access";
import {
  isValidDate,
  isWorkoutBlockType,
  isWorkoutScoreType,
  WORKOUT_BLOCK_TYPES,
  WORKOUT_SCORE_TYPES,
} from "../../../../lib/programming";
import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

type LevelInput = {
  level: number;
  title?: string;
  instructions?: string;
};

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const trackId = typeof body?.trackId === "string" ? body.trackId : "";
  const dayDate = typeof body?.dayDate === "string" ? body.dayDate : "";
  const blockType = body?.blockType;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const scoreType = body?.scoreType;
  const blockOrder = Number.isInteger(body?.blockOrder) ? body.blockOrder : 0;
  const leaderboardEnabled = Boolean(body?.leaderboardEnabled);
  const benchmarkEnabled = Boolean(body?.benchmarkEnabled);
  const benchmarkId = typeof body?.benchmarkId === "string" ? body.benchmarkId : null;
  const movementId = typeof body?.movementId === "string" ? body.movementId : null;
  const percentPrescription =
    typeof body?.percentPrescription === "number" ? body.percentPrescription : null;
  const rounds = typeof body?.rounds === "number" ? body.rounds : null;
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string")
    : [];
  const levels = Array.isArray(body?.levels)
    ? body.levels.filter(
        (level: unknown): level is LevelInput =>
          typeof level === "object" && level !== null && Number.isInteger((level as LevelInput).level)
      )
    : [];

  if (!organizationId || !trackId || !isValidDate(dayDate) || !title) {
    return NextResponse.json({ error: "Invalid workout block payload." }, { status: 400 });
  }

  if (!isWorkoutBlockType(blockType)) {
    return NextResponse.json(
      { error: `blockType must be one of: ${WORKOUT_BLOCK_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }

  if (!isWorkoutScoreType(scoreType)) {
    return NextResponse.json(
      { error: `scoreType must be one of: ${WORKOUT_SCORE_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }

  const isMember = await isOrgMember(userId, organizationId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, organizationId, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if ((blockType === "warmup" || blockType === "cooldown") && (leaderboardEnabled || benchmarkEnabled)) {
    return NextResponse.json(
      { error: "Warmup and cooldown blocks cannot enable leaderboards or benchmarks." },
      { status: 400 }
    );
  }

  const { data: dayRow, error: dayError } = await supabaseAdmin
    .from("programming_days")
    .upsert(
      {
        organization_id: organizationId,
        track_id: trackId,
        day_date: dayDate,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "track_id,day_date" }
    )
    .select("id")
    .single();

  if (dayError || !dayRow?.id) {
    return NextResponse.json({ error: dayError?.message ?? "Failed to create program day." }, { status: 500 });
  }

  const { data: blockRow, error: blockError } = await supabaseAdmin
    .from("workout_blocks")
    .insert({
      programming_day_id: dayRow.id,
      organization_id: organizationId,
      track_id: trackId,
      block_order: blockOrder,
      block_type: blockType,
      title,
      description,
      score_type: scoreType,
      leaderboard_enabled: leaderboardEnabled,
      benchmark_enabled: benchmarkEnabled,
      benchmark_id: benchmarkId,
      movement_id: movementId,
      percent_prescription: percentPrescription,
      rounds,
      tags,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, programming_day_id, block_order, block_type, title, description, score_type, leaderboard_enabled, benchmark_enabled, benchmark_id, movement_id, percent_prescription, rounds, tags")
    .single();

  if (blockError || !blockRow?.id) {
    return NextResponse.json({ error: blockError?.message ?? "Failed to create workout block." }, { status: 500 });
  }

  if (levels.length > 0) {
    const levelRows = levels
      .filter((level: LevelInput) => level.level >= 1 && level.level <= 3)
      .map((level: LevelInput) => ({
        block_id: blockRow.id,
        level: level.level,
        title: typeof level.title === "string" ? level.title.trim() : null,
        instructions: typeof level.instructions === "string" ? level.instructions.trim() : null,
        updated_at: new Date().toISOString(),
      }));

    if (levelRows.length > 0) {
      const { error: levelError } = await supabaseAdmin.from("workout_block_levels").insert(levelRows);
      if (levelError) {
        return NextResponse.json({ error: levelError.message }, { status: 500 });
      }
    }
  }

  const { data: levelsData, error: levelsError } = await supabaseAdmin
    .from("workout_block_levels")
    .select("id, block_id, level, title, instructions")
    .eq("block_id", blockRow.id)
    .order("level", { ascending: true });

  if (levelsError) {
    return NextResponse.json({ error: levelsError.message }, { status: 500 });
  }

  return NextResponse.json({ block: { ...blockRow, levels: levelsData ?? [] } }, { status: 201 });
}
