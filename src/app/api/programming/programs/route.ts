import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../lib/programming-access";
import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId, organizationIds } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");

  if (organizationId && !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = supabaseAdmin
    .from("programs")
    .select("id, organization_id, name, description, duration_weeks, days_per_week, status, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  const scoped = organizationId
    ? query.eq("organization_id", organizationId)
    : query.in("organization_id", organizationIds);

  const { data, error: fetchError } = await scoped;

  if (fetchError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ programs: data ?? [] });
}

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const durationWeeks = Number.isInteger(body?.durationWeeks) ? body.durationWeeks : 0;
  const daysPerWeek = Number.isInteger(body?.daysPerWeek) ? body.daysPerWeek : 5;

  if (!organizationId || !name) {
    return NextResponse.json({ error: "organizationId and name are required." }, { status: 400 });
  }

  if (durationWeeks < 1 || durationWeeks > 52) {
    return NextResponse.json({ error: "durationWeeks must be between 1 and 52." }, { status: 400 });
  }

  if (daysPerWeek < 1 || daysPerWeek > 7) {
    return NextResponse.json({ error: "daysPerWeek must be between 1 and 7." }, { status: 400 });
  }

  const isMember = await isOrgMember(userId, organizationId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, organizationId, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("programs")
    .insert({
      organization_id: organizationId,
      name,
      description,
      duration_weeks: durationWeeks,
      days_per_week: daysPerWeek,
      created_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select("id, organization_id, name, description, duration_weeks, days_per_week, status, created_by, created_at, updated_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ program: data }, { status: 201 });
}
