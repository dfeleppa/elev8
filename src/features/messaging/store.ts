import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SmsOutboxStore, SendOutcome, SmsIntent } from "./contracts";

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const result = await supabaseAdmin.rpc(name, args);
  if (result.error) throw new Error("Messaging persistence unavailable");
  return result.data;
}
export const smsOutboxStore: SmsOutboxStore = {
  async claim() { return (await rpc("crm_sms_claim"))?.[0] ?? null; },
  async begin(id, token) {
    const row = (await rpc("crm_sms_begin", { p_id: id, p_token: token }))?.[0];
    return row ? { id: row.id, phone: row.phone, body: row.body } as SmsIntent : null;
  },
  async settle(id, token, outcome: SendOutcome) {
    await rpc("crm_sms_settle", { p_id: id, p_token: token, p_outcome: outcome.kind,
      p_sid: outcome.kind === "accepted" ? outcome.sid : null });
  },
};
