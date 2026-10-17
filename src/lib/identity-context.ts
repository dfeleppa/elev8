import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { supabaseAdmin } from "./supabase-admin";

export type UserRole = "member" | "coach" | "admin" | "owner";
export type UserContext = { userId: string | null; role: UserRole; error: string | null };
const unauthorized: UserContext = { userId: null, role: "member", error: "Unauthorized" };
const roles: readonly string[] = ["member", "coach", "admin", "owner"];

/** Only call with a server-verified subject; never an email or client app ID. */
async function contextForAuthUid(authUid: string): Promise<UserContext> {
  const { data: rows, error } = await supabaseAdmin
    .from("app_users").select("id, role")
    .eq("supabase_auth_uid", authUid).limit(2);
  if (error || rows?.length !== 1) return unauthorized;
  const row = rows[0];
  if (!row.id || !roles.includes(row.role)) return unauthorized;
  return { userId: row.id, role: row.role as UserRole, error: null };
}

// Supabase may link OAuth identities by email. Until provider-subject mapping is
// proven, OAuth/recovery cannot inherit a password account's app permissions.
export function hasPasswordProof(amr: unknown): boolean {
  if (!Array.isArray(amr) || !amr.length) return false;
  const methods = amr.map(entry => entry?.method);
  return methods.includes("password") &&
    methods.every(method => ["password", "totp", "token_refresh"].includes(method));
}

export async function requireWebIdentity(): Promise<UserContext> {
  const session = await getServerSession(authOptions);
  if (!session?.verifiedAuthUid) return unauthorized;
  return contextForAuthUid(session.verifiedAuthUid);
}

export async function requireBearerIdentity(request: Request): Promise<UserContext> {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return unauthorized;
  // Both signature/expiry and current Auth user state must validate.
  const { data: verified, error: claimsError } = await supabaseAdmin.auth.getClaims(match[1]);
  if (claimsError || !verified || !hasPasswordProof(verified.claims.amr)) return unauthorized;
  const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
  if (error || !data.user || data.user.id !== verified.claims.sub) return unauthorized;
  return contextForAuthUid(data.user.id);
}

export async function requireRequestIdentity(request: Request): Promise<UserContext> {
  return request.headers.has("authorization")
    ? requireBearerIdentity(request)
    : requireWebIdentity();
}
