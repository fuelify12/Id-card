#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "supabase/recovery/phase29-authoritative-migration-ledger.json");
const migrationsDir = join(root, "supabase/migrations");
const recoveryDir = join(root, "supabase/recovery");
const fail = [];
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const canonical = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const parsed = canonical.map((file) => {
  const match = file.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) fail.push(`Invalid canonical migration filename: ${file}`);
  return match ? { version: match[1], name: match[2], file } : null;
}).filter(Boolean);
const versions = parsed.map((x) => x.version);
if (new Set(versions).size !== versions.length) fail.push("Duplicate canonical migration version.");
if (!versions.every((v, i) => i === 0 || versions[i - 1] < v)) fail.push("Canonical migration versions are not strictly increasing.");
const ledgerVersions = manifest.migrations.map((x) => x.version);
if (new Set(ledgerVersions).size !== ledgerVersions.length) fail.push("Duplicate authoritative ledger version.");
if (!ledgerVersions.every((v, i) => i === 0 || ledgerVersions[i - 1] < v)) fail.push("Authoritative ledger versions are not strictly increasing.");
for (const entry of manifest.migrations) {
  if (!existsSync(join(root, entry.path))) fail.push(`Missing canonical ledger file: ${entry.path}`);
}
const snapshotNames = parsed.filter((x) => /snapshot/i.test(x.name));
if (snapshotNames.length) fail.push(`Snapshot-like files are in canonical migrations and would be replayed as ordinary migrations: ${snapshotNames.map(x => x.file).join(", ")}`);
const recoveredSnapshotChunks = readdirSync(recoveryDir).filter((x) => /^phase28_snapshot/.test(x));
if (!recoveredSnapshotChunks.length) console.warn("No Phase 28 recovery snapshot chunks found; check whether the baseline history is intentionally incomplete.");
console.log(`Canonical SQL migration files: ${parsed.length}`);
console.log(`Authoritative ledger entries: ${ledgerVersions.length}`);
console.log(`Recovery snapshot chunks outside canonical migration directory: ${recoveredSnapshotChunks.length}`);
console.log("This inventory check does not establish SQL replay correctness; the following disposable Supabase replay is required.");
if (fail.length) {
  for (const error of fail) console.error(`FAIL: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Migration inventory and ordering checks: PASS");
}
