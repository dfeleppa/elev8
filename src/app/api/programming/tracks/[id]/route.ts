import { NextResponse } from "next/server";

import { hasOrgRole, isOrgMember } from "../../../../../lib/programming-access";
import { requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

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

type TrackUpdatePayload = {
  organizationId?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  isActive?: boolean;
  isPrivate?: boolean;
  numberOfLevels?: number;
  hideWorkoutsDaysPrior?: number;
  hideWorkoutsHour?: number;
  hideWorkoutsMinute?: number;
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
    return NextResponse.json({ error: "Track id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as TrackUpdatePayload | null;
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
  }

  const isMember = await isOrgMember(userId, organizationId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canWrite = await hasOrgRole(userId, organizationId, "admin");
  if (!canWrite) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextName = typeof body?.name === "string" ? body.name.trim() : "";
  if (!nextName) {
    return NextResponse.json({ error: "Track name is required." }, { status: 400 });
  }

  const payload = {
    name: nextName,
    code: typeof body?.code === "string" ? body.code.trim() || null : null,
    description: typeof body?.description === "string" ? body.description.trim() || null : null,
    is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
    is_private: typeof body?.isPrivate === "boolean" ? body.isPrivate : true,
    number_of_levels: Number.isFinite(Number(body?.numberOfLevels))
      ? Math.min(3, Math.max(1, Math.trunc(Number(body?.numberOfLevels))))
      : 1,
    hide_workouts_days_prior: Number.isFinite(Number(body?.hideWorkoutsDaysPrior))
      ? Math.max(0, Math.trunc(Number(body?.hideWorkoutsDaysPrior)))
      : 0,
    hide_workouts_hour: Number.isFinite(Number(body?.hideWorkoutsHour))
      ? Math.min(23, Math.max(0, Math.trunc(Number(body?.hideWorkoutsHour))))
      : 0,
    hide_workouts_minute: Number.isFinite(Number(body?.hideWorkoutsMinute))
      ? Math.min(59, Math.max(0, Math.trunc(Number(body?.hideWorkoutsMinute))))
      : 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error: updateError } = await supabaseAdmin
    .from("programming_tracks")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id, organization_id, name, code, description, is_active, is_private, number_of_levels, hide_workouts_days_prior, hide_workouts_hour, hide_workouts_minute, created_at, updated_at")
    .single();

  if (updateError && isMissingColumnError(updateError.message)) {
    const legacyPayload = {
      name: nextName,
      code: typeof body?.code === "string" ? body.code.trim() || null : null,
      description: typeof body?.description === "string" ? body.description.trim() || null : null,
      is_active: typeof body?.isActive === "boolean" ? body.isActive : true,
      updated_at: new Date().toISOString(),
    };

    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("programming_tracks")
      .update(legacyPayload)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id, organization_id, name, code, description, is_active, created_at, updated_at")
      .single();

    if (legacyError) {
      return NextResponse.json({ error: legacyError.message }, { status: 500 });
    }

    return NextResponse.json({ track: withTrackDefaults(legacyData as LegacyTrackRow) });
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ track: data });
}
