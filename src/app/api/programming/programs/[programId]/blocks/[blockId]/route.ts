import { NextResponse } from "next/server";

import { hasOrgRole } from "../../../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../../../lib/member";
import { isWorkoutBlockType, isWorkoutScoreType } from "../../../../../../../lib/programming";
import { supabaseAdmin } from "../../../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ programId: string; blockId: string }> };

async function resolveOrgId(programId: string) {
  const { data, error } = await supabaseAdmin
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .single();
  if (error || !data) return null;
  return data.organization_id as string;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId, blockId } = await context.params;

  const orgId = await resolveOrgId(programId);
  if (!orgId) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  const canWrite = await hasOrgRole(userId, orgId, "admin");
  if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body?.description === "string") {
    updates.description = body.description.trim() || null;
  }
  if (isWorkoutBlockType(body?.blockType)) {
    updates.block_type = body.blockType;
  }
  if (isWorkoutScoreType(body?.scoreType)) {
    updates.score_type = body.scoreType;
  }
  if (typeof body?.movementId === "string" || body?.movementId === null) {
    updates.movement_id = body.movementId;
  }
  if (Number.isInteger(body?.blockOrder)) {
    updates.block_order = body.blockOrder;
  }
  if (typeof body?.leaderboardEnabled === "boolean") {
    updates.leaderboard_enabled = body.leaderboardEnabled;
  }
  if (Array.isArray(body?.tags)) {
    updates.tags = body.tags.filter((t: unknown): t is string => typeof t === "string");
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("program_template_blocks")
    .update(updates)
    .eq("id", blockId)
    .eq("program_id", programId)
    .select("id, template_day_id, block_order, block_type, title, description, score_type, movement_id, tags, leaderboard_enabled, created_at, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ block: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId, blockId } = await context.params;

  const orgId = await resolveOrgId(programId);
  if (!orgId) return NextResponse.json({ error: "Program not found." }, { status: 404 });

  const canWrite = await hasOrgRole(userId, orgId, "admin");
  if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: deleteError } = await supabaseAdmin
    .from("program_template_blocks")
    .delete()
    .eq("id", blockId)
    .eq("program_id", programId);

  if (deleteError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
