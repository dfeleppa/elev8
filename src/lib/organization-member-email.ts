import "server-only";

import { supabaseAdmin } from "./supabase-admin";

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function isOrganizationMemberEmailReserved(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("email", normalizedEmail)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length > 0;
}
