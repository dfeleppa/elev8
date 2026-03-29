import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ programId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId } = await context.params;

  const { data: program, error: programError } = await supabaseAdmin
    .from("programs")
    .select("id, organization_id, name, description, duration_weeks, days_per_week, status, created_by, created_at, updated_at")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const isMember = await isOrgMember(userId, program.organization_id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all template days with nested blocks
  const { data: days, error: daysError } = await supabaseAdmin
    .from("program_template_days")
    .select(`
      id, program_id, week_number, day_of_week, title, notes, created_at, updated_at,
      program_template_blocks (
        id, template_day_id, block_order, block_type, title, description,
        score_type, movement_id, tags, leaderboard_enabled, created_at, updated_at
      )
    `)
    .eq("program_id", programId)
    .order("week_number", { ascending: true })
    .order("day_of_week", { ascending: true });

  if (daysError) {
    return NextResponse.json({ error: daysError.message }, { status: 500 });
  }

  return NextResponse.json({ program, days: days ?? [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId } = await context.params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const canWrite = await hasOrgRole(userId, existing.organization_id, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body?.description === "string") {
    updates.description = body.description.trim() || null;
  }
  if (Number.isInteger(body?.durationWeeks) && body.durationWeeks >= 1 && body.durationWeeks <= 52) {
    updates.duration_weeks = body.durationWeeks;
  }
  if (Number.isInteger(body?.daysPerWeek) && body.daysPerWeek >= 1 && body.daysPerWeek <= 7) {
    updates.days_per_week = body.daysPerWeek;
  }
  if (["draft", "published", "archived"].includes(body?.status)) {
    updates.status = body.status;
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("programs")
    .update(updates)
    .eq("id", programId)
    .select("id, organization_id, name, description, duration_weeks, days_per_week, status, created_by, created_at, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ program: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId } = await context.params;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const canWrite = await hasOrgRole(userId, existing.organization_id, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("programs")
    .delete()
    .eq("id", programId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
