import { mkdirSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateManifest, readWithin, sha256, verifyBundle, STAGING_CONFIG } from "./guards.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
export function prepareBundle(manifestPath, output, root = repoRoot) {
  const manifest = validateManifest(JSON.parse(readWithin(root, manifestPath).toString("utf8")));
  const baseline = readWithin(root, manifest.baseline.file);
  if (sha256(baseline) !== manifest.baseline.sha256) throw new Error("Baseline changed after review.");
  const sources = manifest.migrations.map(m => {
    const contents = readWithin(root, join("supabase", "migrations", m.file));
    if (sha256(contents) !== m.sha256) throw new Error("Migration changed after review.");
    return { ...m, contents };
  });
  const parent = join(realpathSync(root), ".codex-crm-staging");
  const destination = resolve(parent, output);
  if (!destination.startsWith(parent + sep) || existsSync(destination)) throw new Error("Use a new staging bundle directory.");
  mkdirSync(parent, { recursive: true });
  if (realpathSync(parent) !== parent) throw new Error("Staging directory cannot be a symlink.");
  // Restrict to one new child: no unreviewed nested symlink path.
  if (resolve(parent, output) !== join(parent, output) || /[/\\]/.test(output) || output === "..") throw new Error("Use a simple bundle name.");
  mkdirSync(join(destination, "supabase", "migrations"), { recursive: true });
  writeFileSync(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  writeFileSync(join(destination, "baseline.sql"), baseline, { flag: "wx" });
  writeFileSync(join(destination, "supabase", "config.toml"),
    STAGING_CONFIG, { flag: "wx" });
  for (const source of sources) writeFileSync(join(destination, "supabase", "migrations", source.file), source.contents, { flag: "wx" });
  verifyBundle(destination);
  return destination;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node scripts/crm-staging/prepare.mjs <reviewed-manifest-relative-path> <new-bundle-name>");
    console.log(prepareBundle(process.argv[2], process.argv[3]));
    console.log("Prepared files only. No project was linked or database changed.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
