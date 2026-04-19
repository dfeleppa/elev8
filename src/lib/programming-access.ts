import { hasRole, type UserRole } from "./member";
import { supabaseAdmin } from "./supabase-admin";

async function getUserRole(userId: string): Promise<UserRole> {
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const r = data?.role;
  if (r === "owner" || r === "admin" || r === "coach") return r;
  return "member";
}

export async function isOrgMember(userId: string) {
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function getOrgRole(userId: string): Promise<UserRole | null> {
  return getUserRole(userId);
}

export async function hasOrgRole(userId: string, _organizationId: string, minRole: UserRole) {
  const role = await getUserRole(userId);
  return hasRole(minRole, role);
}
