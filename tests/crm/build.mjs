import { spawnSync } from "node:child_process";

// Next propagates execArgv to workers, where Node rejects --env-file. Load the
// configuration in this launcher and pass only the environment to a clean child.
process.loadEnvFile(".codex-crm.env");
if (process.env.CRM_E2E_LOCAL !== "1" || process.env.SUPABASE_URL !== "http://127.0.0.1:54321") {
  throw new Error("Integration builds require the disposable local stack.");
}
const child = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit", env: process.env });
if (child.error) throw child.error;
process.exit(child.status ?? 1);
