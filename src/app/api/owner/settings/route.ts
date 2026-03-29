import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET() {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("owner", role) || organizationIds.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = organizationIds[0];
  const { data: org, error: fetchError } = await supabaseAdmin
    .from("organizations")
    .select("id, name, logo_url, address, phone, email, invitation_code")
    .eq("id", orgId)
    .single();

  if (fetchError || !org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: org.id,
    name: org.name,
    logoUrl: org.logo_url,
    address: org.address,
    phone: org.phone,
    email: org.email,
    invitationCode: org.invitation_code,
  });
}

export async function PATCH(request: Request) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("owner", role) || organizationIds.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = organizationIds[0];
  const body = await request.json();

  // Build update object from allowed fields
  const updates: Record<string, string | null> = {};
  if ("name" in body) updates.name = body.name;
  if ("address" in body) updates.address = body.address ?? null;
  if ("phone" in body) updates.phone = body.phone ?? null;
  if ("email" in body) updates.email = body.email ?? null;
  if ("invitationCode" in body) updates.invitation_code = body.invitationCode ?? null;
  updates.updated_at = new Date().toISOString();

  const { data: org, error: updateError } = await supabaseAdmin
    .from("organizations")
    .update(updates)
    .eq("id", orgId)
    .select("id, name, logo_url, address, phone, email, invitation_code")
    .single();

  if (updateError) {
    // Handle unique constraint on invitation_code
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "This invitation code is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }

  return NextResponse.json({
    id: org.id,
    name: org.name,
    logoUrl: org.logo_url,
    address: org.address,
    phone: org.phone,
    email: org.email,
    invitationCode: org.invitation_code,
  });
}
