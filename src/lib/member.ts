import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "./auth";
import { supabaseAdmin } from "./supabase-admin";

export type UserRole = "member" | "coach" | "admin" | "owner";

type UserContext = {
  userId: string | null;
  role: UserRole;
  organizationIds: string[];
  error: string | null;
};

const roleOrder: Record<UserRole, number> = {
  member: 1,
  coach: 2,
  admin: 3,
  owner: 4,
};

function splitName(fullName: string | null | undefined) {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { fullName: null } as const;
  }
  return { fullName: trimmed } as const;
}

function normalizeRole(value: string | null | undefined): UserRole {
  if (value === "owner" || value === "admin" || value === "coach") {
    return value;
  }
  return "member";
}

function getHighestRole(roles: Array<UserRole | null | undefined>): UserRole {
  return roles.reduce<UserRole>((current, role) => {
    if (!role) {
      return current;
    }
    return roleOrder[role] > roleOrder[current] ? role : current;
  }, "member");
}

export function hasRole(required: UserRole, actual: UserRole) {
  return roleOrder[actual] >= roleOrder[required];
}

async function resolveUserContext(userRow: { id: string; role: string | null }): Promise<UserContext> {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userRow.id);

  if (membershipError) {
    return {
      userId: userRow.id,
      role: normalizeRole(userRow.role),
      organizationIds: [],
      error: membershipError.message,
    };
  }

  const organizationIds = (memberships ?? [])
    .map((row) => row.organization_id)
    .filter((id): id is string => Boolean(id));
  const membershipRoles = (memberships ?? []).map((row) => normalizeRole(row.role));
  const userRole = normalizeRole(userRow.role);
  const role = getHighestRole([userRole, ...membershipRoles]);

  return { userId: userRow.id, role, organizationIds, error: null };
}

export async function requireUserContextFromBearer(request: Request): Promise<UserContext> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { userId: null, role: "member", organizationIds: [], error: "Unauthorized" };
  }

  const { data: jwtUser, error: jwtError } = await supabaseAdmin.auth.getUser(token);
  if (jwtError || !jwtUser?.user) {
    return { userId: null, role: "member", organizationIds: [], error: "Invalid or expired token" };
  }

  const userId = jwtUser.user.id;

  const { data: userRow, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !userRow) {
    return { userId, role: "member", organizationIds: [], error: userError?.message ?? "User not found." };
  }

  return resolveUserContext(userRow);
}

export async function requireUserContext(): Promise<UserContext> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;

  if (!email) {
    return { userId: null, role: "member", organizationIds: [], error: "Unauthorized" };
  }

  const { fullName } = splitName(session?.user?.name);

  const { data: userRow, error: userError } = await supabaseAdmin
    .from("app_users")
    .upsert(
      {
        email,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("id, role")
    .single();

  if (userError || !userRow) {
    return {
      userId: null,
      role: "member",
      organizationIds: [],
      error: userError?.message ?? "User not found.",
    };
  }

  return resolveUserContext(userRow);
}
