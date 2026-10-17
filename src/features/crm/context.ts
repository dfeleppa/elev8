import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

const unauthorized = { userId: null, role: "member" as UserRole, error: "Unauthorized" };

async function contextForAuthUid(authUid: string) {
  const { data: rows, error } = await supabaseAdmin
    .from("app_users").select("id, role")
    .eq("supabase_auth_uid", authUid).limit(2);
  if (error || rows?.length !== 1) return unauthorized;
  const row = rows[0];
  if (!["member", "coach", "admin", "owner"].includes(row.role)) return unauthorized;
  return { userId: row.id as string, role: row.role as UserRole, error: null };
}

export async function requireWebClientContext() {
  const session = await getServerSession(authOptions);
  if (!session?.verifiedAuthUid) return unauthorized;
  return contextForAuthUid(session.verifiedAuthUid);
}

/** New clients require a provisioned identity link. Never claim an account by email. */
export async function requireClientContext(request: Request) {
  const header = request.headers.get("authorization");
  if (header === null) return requireWebClientContext();
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match) return unauthorized;
  const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
  if (error || !data.user) return unauthorized;
  return contextForAuthUid(data.user.id);
}

export function allowsMutationOrigin(request: Request) {
  if (request.headers.has("authorization")) return true; // Auth gate validates the token first.
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
  return origin === expected;
}
