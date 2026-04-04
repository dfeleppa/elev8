import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error, userId, role, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") ?? organizationIds[0] ?? null;

  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 403 });
  }

  const { data: classes, error: classesError } = await supabaseAdmin
    .from("organization_schedule_classes")
    .select(
      "id, name, class_time, duration_minutes, class_days, start_date, end_date, track_id, default_coach_user_id, size_limit, reservation_cutoff_hours, calendar_color"
    )
    .eq("organization_id", organizationId)
    .order("class_time", { ascending: true });

  if (classesError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const rows = classes ?? [];

  // Gather unique track and coach IDs to batch-fetch
  const trackIds = [...new Set(rows.map((c) => c.track_id).filter(Boolean) as string[])];
  const coachIds = [...new Set(rows.map((c) => c.default_coach_user_id).filter(Boolean) as string[])];

  const [tracksResult, coachesResult] = await Promise.all([
    trackIds.length
      ? supabaseAdmin.from("programming_tracks").select("id, name").in("id", trackIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    coachIds.length
      ? supabaseAdmin.from("app_users").select("id, full_name, email").in("id", coachIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);

  const trackMap = new Map((tracksResult.data ?? []).map((t) => [t.id, t]));
  const coachMap = new Map((coachesResult.data ?? []).map((c) => [c.id, c]));

  const enriched = rows.map((c) => ({
    ...c,
    track: c.track_id ? (trackMap.get(c.track_id) ?? null) : null,
    default_coach: c.default_coach_user_id ? (coachMap.get(c.default_coach_user_id) ?? null) : null,
  }));

  return NextResponse.json({ classes: enriched });
}
