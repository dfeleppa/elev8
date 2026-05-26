import "server-only";

import { supabaseAdmin } from "./supabase-admin";

export function normalizeInvitationCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function verifyInvitationCode(value: unknown): Promise<boolean> {
  const code = normalizeInvitationCode(value);
  if (!code) return false;

  const { data, error } = await supabaseAdmin
    .from("gym_settings")
    .select("invitation_code")
    .eq("id", 1)
    .single();

  if (error || !data?.invitation_code) return false;

  return normalizeInvitationCode(data.invitation_code) === code;
}
