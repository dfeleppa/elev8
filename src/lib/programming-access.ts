import { hasRole, type UserRole } from "./member";
import { supabaseAdmin } from "./supabase-admin";

export async function isOrgMember(userId: string, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data?.id);
}

export async function getOrgRole(userId: string, organizationId: string): Promise<UserRole | null> {
  const { data, error } = await supabaseAdmin
    .from("organization_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.role) {
    return null;
  }

  if (data.role === "owner" || data.role === "admin" || data.role === "coach" || data.role === "member") {
    return data.role;
  }

  return null;
}

export async function hasOrgRole(userId: string, organizationId: string, minRole: UserRole) {
  const role = await getOrgRole(userId, organizationId);
  if (!role) {
    return false;
  }
  return hasRole(minRole, role);
}
