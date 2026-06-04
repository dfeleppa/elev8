/**
 * Supabase Auth Admin helpers.
 *
 * All user-facing auth operations (registration, login, OAuth) should flow
 * through Supabase Auth so that the same accounts work on web and iOS.
 *
 * The supabaseAdmin client uses the SERVICE_ROLE_KEY, which bypasses RLS
 * but still routes through the Auth server, meaning password verification
 * and OAuth token handling are handled correctly.
 */

import type { User } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

import { supabaseAdmin } from "./supabase-admin";

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

async function findSupabaseAuthUserByEmail(email: string): Promise<User | null> {
  let page = 1;

  while (page <= 50) {
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error || !list?.users?.length) {
      return null;
    }

    const match = list.users.find((user) => user.email?.toLowerCase().trim() === email);
    if (match) {
      return match as User;
    }

    if (list.users.length < 200) {
      return null;
    }

    page += 1;
  }

  return null;
}

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
 * Creates a new user account in Supabase Auth and upserts their app_users row.
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

  const trimmedFullName = fullName.trim();

  const { data: existingAppUser } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, supabase_auth_uid")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingAppUser) {
    const linkedAuthUser = await findSupabaseAuthUserByEmail(normalizedEmail);

    if (linkedAuthUser?.id) {
      await supabaseAdmin
        .from("app_users")
        .update({
          supabase_auth_uid: linkedAuthUser.id,
          full_name: (trimmedFullName || existingAppUser.full_name) ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAppUser.id);

      return { ok: false, code: "already_exists" };
    }

    const { data: createdAuthUser, error: createLegacyAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: (trimmedFullName || existingAppUser.full_name) ?? undefined,
        },
      });

    if (createLegacyAuthError || !createdAuthUser.user?.id) {
      return {
        ok: false,
        code: "supabase_error",
        message: createLegacyAuthError?.message ?? "Failed to create account.",
      };
    }

    const supabaseUserId = createdAuthUser.user.id;
    const { error: updateExistingUserError } = await supabaseAdmin
      .from("app_users")
      .update({
        full_name: (trimmedFullName || existingAppUser.full_name) ?? null,
        supabase_auth_uid: supabaseUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingAppUser.id);

    if (updateExistingUserError) {
      console.error(
        "[supabase-auth-admin] Failed to attach Supabase Auth user to legacy app_users row:",
        updateExistingUserError.message
      );
    }

    return { ok: true, supabaseUserId, appUserId: existingAppUser.id };
  }

  const { data: supabaseUser, error: supabaseError } =
    await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: trimmedFullName },
    });

  if (supabaseError) {
    if (supabaseError.message.includes("already been registered")) {
      return { ok: false, code: "already_exists" };
    }
    return { ok: false, code: "supabase_error", message: supabaseError.message };
  }

  const supabaseUserId = (supabaseUser.user as User).id;

  const { error: appUserError } = await supabaseAdmin
    .from("app_users")
    .upsert(
      {
        id: supabaseUserId,
        email: normalizedEmail,
        full_name: trimmedFullName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (appUserError) {
    console.error("[supabase-auth-admin] Failed to upsert app_users:", appUserError.message);
  }

  return { ok: true, supabaseUserId, appUserId: supabaseUserId };
}

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

  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("id, email, full_name, password_hash")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (appUser?.password_hash) {
    const passwordMatches = await bcrypt.compare(password, appUser.password_hash).catch(() => false);
    if (!passwordMatches) {
      return { ok: false, code: "invalid_credentials" };
    }

    const { data: migratedUser, error: migrateError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: appUser.full_name ?? undefined },
      });

    if (!migrateError && migratedUser.user?.id) {
      await supabaseAdmin
        .from("app_users")
        .update({
          supabase_auth_uid: migratedUser.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appUser.id);

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

/**
 * Ensures an OAuth user exists in Supabase Auth.
 * Called from NextAuth's signIn callback when a user logs in via Google/Apple.
 */
export async function upsertSupabaseAuthOAuthUser(
  email: string,
  fullName: string | null,
  hasInvitationTicket = false
): Promise<{ ok: true; supabaseUserId: string } | { ok: false; redirect: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, redirect: "/login?error=invalid_email" };
  }

  const { data: existingAppUser } = await supabaseAdmin
    .from("app_users")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const appUserRow = existingAppUser as
    | { id: string; email: string; supabase_auth_uid?: string | null }
    | null;

  if (!appUserRow && !hasInvitationTicket) {
    return { ok: false, redirect: "/login?error=invite_required" };
  }

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

  const cachedAuthUid = await findAuthUserIdByEmail(normalizedEmail);
  if (cachedAuthUid) {
    return { ok: true, supabaseUserId: cachedAuthUid };
  }

  const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let supabaseUserId: string | null = newUser?.user?.id ?? null;

  if (error || !supabaseUserId) {
    supabaseUserId = (await findSupabaseAuthUserByEmail(normalizedEmail))?.id ?? null;
  }

  if (!supabaseUserId) {
    return { ok: false, redirect: "/login?error=oauth_create_failed" };
  }

  await supabaseAdmin
    .from("app_users")
    .update({
      supabase_auth_uid: supabaseUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("email", normalizedEmail);

  return { ok: true, supabaseUserId };
}
