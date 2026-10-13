import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql", "utf8");
const correctionMigration = readFileSync("supabase/migrations/20261013120100_phase24_identifier_correction_rpc.sql", "utf8");
const workerMigration = readFileSync("supabase/migrations/20261013120200_phase24_worker_identifier_ordering.sql", "utf8");

describe("Phase 24 migration safety contract", () => {
  it("uses additive text columns and backfills only from identifiers already stored", () => {
    expect(migration).toContain("add column if not exists student_identifier text");
    expect(migration).toContain("student_identifier_review_required boolean not null default true");
    expect(migration).toContain("student_identifier_source text not null default 'legacy_numeric_backfill'");
    expect(migration).toMatch(/set student_identifier\s*=\s*serial_number::text/i);
    expect(migration).not.toMatch(/padStart|lpad\s*\(/i);
    expect(migration).not.toMatch(/drop table|delete from public\.(students|student_photos|generated_cards|batch_generation_items)/i);
  });
  it("enforces project-scoped uniqueness only after review and preserves card sides", () => {
    expect(migration).toMatch(/unique index if not exists students_project_student_identifier_key\\s+on public\\.students\\(project_id,student_identifier_unique\\)/i);\n    expect(migration).toContain("students_student_identifier_required");
    expect(migration).toContain("generated always as (case when student_identifier_review_required then null else student_identifier end) stored");
    expect(migration).toContain("idx_generated_cards_batch_student_identifier");
    expect(migration).not.toContain("create unique index if not exists generated_cards_batch_student_identifier_key");
    expect(correctionMigration).toContain("correct_student_identifier");
    expect(correctionMigration).toContain("student identifier already exists in this project");
    expect(correctionMigration).toContain("cannot correct an identifier while processing is active");
    expect(correctionMigration).toContain("security invoker");
  });
  it("keeps worker recovery locking and deterministic text ordering", () => {
    expect(workerMigration).toContain("security invoker");
    expect(workerMigration).toContain("for update skip locked");
    expect(workerMigration).toContain("interval '5 minutes'");
    expect(workerMigration).toMatch(/attempts\s*<\s*i\.max_attempts/);
    expect(workerMigration).toMatch(/order by coalesce\(i\.student_identifier,\s*i\.serial_number::text\),\s*i\.id/i);
  });
  it("does not mutate the production schema as part of tests", () => {
    expect(migration).toMatch(/^begin;/);
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(correctionMigration.trim().endsWith("commit;")).toBe(true);
    expect(workerMigration.trim().endsWith("commit;")).toBe(true);
  });
});
