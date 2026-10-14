import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const count = (text: string, re: RegExp) => [...text.matchAll(re)].length;

describe("Phase 28 migration-recovery contract", () => {
  it("never mislabels the current-schema snapshot as the original Phase 1 migration", () => {
    const baseline = "supabase/migrations/20261008173336_phase1_foundation.sql";
    const snapshot = read("supabase/recovery/phase28_current_production_schema_snapshot.sql");
    if (!existsSync(join(root, baseline))) {
      expect(snapshot).toMatch(/NOT represented as the original Phase 1 migration/i);
      expect(snapshot).toMatch(/Schema metadata only; no table rows, auth users, photos, or exports were copied/i);
    }
  });

  it("preserves the reviewed catalog counts in the recovery snapshot", () => {
    const snapshot = read("supabase/recovery/phase28_current_production_schema_snapshot.sql");
    expect(count(snapshot, /^\s*create table public\./gim)).toBe(15);
    expect(count(snapshot, /^\s*create (?:unique )?index if not exists /gim)).toBe(67);
    expect(count(snapshot, /^\s*alter table public\..* add constraint .* foreign key /gim)).toBe(64);
    expect(count(snapshot, /^\s*create or replace function public\./gim)).toBe(14);
    expect(count(snapshot, /^\s*create policy /gim)).toBe(27);
    expect(count(snapshot, /^\s*create trigger /gim)).toBe(15);
    expect(count(snapshot, /^\s*create event trigger ensure_rls/gim)).toBe(1);
  });

  it("orders fresh-schema indexes before composite foreign keys and keeps RLS on", () => {
    const privileges = read("supabase/recovery/phase28_snapshot/04_function_table_privileges.sql");
    expect(count(privileges, /^\s*grant .* on table public\./gim)).toBe(29);
    const indexes = read("supabase/recovery/phase28_snapshot/02_constraints_indexes.sql");
    const rls = read("supabase/recovery/phase28_snapshot/05_rls_and_private_buckets.sql");
    const firstIndex = indexes.search(/create (?:unique )?index if not exists /i);
    const firstForeignKey = indexes.search(/alter table public\..* add constraint .* foreign key /i);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(firstForeignKey).toBeGreaterThanOrEqual(0);
    expect(firstIndex).toBeLessThan(firstForeignKey);
    expect(count(rls, /^\s*alter table public\..* enable row level security;/gim)).toBe(15);
    expect(count(rls, /^\s*insert into storage\.buckets /gim)).toBe(5);
    const eventTrigger = read("supabase/recovery/phase28_snapshot/07_rls_event_trigger.sql");
    expect(count(eventTrigger, /^\s*create event trigger ensure_rls/gim)).toBe(1);
    expect(rls).toMatch(/printforge-exports[^\n]*false|\('printforge-exports'[^\n]*false/i);
  });

  it("makes canonical migration gaps visible and supports a deliberately non-strict recovery path", () => {
    const result = spawnSync(process.execPath, [
      join(root, "scripts/phase28-migration-contract-check.mjs"),
      "--allow-recovery-snapshot",
    ], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/historical.*baseline|Phase 1/i);
    expect(result.stdout + result.stderr).toMatch(/Phase 28 migration contract checks: PASS/i);
  });
});
