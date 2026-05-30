import "server-only";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "./auth";
import { supabaseAdmin } from "./supabase-admin";

export type UserRole = "member" | "coach" | "admin" | "owner";

type UserContext = {
  userId: string | null;
  role: UserRole;
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

export function hasRole(required: UserRole, actual: UserRole) {
  return roleOrder[actual] >= roleOrder[required];
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

export async function requireUserContextFromBearer(request: Request): Promise<UserContext> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { userId: null, role: "member", error: "Unauthorized" };
  }

  const { data: jwtUser, error: jwtError } = await supabaseAdmin.auth.getUser(token);
  if (jwtError || !jwtUser?.user) {
    return { userId: null, role: "member", error: "Invalid or expired token" };
  }

  const userId = jwtUser.user.id;
  const email = jwtUser.user.email?.toLowerCase().trim() ?? null;

  // Run the three lookup paths in parallel rather than sequentially.
  // Same number of DB queries, but ~3x lower latency on the auth path.
  const [byUid, byId, byEmail] = await Promise.all([
    supabaseAdmin
      .from("app_users")
      .select("id, role, full_name")
      .eq("supabase_auth_uid", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("app_users")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle(),
    email
      ? supabaseAdmin
          .from("app_users")
          .select("id, role, full_name")
          .eq("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  let userRow: { id: string; role: string | null; full_name?: string | null } | null = null;
  let userError: { message: string } | null = null;

  if (!byUid.error && byUid.data) {
    userRow = byUid.data;
  } else if (!byId.error && byId.data) {
    userRow = byId.data;
  } else if (!byEmail.error && byEmail.data) {
    userRow = byEmail.data;
  } else {
    userError = byEmail.error ?? byId.error ?? byUid.error;
  }

  if (userError || !userRow) {
    return { userId, role: "member", error: userError?.message ?? "User not found." };
  }

  if (userRow.id) {
    await supabaseAdmin
      .from("app_users")
      .update({
        supabase_auth_uid: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userRow.id);
  }

  return { userId: userRow.id, role: normalizeRole(userRow.role), error: null };
}

export async function requireUserContext(): Promise<UserContext> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim() ?? null;

  if (!email) {
    return { userId: null, role: "member", error: "Unauthorized" };
  }

  const { fullName } = splitName(session?.user?.name);

  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from("app_users")
    .select("id, role, full_name")
    .eq("email", email)
    .maybeSingle();

  if (existingUserError) {
    return {
      userId: null,
      role: "member",
      error: existingUserError.message,
    };
  }

  let userRow = existingUser ? { id: existingUser.id, role: existingUser.role } : null;
  let userError: string | null = null;

  if (existingUser) {
    if ((existingUser.full_name ?? null) !== fullName) {
      const { error: updateError } = await supabaseAdmin
        .from("app_users")
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUser.id);

      if (updateError) {
        userError = updateError.message;
      }
    }
  } else {
    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from("app_users")
      .insert({
        email,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .select("id, role")
      .single();

    userRow = insertedUser;
    userError = insertError?.message ?? null;
  }

  if (userError || !userRow) {
    return {
      userId: null,
      role: "member",
      error: userError ?? "User not found.",
    };
  }

  return { userId: userRow.id, role: normalizeRole(userRow.role), error: null };
}

/**
 * Auth resolver that picks Bearer-token (mobile) or NextAuth session
 * (web) based on whether the request carries an Authorization header.
 *
 * Use this in API routes that need to be callable from both surfaces.
 * Two prior copies of this helper lived inline in the coach API routes;
 * they now import this one.
 */
export async function requireRequestUserContext(request: Request): Promise<UserContext> {
  const auth = request.headers.get("Authorization") ?? request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return requireUserContextFromBearer(request);
  }
  return requireUserContext();
}
