import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../../lib/member";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";

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
    .select("organization_id")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const canRead = await hasOrgRole(userId, program.organization_id, "coach");
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from("program_assignments")
    .select(`
      id, program_id, organization_id, assigned_member_id, assigned_track_id,
      start_date, is_active, notes, created_by, created_at, updated_at,
      app_users!program_assignments_assigned_member_id_fkey (id, first_name, last_name, email),
      programming_tracks!program_assignments_assigned_track_id_fkey (id, name)
    `)
    .eq("program_id", programId)
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ assignments: data ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId } = await context.params;

  const { data: program, error: programError } = await supabaseAdmin
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const canWrite = await hasOrgRole(userId, program.organization_id, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const assignedMemberId = typeof body?.assignedMemberId === "string" ? body.assignedMemberId : null;
  const assignedTrackId = typeof body?.assignedTrackId === "string" ? body.assignedTrackId : null;
  const startDate = typeof body?.startDate === "string" ? body.startDate : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "startDate (YYYY-MM-DD) is required." }, { status: 400 });
  }

  if ((!assignedMemberId && !assignedTrackId) || (assignedMemberId && assignedTrackId)) {
    return NextResponse.json(
      { error: "Exactly one of assignedMemberId or assignedTrackId is required." },
      { status: 400 }
    );
  }

  // Verify the assignee belongs to this org
  if (assignedMemberId) {
    const memberInOrg = await isOrgMember(assignedMemberId, program.organization_id);
    if (!memberInOrg) {
      return NextResponse.json({ error: "Member not found in this organization." }, { status: 400 });
    }
  }

  if (assignedTrackId) {
    const { data: track } = await supabaseAdmin
      .from("programming_tracks")
      .select("id")
      .eq("id", assignedTrackId)
      .eq("organization_id", program.organization_id)
      .single();
    if (!track) {
      return NextResponse.json({ error: "Track not found in this organization." }, { status: 400 });
    }
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("program_assignments")
    .insert({
      program_id: programId,
      organization_id: program.organization_id,
      assigned_member_id: assignedMemberId,
      assigned_track_id: assignedTrackId,
      start_date: startDate,
      notes,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, program_id, organization_id, assigned_member_id, assigned_track_id, start_date, is_active, notes, created_by, created_at, updated_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ assignment: data }, { status: 201 });
}
