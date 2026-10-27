import "server-only";
import type { Account, Profile } from "next-auth";
import { supabaseAdmin } from "./supabase-admin";

export type OAuthIdentity = {
  provider: "google" | "apple";
  issuer: string;
  audience: string;
  subject: string;
};
export type OAuthContext = { userId: string; role: "member" | "coach" | "admin" | "owner" };

/** Only accepts profiles already validated by NextAuth's OIDC callback.
 * Never call with a client request body. */
export function oauthIdentityForAccount(account: Account | null, profile?: Profile): OAuthIdentity | null {
  if (!account || account.type !== "oauth" || !profile?.sub || profile.sub !== account.providerAccountId) return null;
  const provider = account.provider;
  if (provider !== "google" && provider !== "apple") return null;
  const audience = provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.APPLE_CLIENT_ID;
  if (!audience) return null;
  return {
    provider, audience, subject: profile.sub,
    issuer: provider === "google" ? "https://accounts.google.com" : "https://appleid.apple.com",
  };
}

function parameters(identity: OAuthIdentity) {
  return { p_provider: identity.provider, p_issuer: identity.issuer, p_audience: identity.audience, p_subject: identity.subject };
}

export async function resolveOAuthIdentity(identity: OAuthIdentity): Promise<OAuthContext | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("resolve_web_oauth_identity", parameters(identity));
    if (error || !Array.isArray(data) || data.length !== 1) return null;
    const row = data[0];
    if (!row.app_user_id || !["member", "coach", "admin", "owner"].includes(row.role)) return null;
    return { userId: row.app_user_id, role: row.role };
  } catch { return null; }
}

export async function registerOAuthMember(identity: OAuthIdentity, profile?: Profile): Promise<boolean> {
  const verified = profile as (Profile & { email_verified?: boolean | string }) | undefined;
  if (!verified?.email || ![true, "true"].includes(verified.email_verified ?? false)) return false;
  try {
    const { data, error } = await supabaseAdmin.rpc("register_web_oauth_member", {
      ...parameters(identity), p_email: verified.email.trim().toLowerCase(), p_name: verified.name ?? null,
    });
    return !error && data === true;
  } catch { return false; }
}
