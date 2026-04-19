import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const { data: gymRow } = await supabaseAdmin
    .from("gym_settings")
    .select("name, logo_url")
    .eq("id", 1)
    .maybeSingle();

  const { data: latestResult } = await supabaseAdmin
    .from("workout_results")
    .select("track_id")
    .eq("member_id", userId)
    .order("day_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
    userName: userRow?.full_name ?? userRow?.email ?? "User",
    gymName: gymRow?.name ?? "Lyfe Fitness",
    gymLogoUrl: gymRow?.logo_url ?? null,
    trackId: latestTrackId,
    currentTrack: trackRow?.name ?? "Main",
  });
}
