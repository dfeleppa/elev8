import { defineConfig } from "@playwright/test";

process.loadEnvFile(".codex-crm.env");
if (process.env.CRM_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== "http://127.0.0.1:54321" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321" ||
    process.env.NEXTAUTH_URL !== "http://127.0.0.1:3100" || process.env.DEV_AUTH_EMAIL) {
  throw new Error("CRM integration requires the disposable local stack and real authentication.");
}
export default defineConfig({
  testDir: "tests/crm", testMatch: "**/*.spec.ts", workers: 1, retries: 0,
  timeout: 60_000, reporter: "list", outputDir: ".codex-crm-results",
  use: { baseURL: "http://127.0.0.1:3100", trace: "off", video: "off", screenshot: "off" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login", reuseExistingServer: false, timeout: 120_000,
  },
});
