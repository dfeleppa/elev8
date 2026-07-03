import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }
  const { data } = await supabaseAdmin
    .from("social_google_photos_sources")
    .select("id, google_account_email, album_id, album_title, status, last_synced_at, metadata, created_at")
    .order("created_at", { ascending: false });
  return NextResponse.json({
    sources: data ?? [],
    note: "Google Photos ingestion is modeled and ready for connector wiring. Imported assets will be copied into Supabase storage.",
  });
}

export async function POST(request: NextRequest) {
  const { error, role, userId } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { googleAccountEmail?: string | null; albumId?: string | null; albumTitle?: string | null }
    | null;
  if (!body) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("social_google_photos_sources")
    .insert({
      member_id: userId,
      google_account_email: body.googleAccountEmail?.trim() || null,
      album_id: body.albumId?.trim() || null,
      album_title: body.albumTitle?.trim() || null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id, google_account_email, album_id, album_title, status, last_synced_at, created_at")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: "Failed to save Google Photos source." }, { status: 500 });
  }

  return NextResponse.json({ source: data });
}
