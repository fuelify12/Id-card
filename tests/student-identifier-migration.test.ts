import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql", "utf8");

describe("Phase 24 migration safety contract", () => {
  it("uses additive text columns and backfills only from identifiers already stored", () => {
    expect(migration).toContain("add column if not exists student_identifier text");
    expect(migration).toContain("set student_identifier = serial_number::text");
    expect(migration).not.toMatch(/padStart|lpad\s*\(/i);
    expect(migration).not.toMatch(/drop table|delete from public\.(students|student_photos|generated_cards|batch_generation_items)/i);
  });
  it("enforces project-scoped canonical uniqueness and retains tenant RLS", () => {
    expect(migration).toMatch(/unique index if not exists students_project_student_identifier_key\s+on public\.students\(project_id, student_identifier\)/i);
    expect(migration).toContain("students_student_identifier_required");
    expect(migration).toContain("student_identifier_settings");
  });
  it("is rerunnable for columns, indexes, constraints, and triggers", () => {
    expect(migration).toContain("add column if not exists");
    expect(migration).toContain("create unique index if not exists");
    expect(migration).toContain("drop trigger if exists");
    expect(migration).toContain("drop constraint if exists");
    expect(migration).toContain("where student_identifier is null");
  });
});
