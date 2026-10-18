import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyBundle, verifyLinkedTarget } from "./guards.mjs";

export function dryRunArguments(directory) {
  const path = resolve(directory);
  const manifest = verifyBundle(path);
  verifyLinkedTarget(path, manifest);
  return ["db", "push", "--linked", "--dry-run", "--workdir", path];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/crm-staging/dry-run.mjs <bundle-directory>");
    const args = dryRunArguments(process.argv[2]);
    // An absolute native CLI executable avoids shell interpolation. No apply,
    // repair, reset, provisioning or seed mode exists in this wrapper.
    const executable = process.env.CRM_SUPABASE_CLI;
    if (!executable || resolve(executable) !== executable || !/supabase(?:\.exe)?$/i.test(executable)) {
      throw new Error("CRM_SUPABASE_CLI must be an absolute native Supabase executable path.");
    }
    const env = Object.fromEntries(["PATH", "Path", "SystemRoot", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP",
      "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
    const result = spawnSync(executable, args, { cwd: resolve(process.argv[2]), env, stdio: "inherit", shell: false });
    if (result.error) throw new Error("Could not execute the Supabase CLI.");
    process.exitCode = result.status ?? 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
