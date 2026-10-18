import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync, lstatSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

export const BLOCKED_PROJECT_REFS = ["scghaxpgsibpffbukyws", "gxhdklnqyxvcahngljcx"];
export const PRODUCTION_VERCEL_PROJECT = "prj_h7KHFmz7Nb7nsRBNFLlQ2o8kHDAV";
export const STAGING_CONFIG = 'project_id = "crm-isolated-staging"\n[db.seed]\nenabled = false\n';
export const sha256 = value => createHash("sha256").update(value).digest("hex");
function check(condition, message) { if (!condition) throw new Error(message); }

export function validateManifest(manifest) {
  check(manifest?.version === 1 && manifest.environment === "staging", "A versioned staging manifest is required.");
  check(/^[a-z]{20}$/.test(manifest.projectRef) && !BLOCKED_PROJECT_REFS.includes(manifest.projectRef),
    "Production and unrelated projects are not staging targets.");
  check(/^prj_[A-Za-z0-9]+$/.test(manifest.vercelProjectId) && manifest.vercelProjectId !== PRODUCTION_VERCEL_PROJECT,
    "A distinct staging Vercel project is required.");
  const origin = new URL(manifest.appOrigin);
  check(origin.protocol === "https:" && origin.origin === manifest.appOrigin &&
    !origin.username && !origin.password &&
    !/(^|\.)app\.daneff\.com$|^daneff(?:[-.]|$)/i.test(origin.hostname),
    "Use an exact isolated HTTPS application origin.");
  check(typeof manifest.reviewedBy === "string" && manifest.reviewedBy.trim().length > 0 &&
    Number.isFinite(Date.parse(manifest.reviewedAt)), "Named, dated review is required.");
  check(manifest.baseline?.sourceRef === "scghaxpgsibpffbukyws" &&
    /^[a-f0-9]{64}$/.test(manifest.baseline.sha256) &&
    typeof manifest.baseline.file === "string", "A reviewed schema-only baseline hash is required.");
  check(manifest.baseline.reviewedSchemaOnly === true, "Baseline must be reviewed as schema-only.");
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXTAUTH_SECRET"]) {
    check(/^[a-f0-9]{64}$/.test(manifest.credentialSha256?.[key]), "Reviewed staging credential fingerprints are required.");
  }
  check(Array.isArray(manifest.migrations) && manifest.migrations.length > 0, "An explicit migration allowlist is required.");
  const names = new Set(), versions = new Set();
  for (const migration of manifest.migrations) {
    check(typeof migration.file === "string" && migration.file === basename(migration.file) &&
      /^\d{14}_[a-z0-9_]+\.sql$/.test(migration.file), "Migration paths must be plain filenames.");
    check(/^[a-f0-9]{64}$/.test(migration.sha256), "Migration SHA-256 is required.");
    check(!names.has(migration.file) && !versions.has(migration.file.slice(0, 14)), "Duplicate migration/version.");
    names.add(migration.file); versions.add(migration.file.slice(0, 14));
  }
  return manifest;
}

export function readWithin(root, relative) {
  check(typeof relative === "string" && relative.length > 0, "A relative file is required.");
  const realRoot = realpathSync(root);
  const path = resolve(realRoot, relative);
  check(path.startsWith(realRoot + sep) && !lstatSync(path).isSymbolicLink(), "File escapes the reviewed directory.");
  check(realpathSync(path) === path, "Symlinked inputs are not permitted.");
  return readFileSync(path);
}

export function verifyBundle(directory) {
  const manifest = validateManifest(JSON.parse(readWithin(directory, "manifest.json").toString("utf8")));
  check(readWithin(directory, "supabase/config.toml").toString("utf8") === STAGING_CONFIG,
    "CLI configuration differs from the isolated staging configuration.");
  check(sha256(readWithin(directory, "baseline.sql")) === manifest.baseline.sha256, "Baseline changed after review.");
  const migrationsDir = join(directory, "supabase", "migrations");
  const files = readdirSync(migrationsDir).sort();
  check(JSON.stringify(files) === JSON.stringify(manifest.migrations.map(m => m.file).sort()),
    "Migration directory differs from the approved pending set.");
  for (const migration of manifest.migrations) {
    check(sha256(readWithin(directory, join("supabase", "migrations", migration.file))) === migration.sha256,
      "Migration changed after review.");
  }
  return manifest;
}

export function verifyLinkedTarget(directory, manifest) {
  const linked = readWithin(directory, "supabase/.temp/project-ref").toString("utf8").trim();
  check(linked === manifest.projectRef && !BLOCKED_PROJECT_REFS.includes(linked), "CLI link does not match staging.");
  const project = JSON.parse(readWithin(directory, "supabase/.temp/linked-project.json").toString("utf8"));
  check(project.ref === linked, "Cached project metadata does not match staging.");
  let database;
  try { database = new URL(readWithin(directory, "supabase/.temp/pooler-url").toString("utf8").trim()); }
  catch { throw new Error("A valid cached staging database connection is required."); }
  const isPooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(database.hostname) &&
    database.username === `postgres.${linked}`;
  const isDirect = database.hostname === `db.${linked}.supabase.co` && database.username === "postgres";
  check(["postgres:", "postgresql:"].includes(database.protocol) && (isPooler || isDirect) &&
    database.port === "5432" && database.pathname === "/postgres" && !database.search && !database.hash,
    "Cached database connection does not match the staging project/session port.");
}

export function validateStagingEnvironment(manifest, env) {
  validateManifest(manifest);
  const expectedUrl = `https://${manifest.projectRef}.supabase.co`;
  check(env.NEXT_PUBLIC_SUPABASE_URL === expectedUrl &&
    (!env.SUPABASE_URL || env.SUPABASE_URL === expectedUrl), "Server/browser database target mismatch.");
  check(env.NEXTAUTH_URL === manifest.appOrigin &&
    (!env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL === manifest.appOrigin), "Application origin mismatch.");
  check(env.VERCEL_PROJECT_ID === manifest.vercelProjectId, "Deployment project mismatch.");
  check(typeof env.NEXTAUTH_SECRET === "string" && env.NEXTAUTH_SECRET.length >= 32, "An independent staging session secret is required.");
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXTAUTH_SECRET"]) {
    check(typeof env[key] === "string" && env[key].length > 0 &&
      sha256(env[key]) === manifest.credentialSha256[key], `Staging credential fingerprint mismatch: ${key}`);
  }
  check(!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Unexpected alternate public Supabase credential.");
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
    check(env[key] === "disabled-in-crm-staging", "OAuth must use disabled staging placeholders until subject mapping is proven.");
  }
  for (const [key, value] of Object.entries(env)) {
    if (value && /^(DEV_AUTH_EMAIL|CRON_SECRET|AGENT_|GHL_|ghl_|INSTAGRAM_|STRIPE_|TWILIO_|RESEND_|APPLE_|OPENAI_API_KEY|CHATGPT_API_KEY|MCP_OAUTH_SECRET|DATABASE_URL|POSTGRES_|SUPABASE_DB_)/.test(key)) {
      throw new Error(`Unexpected provider, database, automation or bypass setting: ${key}`);
    }
  }
  return true;
}
