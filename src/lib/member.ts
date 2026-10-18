import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

import type { UserRole, UserContext } from "./identity-context";
export type { UserRole } from "./identity-context";
export {
  requireWebIdentity as requireUserContext,
  requireBearerIdentity as requireUserContextFromBearer,
  requireRequestIdentity as requireRequestUserContext,
} from "./identity-context";

const roleOrder: Record<UserRole, number> = {
  member: 1,
  coach: 2,
  admin: 3,
  owner: 4,
};

export function hasRole(required: UserRole, actual: UserRole) {
  return roleOrder[actual] >= roleOrder[required];
}

export async function canAccessMemberNutrition(userId: string, role: UserRole, memberId: string) {
  if (memberId === userId || hasRole("admin", role)) {
    return true;
  }

  if (role !== "coach") {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select("id")
    .eq("coach_id", userId)
    .eq("member_id", memberId)
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

export async function listAccessibleNutritionMemberIds(userId: string, role: UserRole) {
  if (hasRole("admin", role)) {
    return null;
  }

  if (role !== "coach") {
    return [userId];
  }

  const { data } = await supabaseAdmin
    .from("coach_nutrition_plans")
    .select("member_id")
    .eq("coach_id", userId);

  return Array.from(new Set((data ?? []).map((row) => row.member_id).filter(Boolean)));
}

/**
 * Shared authorization gate for API routes. Given a resolved UserContext and a
 * minimum role, returns a discriminated result: either `{ ok: false, response }`
 * carrying a ready-to-return 401/403, or `{ ok: true, userId, role }` with the
 * caller's id narrowed to a non-null string.
 *
 * Collapses the three auth idioms that previously lived inline across routes
 * into one greppable line:
 *
 *   const auth = authorizeRole(await requireRequestUserContext(request), "admin");
 *   if (!auth.ok) return auth.response;
 *   // auth.userId / auth.role are safe to use here
 *
 * Using the role already resolved on the context also avoids a second DB
 * round-trip.
 */
export type RoleAuthResult =
  | { ok: true; userId: string; role: UserRole }
  | { ok: false; response: NextResponse };

export function authorizeRole(ctx: UserContext, required: UserRole): RoleAuthResult {
  if (ctx.error || !ctx.userId) {
    return { ok: false, response: NextResponse.json({ error: ctx.error ?? "Unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(required, ctx.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId: ctx.userId, role: ctx.role };
}
