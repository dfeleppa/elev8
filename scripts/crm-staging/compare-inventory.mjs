import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Captured time/source reference and migration ledger intentionally differ on a
// snapshot bootstrap. Every application catalog difference needs disposition.
const fields = ["tables", "functions", "triggers", "policies", "grants", "columnGrants", "defaultPrivileges", "indexes", "extensions"];
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function compareInventories(source, stage) {
  if (source.formatVersion !== 1 || stage.formatVersion !== 1) throw new Error("Unsupported inventory format.");
  const differences = [];
  for (const field of fields) {
    if (!(field in source) || !(field in stage)) throw new Error(`Missing inventory section: ${field}`);
    if (JSON.stringify(canonical(source[field])) !== JSON.stringify(canonical(stage[field]))) differences.push(field);
  }
  return { matches: differences.length === 0, differences, serverVersions: [source.serverVersion, stage.serverVersion] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node scripts/crm-staging/compare-inventory.mjs <source.json> <stage.json>");
    const result = compareInventories(...process.argv.slice(2).map(path => JSON.parse(readFileSync(path, "utf8"))));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.matches ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
