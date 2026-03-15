import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../lib/programming-access";
import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

type LegacyTrackRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function isMissingColumnError(message: string) {
  return /column\s+programming_tracks\.[a-z_]+\s+does\s+not\s+exist/i.test(message);
}

function withTrackDefaults(row: LegacyTrackRow) {
  return {
    ...row,
    is_private: true,
    number_of_levels: 1,
    hide_workouts_days_prior: 0,
    hide_workouts_hour: 0,
    hide_workouts_minute: 0,
  };
}

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
    .from("programming_tracks")
    .select("id, organization_id, name, code, description, is_active, is_private, number_of_levels, hide_workouts_days_prior, hide_workouts_hour, hide_workouts_minute, created_at, updated_at")
    .order("name", { ascending: true });

  const scoped = organizationId
    ? query.eq("organization_id", organizationId)
    : query.in("organization_id", organizationIds);

  const { data, error: fetchError } = await scoped;

  if (fetchError && isMissingColumnError(fetchError.message)) {
    const legacyQuery = supabaseAdmin
      .from("programming_tracks")
      .select("id, organization_id, name, code, description, is_active, created_at, updated_at")
      .order("name", { ascending: true });

    const legacyScoped = organizationId
      ? legacyQuery.eq("organization_id", organizationId)
      : legacyQuery.in("organization_id", organizationIds);

    const { data: legacyData, error: legacyError } = await legacyScoped;
    if (legacyError) {
      return NextResponse.json({ error: legacyError.message }, { status: 500 });
    }

    return NextResponse.json({ tracks: (legacyData ?? []).map((row) => withTrackDefaults(row as LegacyTrackRow)) });
  }

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: data ?? [] });
}

export async function POST(request: Request) {
  const { error, userId } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : null;
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const isPrivate = typeof body?.isPrivate === "boolean" ? body.isPrivate : true;
  const numberOfLevels = Number.isFinite(Number(body?.numberOfLevels))
    ? Math.min(3, Math.max(1, Math.trunc(Number(body.numberOfLevels))))
    : 1;
  const hideWorkoutsDaysPrior = Number.isFinite(Number(body?.hideWorkoutsDaysPrior))
    ? Math.max(0, Math.trunc(Number(body.hideWorkoutsDaysPrior)))
    : 0;
  const hideWorkoutsHour = Number.isFinite(Number(body?.hideWorkoutsHour))
    ? Math.min(23, Math.max(0, Math.trunc(Number(body.hideWorkoutsHour))))
    : 0;
  const hideWorkoutsMinute = Number.isFinite(Number(body?.hideWorkoutsMinute))
    ? Math.min(59, Math.max(0, Math.trunc(Number(body.hideWorkoutsMinute))))
    : 0;

  if (!organizationId || !name) {
    return NextResponse.json({ error: "Invalid track payload." }, { status: 400 });
  }

  const isMember = await isOrgMember(userId, organizationId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, organizationId, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const insertPayload = {
    organization_id: organizationId,
    name,
    code,
    description,
    is_private: isPrivate,
    number_of_levels: numberOfLevels,
    hide_workouts_days_prior: hideWorkoutsDaysPrior,
    hide_workouts_hour: hideWorkoutsHour,
    hide_workouts_minute: hideWorkoutsMinute,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error: insertError } = await supabaseAdmin
    .from("programming_tracks")
    .insert(insertPayload)
    .select("id, organization_id, name, code, description, is_active, is_private, number_of_levels, hide_workouts_days_prior, hide_workouts_hour, hide_workouts_minute, created_at, updated_at")
    .single();

  if (insertError && isMissingColumnError(insertError.message)) {
    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("programming_tracks")
      .insert({
        organization_id: organizationId,
        name,
        code,
        description,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select("id, organization_id, name, code, description, is_active, created_at, updated_at")
      .single();

    if (legacyError) {
      return NextResponse.json({ error: legacyError.message }, { status: 500 });
    }

    return NextResponse.json({ track: withTrackDefaults(legacyData as LegacyTrackRow) }, { status: 201 });
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ track: data }, { status: 201 });
}
