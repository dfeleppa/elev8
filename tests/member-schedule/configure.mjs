import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
if ([".env.local", ".env.production", ".env.production.local"].some(existsSync)) throw new Error("Use a clean isolated checkout.");
const status = JSON.parse(readFileSync(".codex-booking-status.json", "utf8"));
if (status.API_URL !== "http://127.0.0.1:55321" || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error("Only the dedicated disposable stack is supported.");
const values = {
  BOOKING_E2E_LOCAL: "1", SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, NEXTAUTH_URL: "http://127.0.0.1:3200",
  NEXTAUTH_SECRET: randomBytes(32).toString("hex"), GOOGLE_CLIENT_ID: "disabled-in-booking-integration",
  GOOGLE_CLIENT_SECRET: "disabled-in-booking-integration",
  MEMBER_SCHEDULE_ENABLED: "true", MEMBER_SCHEDULE_ENVIRONMENT: "test",
};
writeFileSync(".codex-booking.env", Object.entries(values).map(([key, value]) => key + "=" + JSON.stringify(value)).join("\n"), { mode: 0o600 });
console.log("Prepared disposable booking environment (values omitted).");
