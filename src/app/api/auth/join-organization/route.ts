import { NextResponse } from "next/server";

import { requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { userId, error } = await requireUserContext();
    if (error || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const invitationCode = (body.invitationCode ?? "").trim();

    if (!invitationCode) {
      return NextResponse.json({ error: "Invitation code is required." }, { status: 400 });
    }

    // Look up organization by invitation code
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("invitation_code", invitationCode)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: "Invalid invitation code." }, { status: 404 });
    }

    // Check if membership already exists
    const { data: existing } = await supabaseAdmin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", org.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You are already a member of this organization." },
        { status: 409 }
      );
    }

    // Create membership
    const { error: insertError } = await supabaseAdmin
      .from("organization_memberships")
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: "member",
      });

    if (insertError) {
      return NextResponse.json({ error: "Failed to join organization." }, { status: 500 });
    }

    return NextResponse.json({ organizationId: org.id, organizationName: org.name });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
