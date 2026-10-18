// Offline inspection only. This is NOT a GHL export parser or production importer.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function inspect(input) {
  assert.equal(typeof input.location_id, 'string', 'Explicit location_id required');
  assert.ok(input.location_id.trim(), 'Nonempty location_id required');
  assert.ok(Array.isArray(input.contacts), 'contacts must be an array');
  const groups = new Map();
  for (const contact of input.contacts) {
    assert.ok(contact && typeof contact === 'object' && !Array.isArray(contact), 'Invalid contact');
    assert.ok(typeof contact.source_id === 'string' && contact.source_id.trim(), 'Stable source_id required');
    const rows = groups.get(contact.source_id) ?? [];
    rows.push(contact);
    groups.set(contact.source_id, rows);
  }
  const records = [];
  for (const [sourceId, rows] of groups) {
    // Structural key order does not turn an identical row into a conflict.
    const canonical = row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
    const versions = new Set(rows.map(canonical));
    const first = rows[0];
    const issues = [];
    if (versions.size > 1) issues.push('conflicting_source_id');
    const name = typeof first.full_name === 'string' ? first.full_name.trim() : '';
    const email = typeof first.email === 'string' ? first.email.trim().toLowerCase() : '';
    const phone = typeof first.phone === 'string' ? first.phone.trim() : '';
    if (!name || name.length > 160) issues.push('invalid_name');
    if (!email && !phone) issues.push('missing_channel');
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) issues.push('invalid_email');
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) issues.push('invalid_phone');
    if ([first.email, first.phone].some(v => v != null && typeof v !== 'string')) issues.push('invalid_channel_type');
    const digest = hash(JSON.stringify(['ghl', input.location_id, sourceId]));
    // Stable UUID-shaped preview ID, kept separate from any Auth/app user ID.
    const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
    records.push({ sourceId, id, email, phone, issues,
      suppressed: rows.some(row => row.dnd === true), outboundEligible: false });
  }
  for (const field of ['email', 'phone']) {
    const channels = new Map();
    for (const record of records) {
      if (!record[field]) continue;
      const matches = channels.get(record[field]) ?? [];
      matches.push(record);
      channels.set(record[field], matches);
    }
    for (const matches of channels.values()) {
      if (matches.length > 1) for (const record of matches) record.issues.push(`shared_${field}`);
    }
  }
  return records.sort((a,b) => a.sourceId.localeCompare(b.sourceId));
}

try {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/crm-ghl-rehearsal.mjs <private-or-synthetic.json>');
  const bytes = readFileSync(process.argv[2]);
  const input = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const records = inspect(input);
  assert.deepEqual(inspect(input), records, 'Replay mapping changed');
  assert.equal(new Set(records.map(row => row.id)).size, records.length, 'Mapping collision');
  const issueCounts = {};
  for (const row of records) for (const issue of new Set(row.issues)) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  const duplicateRows = input.contacts.length - new Set(input.contacts.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))))).size;
  const summary = {
    mode: 'offline-preview-only', synthetic: input.synthetic === true,
    sourceSha256: hash(bytes), inputRows: input.contacts.length,
    uniqueSourceIds: records.length, exactDuplicateRows: duplicateRows,
    validContactPreviews: records.filter(row => row.issues.length === 0).length,
    quarantinedContacts: records.filter(row => row.issues.length > 0).length,
    suppressedSourceContacts: records.filter(row => row.suppressed).length,
    outboundEligible: 0, replayMappingStable: true, issueCounts,
    productionImportReady: false,
    limitation: 'No database import. Source mappings, consent, custom fields and history need durable schema and review.'
  };
  console.log(JSON.stringify(summary, null, 2));
} catch {
  // Do not echo private filenames, raw fields or parser error snippets.
  console.error('Rehearsal rejected: supply a valid canonical JSON file with location_id and contacts containing stable source_id values. No writes performed.');
  process.exitCode = 1;
}
