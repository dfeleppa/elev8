import { NextResponse } from "next/server";

import { hasOrgRole } from "../../../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../../../lib/member";
import { supabaseAdmin } from "../../../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ programId: string; assignmentId: string }> };

async function resolveAssignment(programId: string, assignmentId: string) {
  const { data, error } = await supabaseAdmin
    .from("program_assignments")
    .select("id, assigned_member_id")
    .eq("id", assignmentId)
    .eq("program_id", programId)
    .single();
  if (error || !data) return null;
  return data as { id: string; assigned_member_id: string | null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId, assignmentId } = await context.params;

  const assignment = await resolveAssignment(programId, assignmentId);
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  const canWrite = await hasOrgRole(userId, "", "admin");
  if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
    updates.start_date = body.startDate;
  }
  if (typeof body?.isActive === "boolean") {
    updates.is_active = body.isActive;
  }
  if (typeof body?.notes === "string") {
    updates.notes = body.notes.trim() || null;
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("program_assignments")
    .update(updates)
    .eq("id", assignmentId)
    .select("id, program_id, assigned_member_id, assigned_track_id, start_date, is_active, notes, created_at, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ assignment: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId, assignmentId } = await context.params;

  const assignment = await resolveAssignment(programId, assignmentId);
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  const canWrite = await hasOrgRole(userId, "", "admin");
  if (!canWrite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: deleteError } = await supabaseAdmin
    .from("program_assignments")
    .delete()
    .eq("id", assignmentId);

  if (deleteError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
