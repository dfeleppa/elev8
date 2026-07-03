import { NextResponse } from "next/server";

import { hasOrgRole } from "@/lib/programming-access";
import { requireRequestUserContext } from "@/lib/member";
import { isWorkoutBlockType, isWorkoutScoreType, WORKOUT_BLOCK_TYPES, WORKOUT_SCORE_TYPES } from "@/lib/programming";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ programId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { error, userId } = await requireRequestUserContext(request);
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId } = await context.params;

  const { data: program, error: programError } = await supabaseAdmin
    .from("programs")
    .select("duration_weeks")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const canWrite = await hasOrgRole(userId, "", "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const templateDayId = typeof body?.templateDayId === "string" ? body.templateDayId : "";
  const blockType = body?.blockType;
  const scoreType = body?.scoreType;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const blockOrder = Number.isInteger(body?.blockOrder) ? body.blockOrder : 0;
  const movementId = typeof body?.movementId === "string" ? body.movementId : null;
  const leaderboardEnabled = Boolean(body?.leaderboardEnabled);
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string")
    : [];

  if (!templateDayId || !title) {
    return NextResponse.json({ error: "templateDayId and title are required." }, { status: 400 });
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

  // Verify the template day belongs to this program
  const { data: day, error: dayError } = await supabaseAdmin
    .from("program_template_days")
    .select("id")
    .eq("id", templateDayId)
    .eq("program_id", programId)
    .single();

  if (dayError || !day) {
    return NextResponse.json({ error: "Template day not found." }, { status: 404 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("program_template_blocks")
    .insert({
      template_day_id: templateDayId,
      program_id: programId,
      block_order: blockOrder,
      block_type: blockType,
      title,
      description,
      score_type: scoreType,
      movement_id: movementId,
      leaderboard_enabled: leaderboardEnabled,
      tags,
      updated_at: new Date().toISOString(),
    })
    .select("id, template_day_id, block_order, block_type, title, description, score_type, movement_id, tags, leaderboard_enabled, created_at, updated_at")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create block." }, { status: 500 });
  }

  return NextResponse.json({ block: data }, { status: 201 });
}
