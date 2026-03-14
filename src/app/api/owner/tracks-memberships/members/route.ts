import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

type MemberRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  tracks?: string | null;
};

function canAccessOrganization(organizationIds: string[], organizationId: string) {
  return organizationIds.includes(organizationId);
}

function normalizeTrackList(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTrackString(values: string[]) {
  return values.join(", ");
}

async function getOrganizationMembers(organizationId: string) {
  let { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("email, first_name, last_name, tracks")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error && error.message.toLowerCase().includes("organization_id")) {
    const retry = await supabaseAdmin
      .from("organization_members")
      .select("email, first_name, last_name, tracks")
      .order("created_at", { ascending: false });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MemberRow[];
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

  try {
    const rows = await getOrganizationMembers(organizationId);
    return NextResponse.json({
      members: rows
        .map((row) => {
          const email = row.email?.trim().toLowerCase() ?? "";
          if (!email) {
            return null;
          }
          const fullName = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
          return {
            email,
            fullName: fullName || email,
            tracks: normalizeTrackList(row.tracks),
          };
        })
        .filter((row): row is { email: string; fullName: string; tracks: string[] } => Boolean(row)),
    });
  } catch (cause) {
    return NextResponse.json({ error: (cause as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    organizationId?: string;
    email?: string;
    trackName?: string;
    assigned?: boolean;
  } | null;

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

  const email = payload.email?.trim().toLowerCase();
  const trackName = payload.trackName?.trim();
  if (!email || !trackName || typeof payload.assigned !== "boolean") {
    return NextResponse.json({ error: "email, trackName, and assigned are required." }, { status: 400 });
  }

  let { data: existing, error: lookupError } = await supabaseAdmin
    .from("organization_members")
    .select("tracks")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .single();

  if (lookupError && lookupError.message.toLowerCase().includes("organization_id")) {
    const retry = await supabaseAdmin
      .from("organization_members")
      .select("tracks")
      .eq("email", email)
      .single();
    existing = retry.data;
    lookupError = retry.error;
  }

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const current = normalizeTrackList(existing?.tracks ?? null);
  const next = payload.assigned
    ? Array.from(new Set([...current, trackName]))
    : current.filter((name) => name !== trackName);

  let { error: updateError } = await supabaseAdmin
    .from("organization_members")
    .update({ tracks: toTrackString(next), updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("email", email);

  if (updateError && updateError.message.toLowerCase().includes("organization_id")) {
    const retry = await supabaseAdmin
      .from("organization_members")
      .update({ tracks: toTrackString(next), updated_at: new Date().toISOString() })
      .eq("email", email);
    updateError = retry.error;
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tracks: next });
}
