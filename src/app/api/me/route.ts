import { NextResponse } from "next/server";

import { requireUserContext } from "../../../lib/member";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const { error, userId, role, organizationIds } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const organizationId = organizationIds[0] ?? null;

  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const { data: organizationRow } = organizationId
    ? await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle()
    : { data: null };

  const { data: latestResult } = organizationId
    ? await supabaseAdmin
        .from("workout_results")
        .select("track_id")
        .eq("organization_id", organizationId)
        .eq("member_id", userId)
        .order("day_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const latestTrackId =
    latestResult && typeof latestResult.track_id === "string" ? latestResult.track_id : null;

  const { data: trackRow } = latestTrackId
    ? await supabaseAdmin
        .from("programming_tracks")
        .select("name")
        .eq("id", latestTrackId)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    userId,
    role,
    organizationIds,
    userName: userRow?.full_name ?? userRow?.email ?? "User",
    organizationName: organizationRow?.name ?? "Organization",
    currentTrack: trackRow?.name ?? "Main",
  });
}
