import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "./guards.mjs";

// A timestamp/name match is ledger evidence only, never schema equivalence.
export function reconcileMigrations(remote, local) {
  const remoteVersions = new Set(remote.map(r => r.version));
  const localVersions = new Set(local.map(r => r.version));
  if (remoteVersions.size !== remote.length || localVersions.size !== local.length) throw new Error("Duplicate migration versions.");
  return {
    remoteCount: remote.length, localCount: local.length,
    sameVersion: local.filter(l => remoteVersions.has(l.version)).map(l => ({
      ...l, remote: remote.find(r => r.version === l.version),
      byteMatch: l.sha256 === remote.find(r => r.version === l.version)?.statementsSha256,
      disposition: "ledger-present; compare SQL and live objects before declaring parity",
    })),
    renamedCandidates: local.filter(l => !remoteVersions.has(l.version)).flatMap(l =>
      remote.filter(r => r.name === l.name && !localVersions.has(r.version)).map(r => ({ local: l, remote: r, disposition: "review-required" }))),
    localOnly: local.filter(l => !remoteVersions.has(l.version) && !remote.some(r => r.name === l.name)),
    remoteOnly: remote.filter(r => !localVersions.has(r.version) && !local.some(l => l.name === r.name)),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node scripts/crm-staging/reconcile.mjs <inventory.json> <migration-directory>");
    const inventory = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const local = readdirSync(process.argv[3]).filter(f => /^\d{14}_.+\.sql$/.test(f)).map(file => ({
      version: file.slice(0,14), name: file.slice(15,-4), sha256: sha256(readFileSync(join(process.argv[3], file))),
    }));
    console.log(JSON.stringify(reconcileMigrations(inventory.migrations, local), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
