import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const status = JSON.parse(readFileSync(".codex-crm-status.json", "utf8"));
if (status.API_URL !== "http://127.0.0.1:54321" || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
  throw new Error("Only the disposable loopback Supabase stack is supported.");
}
// No production credentials or provider settings enter the test process.
const values = {
  CRM_E2E_LOCAL: "1", SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  NEXTAUTH_URL: "http://127.0.0.1:3100",
  NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
  GOOGLE_CLIENT_ID: "disabled-in-crm-integration", GOOGLE_CLIENT_SECRET: "disabled-in-crm-integration",
};
writeFileSync(".codex-crm.env", Object.entries(values).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n"), { mode: 0o600 });
console.log("Prepared loopback-only integration configuration (values omitted).");
