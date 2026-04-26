import { NextResponse } from "next/server";

import {
  buildDailyScheduleSession,
  classOccursOnDate,
  isReservationClosed,
  isValidDateKey,
  type ReservationRow,
  type ScheduleClassRow,
} from "@/lib/class-schedule";
import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ReservationRequestBody = {
  classId?: string;
  date?: string;
};

type ScheduleClassRecord = ScheduleClassRow & {
  track_id: string | null;
  default_coach_user_id: string | null;
};

async function loadScheduleClass(classId: string) {
  return supabaseAdmin
    .from("schedule_classes")
    .select(
      "id, name, class_time, duration_minutes, class_days, start_date, end_date, track_id, default_coach_user_id, size_limit, reservation_cutoff_hours, calendar_color"
    )
    .eq("id", classId)
    .maybeSingle();
}

async function loadSessionSummary(params: {
  classRow: ScheduleClassRecord;
  dateKey: string;
  currentUserId: string;
}) {
  const { classRow, dateKey, currentUserId } = params;

  const [trackResult, coachResult, reservationsResult] = await Promise.all([
    classRow.track_id
      ? supabaseAdmin.from("programming_tracks").select("id, name").eq("id", classRow.track_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    classRow.default_coach_user_id
      ? supabaseAdmin
        .from("app_users")
        .select("id, full_name, email")
        .eq("id", classRow.default_coach_user_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from("class_reservations")
      .select("id, class_id, member_id, class_date, created_at")
      .eq("class_id", classRow.id)
      .eq("class_date", dateKey),
  ]);

  if (reservationsResult.error) {
    return { error: "Internal server error.", session: null };
  }

  const reservations = (reservationsResult.data ?? []) as ReservationRow[];
  const memberIds = [...new Set(reservations.map((reservation) => reservation.member_id).filter(Boolean))];
  const membersResult = memberIds.length
    ? await supabaseAdmin.from("app_users").select("id, full_name, email").in("id", memberIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[], error: null };

  if (membersResult.error) {
    return { error: "Internal server error.", session: null };
  }

  const memberNameMap = new Map(
    (membersResult.data ?? []).map((user) => [user.id, user.full_name ?? user.email ?? "Athlete"])
  );

  const session = buildDailyScheduleSession({
    scheduleClass: {
      ...classRow,
      track: trackResult.data ?? null,
      default_coach: coachResult.data ?? null,
    },
    dateKey,
    reservations,
    currentUserId,
    memberNameMap,
  });

  return { error: null, session };
}

async function parseReservationRequest(request: Request) {
  const body = (await request.json().catch(() => null)) as ReservationRequestBody | null;
  const classId = body?.classId?.trim() ?? "";
  const dateKey = body?.date?.trim() ?? "";

  if (!classId || !isValidDateKey(dateKey)) {
    return { error: "classId and date are required.", classId: "", dateKey: "" };
  }

  return { error: null, classId, dateKey };
}

export async function POST(request: Request) {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 });
  }

  const parsed = await parseReservationRequest(request);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { classId, dateKey } = parsed;
  const classResult = await loadScheduleClass(classId);
  if (classResult.error || !classResult.data) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const classRow = classResult.data as ScheduleClassRecord;
  if (!classOccursOnDate(classRow, dateKey)) {
    return NextResponse.json({ error: "This class does not occur on the selected date." }, { status: 400 });
  }

  if (isReservationClosed(classRow, dateKey)) {
    return NextResponse.json({ error: "Reservations are closed for this class." }, { status: 409 });
  }

  // Fetch all current reservations once; derive both "user already reserved"
  // and "class full" from the same row set instead of round-tripping twice.
  const reservationsResult = await supabaseAdmin
    .from("class_reservations")
    .select("id, member_id")
    .eq("class_id", classId)
    .eq("class_date", dateKey);

  if (reservationsResult.error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  const currentReservations = reservationsResult.data ?? [];
  if (currentReservations.some((r) => r.member_id === userId)) {
    return NextResponse.json({ error: "You already reserved a spot for this class." }, { status: 409 });
  }

  if (classRow.size_limit > 0 && currentReservations.length >= classRow.size_limit) {
    return NextResponse.json({ error: "This class is already full." }, { status: 409 });
  }

  const insertResult = await supabaseAdmin
    .from("class_reservations")
    .insert({
      class_id: classId,
      member_id: userId,
      class_date: dateKey,
    });

  if (insertResult.error) {
    const message = insertResult.error.message.toLowerCase().includes("duplicate")
      ? "You already reserved a spot for this class."
      : "Failed to reserve your spot.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const summary = await loadSessionSummary({
    classRow,
    dateKey,
    currentUserId: userId,
  });

  if (summary.error || !summary.session) {
    return NextResponse.json({ error: summary.error ?? "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ session: summary.session });
}

export async function DELETE(request: Request) {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId || !hasRole("member", role)) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 });
  }

  const parsed = await parseReservationRequest(request);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { classId, dateKey } = parsed;
  const classResult = await loadScheduleClass(classId);
  if (classResult.error || !classResult.data) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const deleteResult = await supabaseAdmin
    .from("class_reservations")
    .delete()
    .eq("class_id", classId)
    .eq("class_date", dateKey)
    .eq("member_id", userId);

  if (deleteResult.error) {
    return NextResponse.json({ error: "Failed to cancel reservation." }, { status: 500 });
  }

  const summary = await loadSessionSummary({
    classRow: classResult.data as ScheduleClassRecord,
    dateKey,
    currentUserId: userId,
  });

  if (summary.error || !summary.session) {
    return NextResponse.json({ error: summary.error ?? "Internal server error." }, { status: 500 });
  }

  return NextResponse.json({ session: summary.session });
}
