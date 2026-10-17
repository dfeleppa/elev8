import { spawnSync } from "node:child_process";
process.loadEnvFile(".codex-booking.env");
if (process.env.BOOKING_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== "http://127.0.0.1:55321") throw new Error("Disposable stack required.");
const child = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit", env: process.env });
if (child.error) throw child.error;
process.exit(child.status ?? 1);
