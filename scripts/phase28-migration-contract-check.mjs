#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const recoveryDir = join(root, "supabase", "recovery");
const snapshotPath = join(recoveryDir, "phase28_current_production_schema_snapshot.sql");
const chunkDir = join(recoveryDir, "phase28_snapshot");
const historicalBaseline = join(migrationsDir, "20261008173336_phase1_foundation.sql");
const allowRecovery = process.argv.includes("--allow-recovery-snapshot");
const strict = process.argv.includes("--strict") || !allowRecovery;
const errors = [];
const warnings = [];

function requireThat(condition, message) {
  if (!condition) errors.push(message);
}
function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}
function read(path, label) {
  if (!existsSync(path)) {
    errors.push(`Missing required ${label}: ${path.replace(root + "/", "")}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const migrations = migrationFiles.map((name) => {
  const match = name.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) errors.push(`Migration filename does not follow YYYYMMDDHHMMSS_name.sql: ${name}`);
  return match ? { name, version: match[1] } : { name, version: "" };
});
const versions = migrations.map((m) => m.version).filter(Boolean);
requireThat(versions.every((v, i) => i === 0 || versions[i - 1] < v),
  "Migration timestamps are not strictly increasing or contain duplicates.");
console.log(`Migration filename/order check: ${migrations.length} tracked SQL files inspected.`);

if (existsSync(historicalBaseline)) {
  const original = read(historicalBaseline, "historical Phase 1 migration");
  requireThat(/create table\s+(?:if not exists\s+)?(?:public\.)?["']?school_projects/i.test(original),
    "The recovered Phase 1 migration does not contain the expected school-project foundation; review manually.");
  console.log("Historical Phase 1 baseline: PRESENT (content still requires human review before claiming full chain validation).");
} else {
  warnings.push("AUTHORITATIVE BASELINE MISSING: supabase/migrations/20261008173336_phase1_foundation.sql was not found in reachable repository history.");
  if (strict) errors.push("Strict mode refuses an absent original Phase 1 baseline. Use --allow-recovery-snapshot only for the explicitly documented isolated recovery path.");
  const snapshot = read(snapshotPath, "separately documented current-schema snapshot");
  requireThat(/NOT represented as the original Phase 1 migration/i.test(snapshot),
    "The fallback schema snapshot must clearly state that it is not the original Phase 1 migration.");
  for (const file of [
    "01_create_tables.sql",
    "02_constraints_indexes.sql",
    "03_create_functions.sql",
    "04_function_table_privileges.sql",
    "05_rls_and_private_buckets.sql",
    "06_policies_and_triggers.sql",
  ]) read(join(chunkDir, file), "recovery snapshot chunk");
  warnings.push("The current-schema snapshot is an isolated bootstrap workaround, not a replay of historical Phase 1–24 migrations.");
}

const snapshot = read(snapshotPath, "current-schema snapshot");
const expectedCounts = [
  ["public tables", /^\s*create table public\./gim, 15],
  ["indexes", /^\s*create (?:unique )?index if not exists /gim, 67],
  ["foreign keys", /^\s*alter table public\..* add constraint .* foreign key /gim, 64],
  ["public routines", /^\s*create or replace function public\./gim, 14],
  ["RLS policies", /^\s*create policy /gim, 27],
  ["triggers", /^\s*create trigger /gim, 15],
  ["custom RLS DDL event triggers", /^\s*create event trigger ensure_rls/gim, 1],
  ["RLS-enabled tables", /^\s*alter table public\..* enable row level security;/gim, 15],
  ["private PrintForge buckets", /^\s*insert into storage\.buckets /gim, 5],
];
for (const [label, pattern, expected] of expectedCounts) {
  const actual = count(snapshot, pattern);
  requireThat(actual === expected, `Snapshot ${label}: expected ${expected}, found ${actual}.`);
  console.log(`Snapshot check: ${label} = ${actual}`);
}

const chunkTables = read(join(chunkDir, "01_create_tables.sql"), "tables chunk");
const chunkIndexes = read(join(chunkDir, "02_constraints_indexes.sql"), "constraints/indexes chunk");
const chunkFunctions = read(join(chunkDir, "03_create_functions.sql"), "functions chunk");
const chunkPrivileges = read(join(chunkDir, "04_function_table_privileges.sql"), "privileges chunk");
const chunkRls = read(join(chunkDir, "05_rls_and_private_buckets.sql"), "RLS/buckets chunk");
const chunkPolicies = read(join(chunkDir, "06_policies_and_triggers.sql"), "policies/triggers chunk");
const chunkEventTrigger = read(join(chunkDir, "07_rls_event_trigger.sql"), "custom RLS event trigger chunk");
requireThat(count(chunkTables, /^\s*create table public\./gim) === 15, "Recovery tables chunk must define exactly 15 public tables.");
requireThat(count(chunkIndexes, /^\s*create (?:unique )?index if not exists /gim) === 67, "Recovery index chunk must preserve all 67 source index definitions.");
requireThat(count(chunkIndexes, /^\s*alter table public\..* add constraint .* foreign key /gim) === 64, "Recovery constraint chunk must preserve all 64 source foreign keys.");
const firstIndexStatement = chunkIndexes.search(/^\s*create (?:unique )?index if not exists /im);
const firstForeignKey = chunkIndexes.search(/^\s*alter table public\..* add constraint .* foreign key /im);
requireThat(firstIndexStatement >= 0 && firstForeignKey >= 0 && firstIndexStatement < firstForeignKey,
  "All indexes must be created before dependent foreign keys on a fresh database.");
requireThat(count(chunkFunctions, /^\s*create or replace function public\./gim) === 14, "Recovery routine chunk must define all 14 source routines.");
requireThat(count(chunkPrivileges, /^\s*revoke all on function /gim) >= 14, "Routine privileges must be explicitly reset before restoring source grants.");
requireThat(count(chunkRls, /^\s*alter table public\..* enable row level security;/gim) === 15, "Recovery must enable RLS on all 15 public tables.");
requireThat(count(chunkRls, /^\s*insert into storage\.buckets /gim) === 5, "Recovery must configure all five PrintForge storage buckets.");
requireThat(count(chunkPolicies, /^\s*create policy /gim) === 27, "Recovery must preserve all 27 current policies.");
requireThat(count(chunkPolicies, /^\s*create trigger /gim) === 15, "Recovery must preserve all 15 current triggers.");
requireThat(count(chunkEventTrigger, /^\s*create event trigger ensure_rls/gim) === 1, "Recovery must restore the custom ensure_rls event trigger.");
requireThat(/create table public\."?security_rate_limits"?/i.test(chunkTables), "Rate-limit table is missing from the recovered schema.");
requireThat(/printforge-exports[^\n]*false|\('printforge-exports'[^\n]*false/i.test(chunkRls),
  "Export bucket must remain private in the recovered schema.");

const legacyFoundationFiles = [
  "phase2_backend.sql", "phase3_project_templates.sql", "phase6_student_photo_matching.sql",
  "phase7_photo_processing.sql", "phase8_card_rendering.sql", "phase8_rendering_engine.sql",
  "phase9_batch_generation_engine.sql", "phase9_batch_status_transitions.sql",
  "phase9_batch_worker_authorization.sql", "phase9_qualify_item_rls.sql",
  "phase9_worker_invoker_and_indexes.sql", "phase10_validation.sql",
  "phase10_validation_settings.sql", "phase10_stale_output_invalidation.sql",
  "phase10_critical_finding_guard.sql", "phase10_finding_insert_guard.sql", "phase11_zip_exports.sql",
];
const legacyOutsideCanonical = legacyFoundationFiles.filter((name) =>
  existsSync(join(root, "supabase", name)) &&
  !migrationFiles.some((migration) => migration.endsWith("_" + name))
);
if (legacyOutsideCanonical.length) {
  warnings.push("Found phase SQL outside supabase/migrations (not replayable by the canonical migration runner): " + legacyOutsideCanonical.join(", "));
}
if (!existsSync(join(root, "package-lock.json")) && !existsSync(join(root, "npm-shrinkwrap.json"))) {
  warnings.push("No npm lockfile is tracked; dependency resolution is not fully reproducible and audit results can drift between installs.");
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Phase 28 migration contract checks: PASS (with explicit historical-recovery warnings where listed).");
}
