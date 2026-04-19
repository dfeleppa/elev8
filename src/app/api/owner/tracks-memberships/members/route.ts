import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

type MemberRow = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  tracks?: string | null;
};

function normalizeTrackList(value: string | null | undefined) {
  if (!value) return [] as string[];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toTrackString(values: string[]) {
  return values.join(", ");
}

export async function GET() {
  const { error, role } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error: dbError } = await supabaseAdmin
    .from("members")
    .select("email, first_name, last_name, tracks")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  const rows = (data ?? []) as MemberRow[];
  return NextResponse.json({
    members: rows
      .map((row) => {
        const email = row.email?.trim().toLowerCase() ?? "";
        if (!email) return null;
        const fullName = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
        return {
          email,
          fullName: fullName || email,
          tracks: normalizeTrackList(row.tracks),
        };
      })
      .filter((row): row is { email: string; fullName: string; tracks: string[] } => Boolean(row)),
  });
}

export async function PATCH(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as {
    email?: string;
    trackName?: string;
    assigned?: boolean;
  } | null;

  if (!payload) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const email = payload.email?.trim().toLowerCase();
  const trackName = payload.trackName?.trim();
  if (!email || !trackName || typeof payload.assigned !== "boolean") {
    return NextResponse.json({ error: "email, trackName, and assigned are required." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("members")
    .select("tracks")
    .eq("email", email)
    .single();

  if (lookupError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  const current = normalizeTrackList(existing?.tracks ?? null);
  const next = payload.assigned
    ? Array.from(new Set([...current, trackName]))
    : current.filter((name) => name !== trackName);

  const { error: updateError } = await supabaseAdmin
    .from("members")
    .update({ tracks: toTrackString(next), updated_at: new Date().toISOString() })
    .eq("email", email);

  if (updateError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({ ok: true, tracks: next });
}
