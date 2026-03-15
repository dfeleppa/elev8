import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../../lib/member";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";

export const runtime = "nodejs";

const WEEKDAY_SET = new Set(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);

type Payload = {
  organizationId?: string;
  trackId?: string;
  name?: string;
  time?: string;
  durationMinutes?: number;
  days?: string[];
  startDate?: string;
  endDate?: string | null;
  defaultCoachUserId?: string | null;
  sizeLimit?: number;
  reservationCutoffHours?: number;
  calendarColor?: string;
};

type ScheduleClassRow = {
  id: string;
  track_id: string | null;
  name: string;
  class_time: string;
  duration_minutes: number;
  class_days: string[];
  start_date: string;
  end_date: string | null;
  default_coach_user_id: string | null;
  size_limit: number;
  reservation_cutoff_hours: number;
  calendar_color: string;
  created_at: string;
  updated_at: string;
};

type LegacyScheduleClassRow = {
  id: string;
  name: string;
  class_time: string;
  duration_minutes: number;
  class_days: string[];
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type TrackLookupRow = { id: string; name: string };
type CoachLookupRow = { id: string; full_name: string | null; email: string | null };

function canAccessOrganization(organizationIds: string[], organizationId: string) {
  return organizationIds.includes(organizationId);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isMissingColumnError(message: string) {
  return /column\s+organization_schedule_classes\.[a-z_]+\s+does\s+not\s+exist/i.test(message);
}

function withScheduleDefaults(row: LegacyScheduleClassRow): ScheduleClassRow {
  return {
    ...row,
    track_id: null,
    default_coach_user_id: null,
    size_limit: 0,
    reservation_cutoff_hours: 0,
    calendar_color: "#3B82F6",
  };
}

function normalizeDays(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((day) => WEEKDAY_SET.has(day));

  return Array.from(new Set(normalized));
}

function normalizePayload(payload: Payload) {
  const trackId = String(payload.trackId ?? "").trim();
  const name = String(payload.name ?? "").trim();
  const time = String(payload.time ?? "").trim();
  const durationMinutes = Number(payload.durationMinutes ?? 0);
  const days = normalizeDays(payload.days);
  const startDate = String(payload.startDate ?? "").trim();
  const endDateRaw = typeof payload.endDate === "string" ? payload.endDate.trim() : "";
  const endDate = endDateRaw ? endDateRaw : null;
  const defaultCoachUserId = typeof payload.defaultCoachUserId === "string"
    ? payload.defaultCoachUserId.trim() || null
    : null;
  const sizeLimit = Number(payload.sizeLimit ?? 0);
  const reservationCutoffHours = Number(payload.reservationCutoffHours ?? 0);
  const calendarColor = String(payload.calendarColor ?? "#3B82F6").trim() || "#3B82F6";

  if (!trackId) {
    return { error: "Track is required." } as const;
  }
  if (!name) {
    return { error: "Class name is required." } as const;
  }
  if (!isValidTime(time)) {
    return { error: "Time must be HH:MM (24h)." } as const;
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duration must be greater than 0." } as const;
  }
  if (days.length === 0) {
    return { error: "At least one day is required." } as const;
  }
  if (!isValidDate(startDate)) {
    return { error: "Start date is invalid." } as const;
  }
  if (endDate && !isValidDate(endDate)) {
    return { error: "End date is invalid." } as const;
  }
  if (endDate && endDate < startDate) {
    return { error: "End date must be on or after start date." } as const;
  }
  if (!Number.isFinite(sizeLimit) || sizeLimit < 0) {
    return { error: "Size limit must be 0 or greater." } as const;
  }
  if (!Number.isFinite(reservationCutoffHours) || reservationCutoffHours < 0) {
    return { error: "Reservation cutoff hours must be 0 or greater." } as const;
  }

  return {
    value: {
      track_id: trackId,
      name,
      class_time: time,
      duration_minutes: durationMinutes,
      class_days: days,
      start_date: startDate,
      end_date: endDate,
      default_coach_user_id: defaultCoachUserId,
      size_limit: Math.trunc(sizeLimit),
      reservation_cutoff_hours: Math.trunc(reservationCutoffHours),
      calendar_color: calendarColor,
    },
  } as const;
}

async function withLookups(rows: ScheduleClassRow[]) {
  if (rows.length === 0) {
    return [];
  }

  const trackIds = Array.from(new Set(rows.map((row) => row.track_id).filter(Boolean))) as string[];
  const coachIds = Array.from(new Set(rows.map((row) => row.default_coach_user_id).filter(Boolean))) as string[];

  const { data: trackRows } = trackIds.length > 0
    ? await supabaseAdmin.from("programming_tracks").select("id, name").in("id", trackIds)
    : { data: [] as TrackLookupRow[] };

  const { data: coachRows } = coachIds.length > 0
    ? await supabaseAdmin.from("app_users").select("id, full_name, email").in("id", coachIds)
    : { data: [] as CoachLookupRow[] };

  const trackById = new Map((trackRows ?? []).map((row) => [row.id, row]));
  const coachById = new Map((coachRows ?? []).map((row) => [row.id, row]));

  return rows.map((row) => ({
    ...row,
    track: trackById.get(row.track_id) ?? null,
    default_coach: row.default_coach_user_id ? coachById.get(row.default_coach_user_id) ?? null : null,
  }));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing class id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const organizationId = payload.organizationId?.trim() || organizationIds[0] || null;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  if (!canAccessOrganization(organizationIds, organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalized = normalizePayload(payload);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const { data: trackExists, error: trackError } = await supabaseAdmin
    .from("programming_tracks")
    .select("id")
    .eq("id", normalized.value.track_id)
    .eq("organization_id", organizationId)
    .single();

  if (trackError || !trackExists) {
    return NextResponse.json({ error: "Selected track was not found." }, { status: 400 });
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("organization_schedule_classes")
    .update({
      ...normalized.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id, track_id, name, class_time, duration_minutes, class_days, start_date, end_date, default_coach_user_id, size_limit, reservation_cutoff_hours, calendar_color, created_at, updated_at")
    .single();

  if (updateError && isMissingColumnError(updateError.message)) {
    const { data: legacyData, error: legacyUpdateError } = await supabaseAdmin
      .from("organization_schedule_classes")
      .update({
        name: normalized.value.name,
        class_time: normalized.value.class_time,
        duration_minutes: normalized.value.duration_minutes,
        class_days: normalized.value.class_days,
        start_date: normalized.value.start_date,
        end_date: normalized.value.end_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id, name, class_time, duration_minutes, class_days, start_date, end_date, created_at, updated_at")
      .single();

    if (legacyUpdateError) {
      return NextResponse.json({ error: legacyUpdateError.message }, { status: 500 });
    }

    const [hydratedLegacy] = await withLookups(legacyData ? [withScheduleDefaults(legacyData as LegacyScheduleClassRow)] : []);
    return NextResponse.json({ scheduleClass: hydratedLegacy ?? null });
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const [hydrated] = await withLookups(data ? [data as ScheduleClassRow] : []);
  return NextResponse.json({ scheduleClass: hydrated ?? null });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing class id." }, { status: 400 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  if (!canAccessOrganization(organizationIds, organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("organization_schedule_classes")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
