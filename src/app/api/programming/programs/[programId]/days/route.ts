import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../../lib/member";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ programId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { programId } = await context.params;
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const weekNumber = weekParam ? parseInt(weekParam, 10) : null;

  const { data: program, error: programError } = await supabaseAdmin
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const isMember = await isOrgMember(userId, program.organization_id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabaseAdmin
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

  if (weekNumber && Number.isInteger(weekNumber) && weekNumber >= 1) {
    query = query.eq("week_number", weekNumber) as typeof query;
  }

  const { data, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ days: data ?? [] });
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
  const weekNumber = Number.isInteger(body?.weekNumber) ? body.weekNumber : 0;
  const dayOfWeek = Number.isInteger(body?.dayOfWeek) ? body.dayOfWeek : 0;
  const title = typeof body?.title === "string" ? body.title.trim() || null : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (weekNumber < 1 || dayOfWeek < 1 || dayOfWeek > 7) {
    return NextResponse.json({ error: "weekNumber (>=1) and dayOfWeek (1-7) are required." }, { status: 400 });
  }

  const { data, error: upsertError } = await supabaseAdmin
    .from("program_template_days")
    .upsert(
      {
        program_id: programId,
        organization_id: program.organization_id,
        week_number: weekNumber,
        day_of_week: dayOfWeek,
        title,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "program_id,week_number,day_of_week" }
    )
    .select("id, program_id, week_number, day_of_week, title, notes, created_at, updated_at")
    .single();

  if (upsertError || !data) {
    return NextResponse.json({ error: upsertError?.message ?? "Failed to upsert day." }, { status: 500 });
  }

  return NextResponse.json({ day: data }, { status: 201 });
}
