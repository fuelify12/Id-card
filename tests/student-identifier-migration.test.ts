import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql", "utf8");

describe("Phase 24 migration safety contract", () => {
  it("uses additive text columns and backfills only from identifiers already stored", () => {
    expect(migration).toContain("add column if not exists student_identifier text");
    expect(migration).toContain("student_identifier_review_required boolean not null default true");
    expect(migration).toContain("student_identifier_source text not null default 'legacy_numeric_backfill'");
    expect(migration).toContain("set student_identifier = serial_number::text");
    expect(migration).not.toMatch(/padStart|lpad\s*\(/i);
    expect(migration).not.toMatch(/drop table|delete from public\.(students|student_photos|generated_cards|batch_generation_items)/i);
  });
  it("enforces project-scoped canonical uniqueness and retains tenant RLS", () => {
    expect(migration).toMatch(/unique index if not exists students_project_student_identifier_key\s+on public\.students\(project_id, student_identifier\)/i);
    expect(migration).toContain("students_student_identifier_required");
    expect(migration).toContain("student_identifier_settings");
    expect(migration).toContain("correct_student_identifier");
    expect(migration).toContain("security invoker");
  });
  it("is rerunnable for columns, indexes, constraints, and triggers", () => {
    expect(migration).toContain("add column if not exists");
    expect(migration).toContain("create unique index if not exists");
    expect(migration).toContain("drop trigger if exists");
    expect(migration).toContain("drop constraint if exists");
    expect(migration).toContain("where student_identifier is null");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("attempts < i.max_attempts");
    expect(migration).toContain("order by coalesce(i.student_identifier, i.serial_number::text), i.id");
  });
});
