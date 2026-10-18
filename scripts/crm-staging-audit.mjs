import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Compare ledger identifiers only. Matching names do not prove matching SQL. */
export function reconcileMigrations(local, remote) {
  for (const list of [local, remote]) {
    if (!Array.isArray(list) || list.some(row => !/^\d{14}$/.test(row.version) || typeof row.name !== 'string' || !row.name)) {
      throw new Error('Expected a complete migration inventory with 14-digit versions and names.');
    }
    if (new Set(list.map(row => row.version)).size !== list.length) throw new Error('Duplicate migration versions require manual review.');
  }
  const exact = [], timestampDrift = [], nameMismatch = [], localOnly = [], remoteOnly = [];
  const consumed = new Set();
  for (const row of local) {
    const sameVersion = remote.find(candidate => candidate.version === row.version);
    if (sameVersion) {
      consumed.add(sameVersion.version);
      if (sameVersion.name === row.name) exact.push(row);
      else nameMismatch.push({ local: row, remote: sameVersion });
      continue;
    }
    const sameName = remote.filter(candidate => candidate.name === row.name && !local.some(item => item.version === candidate.version));
    if (sameName.length === 1 && local.filter(candidate => candidate.name === row.name).length === 1) {
      consumed.add(sameName[0].version);
      timestampDrift.push({ local: row, remote: sameName[0] });
    } else localOnly.push(row);
  }
  for (const row of remote) if (!consumed.has(row.version)) remoteOnly.push(row);
  return { exact, timestampDrift, nameMismatch, localOnly, remoteOnly };
}

export function auditInventory(inventory, local) {
  if (!inventory || typeof inventory.project_ref !== 'string' || !inventory.project_ref || !Number.isFinite(Date.parse(inventory.captured_at))) throw new Error('Project reference and capture timestamp are required.');
  for (const key of ['app_users', 'linked', 'unlinked', 'null_roles', 'unknown_roles']) {
    if (!Number.isSafeInteger(inventory.identity?.[key]) || inventory.identity[key] < 0) throw new Error(`Missing identity count: ${key}`);
  }
  for (const key of ['duplicate_links', 'orphan_links']) if (!Number.isSafeInteger(inventory[key]) || inventory[key] < 0) throw new Error(`Missing count: ${key}`);
  if (inventory.identity.linked + inventory.identity.unlinked !== inventory.identity.app_users) throw new Error('Inconsistent identity totals.');
  if (!Array.isArray(inventory.columns) || !Array.isArray(inventory.constraints) || !Array.isArray(inventory.auth_providers)) throw new Error('Incomplete schema/provider inventory.');
  const migrations = reconcileMigrations(local, inventory.migrations);
  const issues = [];
  for (const key of ['timestampDrift', 'nameMismatch', 'localOnly', 'remoteOnly']) if (migrations[key].length) issues.push(`Migration ${key}: ${migrations[key].length}; review SQL and provenance before any replay or repair.`);
  const required = { id: 'uuid', supabase_auth_uid: 'uuid', email: 'text', full_name: 'text', role: 'text', password_hash: 'text', updated_at: 'timestamp with time zone' };
  for (const [name, type] of Object.entries(required)) {
    const column = inventory.columns.find(row => row.table_name === 'app_users' && row.column_name === name);
    if (column?.data_type !== type) issues.push(`Missing/incompatible app_users.${name}; expected ${type}.`);
  }
  if (!inventory.constraints.some(row => row.table_name === 'app_users' && row.type === 'p' && row.definition === 'PRIMARY KEY (id)')) issues.push('Canonical application UUID primary key is not established.');
  if (!inventory.constraints.some(row => row.table_name === 'app_users' && row.type === 'u' && row.definition === 'UNIQUE (supabase_auth_uid)')) issues.push('Unique Auth UID constraint is not established.');
  if (!inventory.columns.some(row => row.table_name === 'crm_contacts')) issues.push('crm_contacts is absent.');
  for (const key of ['unlinked', 'null_roles', 'unknown_roles']) if (inventory.identity[key]) issues.push(`Identity ${key}: ${inventory.identity[key]}; trusted review required.`);
  for (const key of ['duplicate_links', 'orphan_links']) if (inventory[key]) issues.push(`${key}: ${inventory[key]}; trusted review required.`);
  return {
    project_ref: inventory.project_ref, captured_at: inventory.captured_at,
    scope: 'Read-only prerequisites; never proves staging isolation, SQL parity, OAuth ownership, hosted login or iPhone behavior.',
    migrations, identity: inventory.identity, duplicate_links: inventory.duplicate_links,
    orphan_links: inventory.orphan_links, auth_providers: inventory.auth_providers, issues,
    hosted_verification: 'Unverified: requires distinct staging target, reviewed baseline, deployed browser and native/device evidence.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const inventoryPath = process.argv[2];
    if (!inventoryPath) throw new Error('Usage: node scripts/crm-staging-audit.mjs <sanitized-inventory.json>');
    const local = readdirSync(resolve('supabase/migrations')).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort().map(name => ({ version: name.slice(0, 14), name: name.slice(15, -4) }));
    const report = auditInventory(JSON.parse(readFileSync(inventoryPath, 'utf8')), local);
    console.log(JSON.stringify(report, null, 2));
    // Nonzero is an unresolved prerequisite, never an invitation to repair history.
    if (report.issues.length) process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid audit input.');
    process.exitCode = 1;
  }
}
