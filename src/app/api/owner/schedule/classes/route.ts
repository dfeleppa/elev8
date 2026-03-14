import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";

const WEEKDAY_SET = new Set(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);

type Payload = {
  organizationId?: string;
  name?: string;
  time?: string;
  durationMinutes?: number;
  days?: string[];
  startDate?: string;
};

function canAccessOrganization(organizationIds: string[], organizationId: string) {
  return organizationIds.includes(organizationId);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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
  const name = String(payload.name ?? "").trim();
  const time = String(payload.time ?? "").trim();
  const durationMinutes = Number(payload.durationMinutes ?? 0);
  const days = normalizeDays(payload.days);
  const startDate = String(payload.startDate ?? "").trim();

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

  return {
    value: {
      name,
      class_time: time,
      duration_minutes: durationMinutes,
      class_days: days,
      start_date: startDate,
      end_date: null,
    },
  } as const;
}

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  if (!canAccessOrganization(organizationIds, organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("organization_schedule_classes")
    .select("id, name, class_time, duration_minutes, class_days, start_date, end_date, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: true })
    .order("class_time", { ascending: true });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ organizationId, classes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const { data, error: insertError } = await supabaseAdmin
    .from("organization_schedule_classes")
    .insert({
      organization_id: organizationId,
      ...normalized.value,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, class_time, duration_minutes, class_days, start_date, end_date, created_at, updated_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ scheduleClass: data }, { status: 201 });
}
