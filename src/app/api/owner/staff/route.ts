import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AllowedStaffRole = "coach" | "admin";

const ALLOWED_STAFF_ROLES: AllowedStaffRole[] = ["coach", "admin"];

function isAllowedStaffRole(value: unknown): value is AllowedStaffRole {
  return typeof value === "string" && ALLOWED_STAFF_ROLES.includes(value as AllowedStaffRole);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const fullName = value.trim();
  return fullName || null;
}

function normalizePayrate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Staff = all app_users with coach, admin, or owner role
  const { data: staffRows, error: staffError } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, email, role, coaching_payrate, office_payrate")
    .in("role", ["coach", "admin", "owner"])
    .order("created_at", { ascending: true });

  if (staffError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  const staff = (staffRows ?? []).map((row) => ({
    id: row.id,
    userId: row.id,
    role: row.role,
    coachingPayrate: row.coaching_payrate ?? null,
    officePayrate: row.office_payrate ?? null,
    user: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
    },
  }));

  const staffEmails = new Set(
    staff.map((s) => s.user.email?.toLowerCase().trim()).filter(Boolean) as string[]
  );

  // Promotable = members roster entries not already in staff
  const { data: memberRows, error: memberError } = await supabaseAdmin
    .from("members")
    .select("first_name, last_name, email, role, membership")
    .order("created_at", { ascending: true });

  if (memberError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  const promotableMembers = (memberRows ?? [])
    .map((row) => {
      const email = normalizeEmail(row.email);
      if (!email || staffEmails.has(email)) return null;
      const fullName = `${String(row.first_name ?? "").trim()} ${String(row.last_name ?? "").trim()}`.trim();
      return {
        email,
        fullName: fullName || email,
        membership: typeof row.membership === "string" ? row.membership : null,
        role: typeof row.role === "string" ? row.role : "member",
      };
    })
    .filter(Boolean) as { email: string; fullName: string; membership: string | null; role: string }[];

  return NextResponse.json({ staff, promotableMembers });
}

export async function POST(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as {
    existingUserId?: string;
    existingMemberEmail?: string;
    existingMemberName?: string;
    fullName?: string;
    email?: string;
    role?: string;
    coachingPayrate?: number | string | null;
    officePayrate?: number | string | null;
  } | null;

  if (!payload) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  if (!isAllowedStaffRole(payload.role)) {
    return NextResponse.json({ error: "role must be one of: coach, admin." }, { status: 400 });
  }

  const coachingPayrate = normalizePayrate(payload.coachingPayrate);
  const officePayrate = normalizePayrate(payload.officePayrate);

  let userId = payload.existingUserId?.trim() || null;

  if (!userId) {
    const email = normalizeEmail(payload.existingMemberEmail ?? payload.email);
    if (!email) {
      return NextResponse.json({ error: "A valid email is required when creating new staff." }, { status: 400 });
    }

    const { data: user, error: upsertError } = await supabaseAdmin
      .from("app_users")
      .upsert(
        {
          email,
          full_name: normalizeName(payload.existingMemberName ?? payload.fullName),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();

    if (upsertError || !user?.id) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    userId = user.id;
  }

  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from("app_users")
    .update({
      role: payload.role,
      coaching_payrate: coachingPayrate,
      office_payrate: officePayrate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id, full_name, email, role, coaching_payrate, office_payrate")
    .single();

  if (updateError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({
    staff: {
      id: updatedUser?.id,
      userId: updatedUser?.id,
      role: updatedUser?.role,
      coachingPayrate: updatedUser?.coaching_payrate ?? null,
      officePayrate: updatedUser?.office_payrate ?? null,
      user: {
        id: updatedUser?.id,
        fullName: updatedUser?.full_name,
        email: updatedUser?.email,
      },
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as {
    userId?: string;
    role?: string;
    coachingPayrate?: number | string | null;
    officePayrate?: number | string | null;
  } | null;

  if (!payload?.userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  if (!isAllowedStaffRole(payload.role)) {
    return NextResponse.json({ error: "role must be one of: coach, admin." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("id, role")
    .eq("id", payload.userId)
    .single();

  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (existing.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be edited here." }, { status: 400 });
  }

  const coachingPayrate = normalizePayrate(payload.coachingPayrate);
  const officePayrate = normalizePayrate(payload.officePayrate);

  const { error: updateError } = await supabaseAdmin
    .from("app_users")
    .update({
      role: payload.role,
      coaching_payrate: coachingPayrate,
      office_payrate: officePayrate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.userId);

  if (updateError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
