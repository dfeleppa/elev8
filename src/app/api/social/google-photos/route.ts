import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }
  const { data } = await supabaseAdmin
    .from("social_google_photos_sources")
    .select("id, google_account_email, album_id, album_title, status, last_synced_at, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return NextResponse.json({
    sources: data ?? [],
    note: "Google Photos ingestion is modeled and ready for connector wiring. Imported assets will be copied into Supabase storage.",
  });
}

export async function POST(request: NextRequest) {
  const { error, role, userId, organizationIds } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { organizationId?: string; googleAccountEmail?: string | null; albumId?: string | null; albumTitle?: string | null }
    | null;
  const organizationId = body?.organizationId?.trim() ?? organizationIds[0] ?? null;
  if (!body || !organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("social_google_photos_sources")
    .insert({
      organization_id: organizationId,
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
