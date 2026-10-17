import { defineConfig } from "@playwright/test";
process.loadEnvFile(".codex-booking.env");
if (process.env.BOOKING_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== "http://127.0.0.1:55321"
  || process.env.NEXTAUTH_URL !== "http://127.0.0.1:3200" || process.env.DEV_AUTH_EMAIL) throw new Error("Disposable booking stack and real authentication required.");
export default defineConfig({
  testDir: "tests/member-schedule", testMatch: "**/*.spec.ts", workers: 1, retries: 0,
  timeout: 60_000, reporter: "list", outputDir: ".codex-booking-results",
  use: { baseURL: "http://127.0.0.1:3200", trace: "off", video: "off", screenshot: "off" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200/login", reuseExistingServer: false, timeout: 120_000,
  },
});
