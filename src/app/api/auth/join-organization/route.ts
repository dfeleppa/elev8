import { NextResponse } from "next/server";

import { normalizeInvitationCode } from "../../../../lib/invitation-code";
import { requireUserContext } from "../../../../lib/member";
import { normalizeEmail } from "../../../../lib/organization-member-email";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function splitName(fullName: string | null | undefined) {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { firstName: null, lastName: null } as const;
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName?.trim() || null,
    lastName: rest.join(" ").trim() || null,
  } as const;
}

export async function POST(request: Request) {
  try {
    const { userId, error } = await requireUserContext();
    if (error || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const invitationCode = normalizeInvitationCode(body.invitationCode);

    if (!invitationCode) {
      return NextResponse.json({ error: "Invitation code is required." }, { status: 400 });
    }

    // Look up organization by invitation code
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .ilike("invitation_code", invitationCode)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: "Invalid invitation code." }, { status: 404 });
    }

    const { data: user } = await supabaseAdmin
      .from("app_users")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    const email = normalizeEmail(user?.email);
    if (!email) {
      return NextResponse.json({ error: "User email is required." }, { status: 400 });
    }

    const { firstName, lastName } = splitName(user?.full_name);
    const now = new Date().toISOString();

    const { error: memberUpsertError } = await supabaseAdmin
      .from("organization_members")
      .upsert(
        {
          organization_id: org.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role: "member",
          updated_at: now,
        },
        { onConflict: "organization_id,email" }
      );

    if (memberUpsertError) {
      return NextResponse.json({ error: "Failed to attach organization member." }, { status: 500 });
    }

    const { error: membershipUpsertError } = await supabaseAdmin
      .from("organization_memberships")
      .upsert(
        {
          organization_id: org.id,
          user_id: userId,
          role: "member",
          updated_at: now,
        },
        { onConflict: "organization_id,user_id" }
      );

    if (membershipUpsertError) {
      return NextResponse.json({ error: "Failed to join organization." }, { status: 500 });
    }

    return NextResponse.json({ organizationId: org.id, organizationName: org.name });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
