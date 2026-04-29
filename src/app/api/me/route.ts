import { NextResponse } from "next/server";

import { requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  // These three queries are independent — fan them out in parallel.
  const [{ data: userRow }, { data: gymRow }, { data: latestResult }] = await Promise.all([
    supabaseAdmin
      .from("app_users")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("gym_settings")
      .select("name")
      .eq("id", 1)
      .maybeSingle(),
    supabaseAdmin
      .from("workout_results")
      .select("track_id")
      .eq("member_id", userId)
      .order("day_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
    trackId: latestTrackId,
    currentTrack: trackRow?.name ?? "Main",
  });
}
