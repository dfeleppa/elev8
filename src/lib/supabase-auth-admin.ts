import { createPasswordAuthClient } from "./supabase-admin";

export interface LoginResult {
  ok: true;
  userId: string;
  supabaseAuthUid: string;
  email: string;
  fullName: string | null;
}
export type LoginError = { ok: false; code: "invalid_credentials" };

/** Authenticate only. Registration, legacy recovery and linking require a
 * separate reviewed operation. A login never creates or relinks an account. */
export async function loginWithEmailPassword(
  email: string, password: string,
): Promise<LoginResult | LoginError> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return { ok: false, code: "invalid_credentials" };
  const { data, error } = await createPasswordAuthClient().auth.signInWithPassword({
    email: normalizedEmail, password,
  });
  if (error || !data.user) return { ok: false, code: "invalid_credentials" };
  return {
    ok: true, userId: data.user.id, supabaseAuthUid: data.user.id,
    email: data.user.email ?? normalizedEmail,
    fullName: typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : null,
  };
}
