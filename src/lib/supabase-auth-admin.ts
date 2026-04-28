/**
 * Supabase Auth Admin helpers.
 *
 * All user-facing auth operations (registration, login, OAuth) should flow
 * through Supabase Auth so that the same accounts work on web and iOS.
 *
 * The supabaseAdmin client uses the SERVICE_ROLE_KEY, which bypasses RLS
 * but still routes through the Auth server — meaning password verification
 * and OAuth token handling are handled correctly.
 */

import { supabaseAdmin } from "./supabase-admin";
import type { User } from "@supabase/supabase-js";

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Lookup a Supabase Auth user id for an email address without listing the
 * entire users table on every call. We rely on app_users mirroring the
 * Supabase Auth uid (either as the PK for password-registered users or via
 * the supabase_auth_uid column for OAuth users).
 */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id, supabase_auth_uid")
    .eq("email", email)
    .maybeSingle();

  if (!data) return null;
  const row = data as { id: string | null; supabase_auth_uid: string | null };
  return row.supabase_auth_uid ?? row.id ?? null;
}

// ─── Registration ────────────────────────────────────────────────────────────

export interface RegisterResult {
  ok: true;
  supabaseUserId: string;
  appUserId: string;
}

export type RegisterError =
  | { ok: false; code: "already_exists" }
  | { ok: false; code: "supabase_error"; message: string }
  | { ok: false; code: "internal_error" };

/**
 * Creates a new user account in Supabase Auth AND upserts their app_users record.
 * This is the single registration entry point for the web app.
 */
export async function registerWithEmailPassword(
  fullName: string,
  email: string,
  password: string
): Promise<RegisterResult | RegisterError> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, code: "internal_error" };
  }

  // Check if already in app_users
  const { data: existingAppUser } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingAppUser) {
    // Already registered — don't allow re-registration with password
    return { ok: false, code: "already_exists" };
  }

  // Create user in Supabase Auth
  const { data: supabaseUser, error: supabaseError } =
    await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (supabaseError) {
    // Handle "user already exists" from Supabase Auth
    if (supabaseError.message.includes("already been registered")) {
      return { ok: false, code: "already_exists" };
    }
    return { ok: false, code: "supabase_error", message: supabaseError.message };
  }

  const supabaseUserId = (supabaseUser.user as User).id;

  // Upsert app_users record (for full_name, etc.)
  const { error: appUserError } = await supabaseAdmin
    .from("app_users")
    .upsert(
      {
        id: supabaseUserId, // use Supabase Auth user ID as the app_users PK
        email: normalizedEmail,
        full_name: fullName.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (appUserError) {
    // Non-fatal — user exists in Supabase Auth, which is what matters for login
    console.error("[supabase-auth-admin] Failed to upsert app_users:", appUserError.message);
  }

  return { ok: true, supabaseUserId, appUserId: supabaseUserId };
}

// ─── Credentials Login ───────────────────────────────────────────────────────

export interface LoginResult {
  ok: true;
  userId: string;
  email: string;
  fullName: string | null;
}

export type LoginError =
  | { ok: false; code: "user_not_found" | "invalid_credentials" | "internal_error" };

/**
 * Verifies email + password against Supabase Auth.
 *
 * Also handles one-time migration of legacy users (bcrypt in app_users):
 * if a user has password_hash in app_users but no Supabase Auth account,
 * we create one on-the-fly so future logins work normally.
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<LoginResult | LoginError> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, code: "internal_error" };
  }

  // Step 1: try Supabase Auth verification
  // signInWithPassword on the admin client uses the service role key.
  // This bypasses RLS but still routes through the Auth server,
  // which correctly verifies the password against the Supabase Auth hash.
  const { data: signInData, error: signInError } =
    await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (!signInError && signInData.user) {
    const user = signInData.user;
    return {
      ok: true,
      userId: user.id,
      email: user.email ?? normalizedEmail,
      fullName: user.user_metadata?.full_name ?? null,
    };
  }

  // Step 2: check if user exists in app_users but not in Supabase Auth
  // (legacy migration case: user registered before this change)
  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("id, email, full_name, password_hash")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (appUser?.password_hash) {
    // Migrate: create Supabase Auth account for this user
    const { error: migrateError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: appUser.full_name ?? undefined },
    });

    if (!migrateError) {
      // Return success — they can log in via Supabase Auth next time
      return {
        ok: true,
        userId: appUser.id,
        email: appUser.email ?? normalizedEmail,
        fullName: appUser.full_name ?? null,
      };
    }
  }

  return { ok: false, code: "invalid_credentials" };
}

// ─── OAuth user upsert (used by NextAuth callbacks) ─────────────────────────

/**
 * Ensures an OAuth user exists in Supabase Auth.
 * Called from NextAuth's signIn callback when a user logs in via Google/Apple.
 *
 * Returns the Supabase Auth user ID, or null if the user should be rejected.
 */
export async function upsertSupabaseAuthOAuthUser(
  email: string,
  fullName: string | null
): Promise<{ ok: true; supabaseUserId: string } | { ok: false; redirect: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, redirect: "/login?error=invalid_email" };
  }

  // Upsert into app_users (existing logic, preserved)
  const { data: existingAppUser } = await supabaseAdmin
    .from("app_users")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const appUserRow = existingAppUser as
    | { id: string; email: string; supabase_auth_uid?: string | null }
    | null;

  if (appUserRow) {
    await supabaseAdmin
      .from("app_users")
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appUserRow.id);
  } else {
    await supabaseAdmin.from("app_users").insert({
      email: normalizedEmail,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    });
  }

  // Cached path: if app_users already knows the Supabase Auth uid (set by a
  // prior login or password registration where app_users.id IS the auth uid),
  // reuse it instead of paginating the entire users table.
  const cachedAuthUid = await findAuthUserIdByEmail(normalizedEmail);
  if (cachedAuthUid) {
    return { ok: true, supabaseUserId: cachedAuthUid };
  }

  // Cold path: create the Supabase Auth user. If they already exist
  // (e.g. registered via password before our cache was populated),
  // createUser returns an "already_exists" style error; we then fall back
  // to a paginated lookup so subsequent logins are fast.
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let supabaseUserId: string | null = newUser?.user?.id ?? null;

  if (error || !supabaseUserId) {
    // Slow fallback: scan auth users for this email. This only runs once per
    // user (we cache the uid below) and only when the user pre-existed in
    // Supabase Auth without a synced app_users row.
    let page = 1;
    while (page <= 50) {
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listError || !list?.users?.length) break;
      const match = list.users.find((u) => u.email === normalizedEmail);
      if (match) {
        supabaseUserId = match.id;
        break;
      }
      if (list.users.length < 200) break;
      page += 1;
    }
  }

  if (!supabaseUserId) {
    return { ok: false, redirect: "/login?error=oauth_create_failed" };
  }

  // Cache the auth uid back to app_users so the next OAuth login skips the
  // expensive listUsers fallback entirely.
  await supabaseAdmin
    .from("app_users")
    .update({
      supabase_auth_uid: supabaseUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("email", normalizedEmail);

  return { ok: true, supabaseUserId };
}
