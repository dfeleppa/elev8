import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditInventory, reconcileMigrations } from './crm-staging-audit.mjs';

test('separates timestamp drift, conflicting names, and absent migrations', () => {
  const local = [
    { version: '20260101000000', name: 'same' },
    { version: '20260102000000', name: 'renumbered' },
    { version: '20260103000000', name: 'conflict' },
    { version: '20260104000000', name: 'pending' },
  ];
  const remote = [local[0], { version: '20260102111111', name: 'renumbered' },
    { version: local[2].version, name: 'other_sql' }, { version: '20260105000000', name: 'unknown' }];
  const result = reconcileMigrations(local, remote);
  assert.deepEqual(result.exact, [local[0]]);
  assert.deepEqual(result.timestampDrift, [{ local: local[1], remote: remote[1] }]);
  assert.deepEqual(result.nameMismatch, [{ local: local[2], remote: remote[2] }]);
  assert.deepEqual(result.localOnly, [local[3]]);
  assert.deepEqual(result.remoteOnly, [remote[3]]);
});

test('rejects malformed, incomplete and duplicate inventories', () => {
  assert.throws(() => reconcileMigrations([], [{ version: 'bad', name: 'migration' }]));
  const migration = { version: '20260101000000', name: 'a' };
  assert.throws(() => reconcileMigrations([migration, migration], []));
  assert.throws(() => auditInventory({ project_ref: 'stage', captured_at: new Date().toISOString() }, []));
});

test('a matching empty ledger cannot report a usable schema or safe identity state', () => {
  const result = auditInventory({ project_ref: 'stage', captured_at: new Date().toISOString(),
    migrations: [], columns: [], constraints: [], auth_providers: [],
    identity: { app_users: 3, linked: 1, unlinked: 2, null_roles: 1, unknown_roles: 0 },
    duplicate_links: 1, orphan_links: 1 }, []);
  assert.ok(result.issues.includes('crm_contacts is absent.'));
  assert.ok(result.issues.some(issue => issue.includes('app_users.id')));
  assert.ok(result.issues.some(issue => issue.includes('unlinked: 2')));
  assert.ok(result.issues.some(issue => issue.includes('duplicate_links: 1')));
  assert.ok(result.issues.some(issue => issue.includes('orphan_links: 1')));
  assert.ok(result.hosted_verification.startsWith('Unverified'));
});

test('ambiguous repeated names remain unresolved rather than inferred as equivalent', () => {
  const result = reconcileMigrations([{ version: '20260101000000', name: 'same' }], [
    { version: '20260102000000', name: 'same' }, { version: '20260103000000', name: 'same' },
  ]);
  assert.equal(result.timestampDrift.length, 0);
  assert.equal(result.localOnly.length, 1);
  assert.equal(result.remoteOnly.length, 2);
  const inverse = reconcileMigrations([
    { version: '20260102000000', name: 'same' }, { version: '20260103000000', name: 'same' },
  ], [{ version: '20260101000000', name: 'same' }]);
  assert.equal(inverse.timestampDrift.length, 0);
  assert.equal(inverse.localOnly.length, 2);
  assert.equal(inverse.remoteOnly.length, 1);
});
