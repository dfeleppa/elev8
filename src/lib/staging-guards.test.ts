import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { afterAll, expect, it } from "vitest";
import { sha256, validateManifest, validateStagingEnvironment, verifyBundle, STAGING_CONFIG } from "../../scripts/crm-staging/guards.mjs";
import { prepareBundle } from "../../scripts/crm-staging/prepare.mjs";
import { dryRunArguments } from "../../scripts/crm-staging/dry-run.mjs";
import { reconcileMigrations } from "../../scripts/crm-staging/reconcile.mjs";
import { compareInventories } from "../../scripts/crm-staging/compare-inventory.mjs";

const root = mkdtempSync(join(tmpdir(), "elev8-staging-tests-"));
const file = "20261017114730_crm_contacts_foundation.sql";
const baseline = "create table public.app_users(id uuid primary key);";
const migration = "create table public.test_contact(id uuid primary key);";
mkdirSync(join(root, "supabase", "migrations"), { recursive: true });
writeFileSync(join(root, "baseline.sql"), baseline);
writeFileSync(join(root, "supabase", "migrations", file), migration);
const manifest = {
  version: 1, environment: "staging", projectRef: "abcdefghijklmnopqrst",
  vercelProjectId: "prj_isolatedStage", appOrigin: "https://elev8-stage.example.invalid",
  reviewedBy: "Synthetic reviewer", reviewedAt: "2026-10-17T23:00:00Z",
  credentialSha256: {
    SUPABASE_SERVICE_ROLE_KEY: sha256("synthetic-private-key"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: sha256("synthetic-public-key"),
    NEXTAUTH_SECRET: sha256("synthetic-session-secret-32-characters-long"),
  },
  baseline: { sourceRef: "scghaxpgsibpffbukyws", file: "baseline.sql", sha256: sha256(baseline), reviewedSchemaOnly: true },
  migrations: [{ file, sha256: sha256(migration) }],
};
const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXTAUTH_URL: manifest.appOrigin, NEXTAUTH_SECRET: "synthetic-session-secret-32-characters-long",
  VERCEL_PROJECT_ID: manifest.vercelProjectId,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-private-key", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-key",
  GOOGLE_CLIENT_ID: "disabled-in-crm-staging", GOOGLE_CLIENT_SECRET: "disabled-in-crm-staging",
};
afterAll(() => {
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.includes("elev8-staging-tests-")) throw new Error("Unexpected cleanup path");
  rmSync(root, { recursive: true, force: true });
});
function bundle(name: string) {
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
  return prepareBundle("manifest.json", name, root);
}
function link(directory: string) {
  const cache = join(directory, "supabase", ".temp");
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, "project-ref"), manifest.projectRef);
  writeFileSync(join(cache, "linked-project.json"), JSON.stringify({ ref: manifest.projectRef }));
  writeFileSync(join(cache, "pooler-url"), `postgresql://postgres.${manifest.projectRef}@aws-1-us-east-1.pooler.supabase.com:5432/postgres`);
  return cache;
}
it("prepares only hash-approved local files, without linking a hosted project", () => {
  const directory = bundle("approved");
  expect(verifyBundle(directory).projectRef).toBe(manifest.projectRef);
  expect(readFileSync(join(directory, "baseline.sql"), "utf8")).toBe(baseline);
  expect(() => dryRunArguments(directory)).toThrow();
});
it.each(["scghaxpgsibpffbukyws", "gxhdklnqyxvcahngljcx", "", "https://stage.supabase.co"])("rejects forbidden or invalid project %s", projectRef => {
  expect(() => validateManifest({ ...manifest, projectRef })).toThrow();
});
it.each(["https://app.daneff.com", "https://daneff.vercel.app", "https://daneff-git-main-dfeleppa.vercel.app", "http://stage.invalid", "https://stage.invalid/path", "https://user:pass@stage.invalid"])("rejects unsafe origin %s", appOrigin => {
  expect(() => validateManifest({ ...manifest, appOrigin })).toThrow();
});
it("requires independent Vercel project, schema-only review and unique migration versions", () => {
  expect(() => validateManifest({ ...manifest, vercelProjectId: "prj_h7KHFmz7Nb7nsRBNFLlQ2o8kHDAV" })).toThrow();
  expect(() => validateManifest({ ...manifest, reviewedBy: "" })).toThrow();
  expect(() => validateManifest({ ...manifest, baseline: { ...manifest.baseline, reviewedSchemaOnly: false } })).toThrow();
  expect(() => validateManifest({ ...manifest, migrations: [...manifest.migrations, ...manifest.migrations] })).toThrow();
});
it("rejects tampering, unexpected files and a production-linked work directory", () => {
  const directory = bundle("tampered");
  writeFileSync(join(directory, "supabase", "migrations", file), migration + "-- changed");
  expect(() => verifyBundle(directory)).toThrow(/changed/);
  writeFileSync(join(directory, "supabase", "migrations", file), migration);
  writeFileSync(join(directory, "supabase", "migrations", "unexpected.sql"), "select 1;");
  expect(() => verifyBundle(directory)).toThrow(/approved pending set/);
  rmSync(join(directory, "supabase", "migrations", "unexpected.sql"));
  mkdirSync(join(directory, "supabase", ".temp"));
  writeFileSync(join(directory, "supabase", ".temp", "project-ref"), "scghaxpgsibpffbukyws");
  expect(() => dryRunArguments(directory)).toThrow(/does not match/);
  link(directory);
  expect(dryRunArguments(directory)).toEqual(["db", "push", "--linked", "--dry-run", "--workdir", resolve(directory)]);
});
it("rejects a disguised production connection even when the project-ref file says staging", () => {
  const directory = bundle("disguised");
  const cache = link(directory);
  writeFileSync(join(cache, "linked-project.json"), JSON.stringify({ ref: "scghaxpgsibpffbukyws" }));
  expect(() => dryRunArguments(directory)).toThrow(/metadata/);
  link(directory);
  writeFileSync(join(cache, "pooler-url"), "postgresql://postgres.scghaxpgsibpffbukyws@aws-1-us-east-1.pooler.supabase.com:5432/postgres");
  expect(() => dryRunArguments(directory)).toThrow(/connection/);
});
it.each([
  "postgresql://postgres@db.scghaxpgsibpffbukyws.supabase.co:5432/postgres",
  "postgresql://postgres.abcdefghijklmnopqrst@evil.pooler.supabase.com.attacker.invalid:5432/postgres",
  "postgresql://postgres.abcdefghijklmnopqrst@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.abcdefghijklmnopqrst@aws-1-us-east-1.pooler.supabase.com:5432/postgres?host=production",
])("rejects unexpected cached database target %s", url => {
  const directory = bundle("cache-" + sha256(url).slice(0, 8));
  const cache = link(directory);
  writeFileSync(join(cache, "pooler-url"), url);
  expect(() => dryRunArguments(directory)).toThrow(/connection/);
});
it("detects an altered CLI configuration and accepts a matching direct database cache", () => {
  const directory = bundle("configuration");
  const cache = link(directory);
  writeFileSync(join(directory, "supabase", "config.toml"), STAGING_CONFIG.replace("false", "true"));
  expect(() => dryRunArguments(directory)).toThrow(/configuration/);
  writeFileSync(join(directory, "supabase", "config.toml"), STAGING_CONFIG);
  writeFileSync(join(cache, "pooler-url"), `postgresql://postgres@db.${manifest.projectRef}.supabase.co:5432/postgres`);
  expect(dryRunArguments(directory)).toContain("--dry-run");
});
it("will not overwrite a bundle or escape its directory", () => {
  bundle("existing");
  expect(() => bundle("existing")).toThrow(/new staging bundle/);
  expect(() => bundle("../escaped")).toThrow();
  expect(() => validateManifest({ ...manifest, migrations: [{ file: "../" + file, sha256: sha256(migration) }] })).toThrow();
});
it("checks environment targets before a client can be constructed", () => {
  expect(validateStagingEnvironment(manifest, env)).toBe(true);
  expect(() => validateStagingEnvironment(manifest, { ...env, SUPABASE_URL: "https://scghaxpgsibpffbukyws.supabase.co" })).toThrow();
  expect(() => validateStagingEnvironment(manifest, { ...env, VERCEL_PROJECT_ID: "prj_h7KHFmz7Nb7nsRBNFLlQ2o8kHDAV" })).toThrow();
  expect(() => validateStagingEnvironment(manifest, { ...env, SUPABASE_SERVICE_ROLE_KEY: "wrong-project-key" })).toThrow(/fingerprint/);
  expect(() => validateStagingEnvironment(manifest, { ...env, GOOGLE_CLIENT_ID: "inherited-client-id" })).toThrow(/OAuth/);
});
it.each(["CRON_SECRET", "DEV_AUTH_EMAIL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ghl_conversations_key", "POSTGRES_URL", "AGENT_NUTRITION_TOKEN"])("rejects inherited %s without printing its value", key => {
  expect(() => validateStagingEnvironment(manifest, { ...env, [key]: "never-log-this-value" })).toThrow(key);
  try { validateStagingEnvironment(manifest, { ...env, [key]: "never-log-this-value" }); }
  catch (error) { expect(String(error)).not.toContain("never-log-this-value"); }
});
it("classifies renamed history without repairing or pretending it is applied", () => {
  const result = reconcileMigrations(
    [{ version: "2", name: "same" }, { version: "3", name: "remote" }],
    [{ version: "1", name: "same" }, { version: "4", name: "local" }],
  );
  expect(result.renamedCandidates).toHaveLength(1);
  expect(result.renamedCandidates[0].disposition).toBe("review-required");
  expect(result.remoteOnly.map((r: { name: string }) => r.name)).toEqual(["remote"]);
  expect(result.localOnly.map((r: { name: string }) => r.name)).toEqual(["local"]);
});

it("compares captured metadata independently of time/order and detects RLS drift", () => {
  const inventory = JSON.parse(readFileSync("docs/crm-evidence/2026-10-17-production-inventory.json", "utf8"));
  const stage = structuredClone(inventory);
  stage.capturedAt = "later"; stage.sourceRef = manifest.projectRef;
  stage.tables.reverse();
  expect(compareInventories(inventory, stage).matches).toBe(true);
  stage.tables[0].rls = !stage.tables[0].rls;
  expect(compareInventories(inventory, stage)).toMatchObject({ matches: false, differences: ["tables"] });
  delete stage.triggers;
  expect(() => compareInventories(inventory, stage)).toThrow(/Missing/);
});
