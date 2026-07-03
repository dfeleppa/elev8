import { NextResponse } from "next/server";

import {
  buildDailyScheduleSession,
  classOccursOnDate,
  isValidDateKey,
  toLocalDateString,
  type ReservationRow,
  type ScheduleClassRow,
} from "@/lib/class-schedule";
import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ScheduleClassRecord = ScheduleClassRow & {
  track_id: string | null;
  default_coach_user_id: string | null;
};

export async function GET(request: Request) {
  const { error, userId, role } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateKey = searchParams.get("date") ?? toLocalDateString(new Date());

  if (!isValidDateKey(dateKey)) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }

  const { data: classes, error: classesError } = await supabaseAdmin
    .from("schedule_classes")
    .select(
      "id, name, class_time, duration_minutes, class_days, start_date, end_date, track_id, default_coach_user_id, size_limit, reservation_cutoff_hours, calendar_color"
    )
    .order("class_time", { ascending: true });

  if (classesError) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const recurringClasses = ((classes ?? []) as ScheduleClassRecord[]).filter((row) => classOccursOnDate(row, dateKey));

  const rawTrackIds = [...new Set((classes ?? []).map((row) => row.track_id).filter(Boolean) as string[])];
  const rawCoachIds = [...new Set((classes ?? []).map((row) => row.default_coach_user_id).filter(Boolean) as string[])];

  const [tracksResult, coachesResult, reservationsResult] = await Promise.all([
    rawTrackIds.length
      ? supabaseAdmin.from("programming_tracks").select("id, name").in("id", rawTrackIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    rawCoachIds.length
      ? supabaseAdmin.from("app_users").select("id, full_name, email").in("id", rawCoachIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    recurringClasses.length
      ? supabaseAdmin
        .from("class_reservations")
        .select("id, class_id, member_id, class_date, created_at")
        .eq("class_date", dateKey)
        .in("class_id", recurringClasses.map((row) => row.id))
      : Promise.resolve({ data: [] as ReservationRow[], error: null }),
  ]);

  if (reservationsResult.error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const memberIds = [...new Set((reservationsResult.data ?? []).map((row) => row.member_id).filter(Boolean))];
  const reservedMembersResult = memberIds.length
    ? await supabaseAdmin.from("app_users").select("id, full_name, email").in("id", memberIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[], error: null };

  if (reservedMembersResult.error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const trackMap = new Map((tracksResult.data ?? []).map((track) => [track.id, track]));
  const coachMap = new Map((coachesResult.data ?? []).map((coach) => [coach.id, coach]));
  const memberNameMap = new Map(
    (reservedMembersResult.data ?? []).map((user) => [user.id, user.full_name ?? user.email ?? "Athlete"])
  );

  const reservationsByClassId = new Map<string, ReservationRow[]>();
  for (const reservation of (reservationsResult.data ?? []) as ReservationRow[]) {
    const group = reservationsByClassId.get(reservation.class_id) ?? [];
    group.push(reservation);
    reservationsByClassId.set(reservation.class_id, group);
  }

  const sessions = recurringClasses
    .map((row) => {
      const scheduleClass: ScheduleClassRow = {
        ...row,
        track: row.track_id ? (trackMap.get(row.track_id) ?? null) : null,
        default_coach: row.default_coach_user_id ? (coachMap.get(row.default_coach_user_id) ?? null) : null,
      };

      return buildDailyScheduleSession({
        scheduleClass,
        dateKey,
        reservations: reservationsByClassId.get(row.id) ?? [],
        currentUserId: userId,
        memberNameMap,
      });
    })
    .sort((a, b) => a.class_time.localeCompare(b.class_time));

  return NextResponse.json({
    date: dateKey,
    sessions,
  });
}
