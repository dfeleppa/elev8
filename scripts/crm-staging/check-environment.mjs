import { readFileSync } from "node:fs";
import { validateStagingEnvironment } from "./guards.mjs";

try {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/crm-staging/check-environment.mjs <reviewed-manifest>");
  const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
  validateStagingEnvironment(manifest, process.env);
  console.log("Staging targets and excluded settings verified. Credential ownership and deployed runtime still require hosted checks.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
