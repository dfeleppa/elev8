import { NextResponse } from "next/server";

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
    const invitationCode = String(body.invitationCode ?? "").trim().toUpperCase();

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

    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("email")
      .eq("organization_id", org.id)
      .eq("email", email)
      .maybeSingle();

    if (existingMember) {
      const { error: memberUpdateError } = await supabaseAdmin
        .from("organization_members")
        .update({
          first_name: firstName,
          last_name: lastName,
          role: "member",
          updated_at: now,
        })
        .eq("organization_id", org.id)
        .eq("email", email);

      if (memberUpdateError) {
        return NextResponse.json({ error: "Failed to attach organization member." }, { status: 500 });
      }
    } else {
      const { error: memberInsertError } = await supabaseAdmin
        .from("organization_members")
        .insert({
          organization_id: org.id,
          email,
          first_name: firstName,
          last_name: lastName,
          role: "member",
          created_at: now,
          updated_at: now,
        });

      if (memberInsertError) {
        return NextResponse.json({ error: "Failed to attach organization member." }, { status: 500 });
      }
    }

    // Create membership
    const { error: insertError } = await supabaseAdmin
      .from("organization_memberships")
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: "member",
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      return NextResponse.json({ error: "Failed to join organization." }, { status: 500 });
    }

    return NextResponse.json({ organizationId: org.id, organizationName: org.name });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
