import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql", "utf8");
const correctionMigration = readFileSync("supabase/migrations/20261013120100_phase24_identifier_correction_rpc.sql", "utf8");
const workerMigration = readFileSync("supabase/migrations/20261013120200_phase24_worker_identifier_ordering.sql", "utf8");

describe("Phase 24 migration safety contract", () => {
  it("uses additive text columns and backfills only from identifiers already stored", () => {
    expect(migration).toContain("add column if not exists student_identifier text");
    expect(migration).toContain("add column if not exists student_identifier_unique text");
    expect(migration).toContain("student_identifier_review_required boolean not null default true");
    expect(migration).toContain("student_identifier_source text not null default 'legacy_numeric_backfill'");
    expect(migration).toContain("set student_identifier=serial_number::text");
    expect(migration).not.toMatch(/padStart|lpad\s*\(/i);
    expect(migration).not.toMatch(/drop table|delete from public\.(students|student_photos|generated_cards|batch_generation_items)/i);
  });
  it("enforces project-scoped uniqueness through the generated review-aware key", () => {
    expect(migration).toContain("create unique index if not exists students_project_student_identifier_key");
    expect(migration).toContain("on public.students(project_id,student_identifier_unique)");
    expect(migration).toContain("add column if not exists student_identifier_unique text");
    expect(migration).toContain("phase24_sync_student_identifier");
    expect(migration).toContain("new.student_identifier_unique:=null");
    expect(migration).toContain("students_student_identifier_required");
    expect(migration).toContain("idx_generated_cards_batch_student_identifier");
    expect(migration).not.toContain("create unique index if not exists generated_cards_batch_student_identifier_key");
    expect(correctionMigration).toContain("correct_student_identifier");
    expect(correctionMigration).toContain("student identifier already exists in this project");
    expect(correctionMigration).toContain("student_identifier_unique=v_identifier_unique");
    expect(correctionMigration).toContain("cannot correct an identifier while processing is active");
    expect(correctionMigration).toContain("security invoker");
  });
  it("keeps worker recovery locking and deterministic text ordering", () => {
    expect(workerMigration).toContain("security invoker");
    expect(workerMigration).toContain("for update skip locked");
    expect(workerMigration).toContain("interval '5 minutes'");
    expect(workerMigration).toContain("attempts<i.max_attempts");
    expect(workerMigration).toContain("order by coalesce(i.student_identifier,i.serial_number::text),i.id");
  });
  it("keeps migrations atomic and does not mutate production as part of tests", () => {
    expect(migration.trim().startsWith("begin;")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
    expect(correctionMigration.trim().endsWith("commit;")).toBe(true);
    expect(workerMigration.trim().endsWith("commit;")).toBe(true);
  });
});
