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
import { isOrganizationMemberEmailReserved, normalizeEmail } from "./organization-member-email";
import type { User } from "@supabase/supabase-js";

// ─── Registration ────────────────────────────────────────────────────────────

export interface RegisterResult {
  ok: true;
  supabaseUserId: string;
  appUserId: string;
}

export type RegisterError =
  | { ok: false; code: "reserved_email" }
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

  // Reserved email check
  if (await isOrganizationMemberEmailReserved(normalizedEmail)) {
    return { ok: false, code: "reserved_email" };
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

  // Reserved email check
  if (await isOrganizationMemberEmailReserved(normalizedEmail)) {
    return { ok: false, redirect: "/login?error=reserved_email" };
  }

  // Upsert into app_users (existing logic, preserved)
  const { data: existingAppUser } = await supabaseAdmin
    .from("app_users")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingAppUser) {
    await supabaseAdmin
      .from("app_users")
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingAppUser.id);
  } else {
    await supabaseAdmin.from("app_users").insert({
      email: normalizedEmail,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    });
  }

  // Check if user already exists in Supabase Auth
  // (they may have registered via email/password on another platform)
  const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingAuthUser = existingAuthUsers?.users.find((u) => u.email === normalizedEmail);

  if (existingAuthUser) {
    return { ok: true, supabaseUserId: existingAuthUser.id };
  }

  // Create user in Supabase Auth (OAuth-only, no password)
  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !newUser.user) {
    // If Supabase Auth creation fails (e.g. user already exists from another flow),
    // look up the existing user
    const retry = existingAuthUsers?.users.find((u) => u.email === normalizedEmail);
    if (retry) {
      return { ok: true, supabaseUserId: retry.id };
    }
    return { ok: false, redirect: "/login?error=oauth_create_failed" };
  }

  return { ok: true, supabaseUserId: newUser.user.id };
}
