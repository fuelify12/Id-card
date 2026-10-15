#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "supabase", "recovery", "phase29-authoritative-migration-ledger.json");
const migrationsDir = join(root, "supabase", "migrations");
const errors = [];
const requireThat = (condition, message) => { if (!condition) errors.push(message); };
if (!existsSync(manifestPath)) {
  console.error("Missing authoritative migration manifest.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
requireThat(manifest.schema_version === 1, "Unsupported migration manifest schema version.");
requireThat(manifest.migrations.length === 39, `Expected 39 authoritative ledger rows; found ${manifest.migrations.length}.`);
const seen = new Set();
let previous = "";
for (const entry of manifest.migrations) {
  requireThat(!seen.has(entry.version), `Duplicate authoritative version ${entry.version}.`);
  seen.add(entry.version);
  requireThat(entry.version > previous, `Authoritative ledger order is not strictly increasing at ${entry.version}.`);
  previous = entry.version;
  requireThat(entry.path === `supabase/migrations/${entry.version}_${entry.name}.sql`, `Unexpected path for ${entry.version}.`);
  if (!existsSync(join(root, entry.path))) {
    errors.push(`Missing authoritative migration file: ${entry.path}`);
    continue;
  }
  const sql = readFileSync(join(root, entry.path), "utf8");
  const md5 = createHash("md5").update(sql, "utf8").digest("hex");
  requireThat(sql.length === entry.characters, `${entry.path}: character count ${sql.length} != source ${entry.characters}.`);
  requireThat(md5 === entry.md5, `${entry.path}: MD5 ${md5} != authoritative source ${entry.md5}.`);
}
const filenames = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const versions = filenames.map((name) => name.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1] ?? "");
requireThat(versions.every(Boolean), "One or more canonical migration filenames do not follow YYYYMMDDHHMMSS_name.sql.");
requireThat(versions.every((v, i) => i === 0 || versions[i - 1] < v), "Canonical migration versions are not strictly increasing and unique.");
requireThat(existsSync(join(root, "supabase", "recovery", "phase29_superseded_migration_candidates", "20261010115000_phase18_batch_worker_recovery.sql")), "Superseded Phase 18 candidate was not preserved outside the canonical migration directory.");
requireThat(existsSync(join(root, "supabase", "recovery", "phase29_superseded_migration_candidates", "20261009100225_phase13_audit_status_metadata.sql")), "Superseded Phase 13 audit-metadata candidate was not preserved outside the canonical migration directory.");
requireThat(!filenames.some((name) => name.startsWith("20261010115000_phase18_batch_worker_recovery")), "Superseded Phase 18 candidate must not be replayed as a canonical migration.");
requireThat(existsSync(join(migrationsDir, "20261010125420_phase18_batch_worker_recovery.sql")), "Authoritative Phase 18 migration version is missing.");
console.log(`Authoritative Production migration rows checked: ${manifest.migrations.length}`);
console.log(`Canonical migration files inspected: ${filenames.length}`);
if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Authoritative migration ledger checksum contract: PASS");
}
