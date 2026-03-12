import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

type AllowedStaffRole = "coach" | "admin";

const ALLOWED_STAFF_ROLES: AllowedStaffRole[] = ["coach", "admin"];

function isAllowedStaffRole(value: unknown): value is AllowedStaffRole {
  return typeof value === "string" && ALLOWED_STAFF_ROLES.includes(value as AllowedStaffRole);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }
  return email;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const fullName = value.trim();
  return fullName || null;
}

function normalizePayrate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function canAccessOrganization(organizationIds: string[], organizationId: string) {
  return organizationIds.includes(organizationId);
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

  const { data, error: membershipError } = await supabaseAdmin
    .from("organization_memberships")
    .select("id, user_id, role, coaching_payrate, office_payrate, user:app_users(id, full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user;
    return {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      coachingPayrate: row.coaching_payrate,
      officePayrate: row.office_payrate,
      user: user
        ? {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
          }
        : null,
    };
  });

  const staff = rows.filter((row) => row.role === "coach" || row.role === "admin" || row.role === "owner");
  const promotableMembers = rows.filter((row) => row.role === "member");

  return NextResponse.json({ organizationId, staff, promotableMembers });
}

export async function POST(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  if (!hasRole("owner", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    organizationId?: string;
    existingUserId?: string;
    fullName?: string;
    email?: string;
    role?: string;
    coachingPayrate?: number | string | null;
    officePayrate?: number | string | null;
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

  if (!isAllowedStaffRole(payload.role)) {
    return NextResponse.json({ error: "role must be one of: coach, admin." }, { status: 400 });
  }

  const coachingPayrate = normalizePayrate(payload.coachingPayrate);
  const officePayrate = normalizePayrate(payload.officePayrate);

  let userId = payload.existingUserId?.trim() || null;

  if (!userId) {
    const email = normalizeEmail(payload.email);
    if (!email) {
      return NextResponse.json({ error: "A valid email is required when creating new staff." }, { status: 400 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("app_users")
      .upsert(
        {
          email,
          full_name: normalizeName(payload.fullName),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();

    if (userError || !user?.id) {
      return NextResponse.json({ error: userError?.message ?? "Failed to create user." }, { status: 500 });
    }

    userId = user.id;
  }

  const { error: membershipError } = await supabaseAdmin.from("organization_memberships").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      role: payload.role,
      coaching_payrate: coachingPayrate,
      office_payrate: officePayrate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" }
  );

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const { data: updatedMembership, error: fetchError } = await supabaseAdmin
    .from("organization_memberships")
    .select("id, user_id, role, coaching_payrate, office_payrate, user:app_users(id, full_name, email)")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !updatedMembership) {
    return NextResponse.json({ error: fetchError?.message ?? "Failed to fetch staff row." }, { status: 500 });
  }

  const user = Array.isArray(updatedMembership.user) ? updatedMembership.user[0] : updatedMembership.user;

  return NextResponse.json({
    staff: {
      id: updatedMembership.id,
      userId: updatedMembership.user_id,
      role: updatedMembership.role,
      coachingPayrate: updatedMembership.coaching_payrate,
      officePayrate: updatedMembership.office_payrate,
      user: user
        ? {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
          }
        : null,
    },
  });
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
    membershipId?: string;
    role?: string;
    coachingPayrate?: number | string | null;
    officePayrate?: number | string | null;
  } | null;

  if (!payload?.membershipId) {
    return NextResponse.json({ error: "membershipId is required." }, { status: 400 });
  }

  const organizationId = payload.organizationId?.trim() || organizationIds[0] || null;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  if (!canAccessOrganization(organizationIds, organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAllowedStaffRole(payload.role)) {
    return NextResponse.json({ error: "role must be one of: coach, admin." }, { status: 400 });
  }

  const { data: existingMembership, error: existingError } = await supabaseAdmin
    .from("organization_memberships")
    .select("id, role")
    .eq("id", payload.membershipId)
    .eq("organization_id", organizationId)
    .single();

  if (existingError || !existingMembership) {
    return NextResponse.json({ error: existingError?.message ?? "Membership not found." }, { status: 404 });
  }

  if (existingMembership.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be edited here." }, { status: 400 });
  }

  const coachingPayrate = normalizePayrate(payload.coachingPayrate);
  const officePayrate = normalizePayrate(payload.officePayrate);

  const { error: updateError } = await supabaseAdmin
    .from("organization_memberships")
    .update({
      role: payload.role,
      coaching_payrate: coachingPayrate,
      office_payrate: officePayrate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.membershipId)
    .eq("organization_id", organizationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
