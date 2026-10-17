import "server-only";
import { requireUserContext, type UserRole } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

const unauthorized = { userId: null, role: "member" as UserRole, error: "Unauthorized" };

/** New clients require a provisioned identity link. Never claim an account by email. */
export async function requireClientContext(request: Request) {
  const header = request.headers.get("authorization");
  if (header === null) return requireUserContext();
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match) return unauthorized;
  const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
  if (error || !data.user) return unauthorized;
  const { data: rows, error: lookupError } = await supabaseAdmin
    .from("app_users").select("id, role")
    .eq("supabase_auth_uid", data.user.id).limit(2);
  if (lookupError || rows?.length !== 1) return unauthorized;
  const row = rows[0];
  if (!["member", "coach", "admin", "owner"].includes(row.role)) return unauthorized;
  return { userId: row.id as string, role: row.role as UserRole, error: null };
}

export function allowsMutationOrigin(request: Request) {
  if (request.headers.has("authorization")) return true; // Auth gate validates the token first.
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
  return origin === expected;
}
