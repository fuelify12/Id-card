import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/e2e-safety-preflight.mjs", import.meta.url));

const safeEnv = () => ({
  ...process.env,
  E2E_ISOLATED_ENV: "true",
  E2E_ALLOW_MUTATIONS: "true",
  E2E_SYNTHETIC_DATA_CONFIRMED: "true",
  E2E_PREVIEW_INSPECTED: "true",
  E2E_TEST_EMAIL: "e2e@example.invalid",
  E2E_TEST_PASSWORD: "synthetic-test-password",
  E2E_EXPORT_PROJECT_ID: "123e4567-e89b-42d3-a456-426614174000",
  E2E_EXPORT_ID: "123e4567-e89b-42d3-a456-426614174001",
  E2E_SUPABASE_PROJECT_REF: "isolated-test-project",
  E2E_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
  E2E_SUPABASE_URL: "https://isolated-test-project.supabase.co",
  E2E_PREVIEW_COMMIT_SHA: "a".repeat(40),
  E2E_EXPECTED_COMMIT_SHA: "a".repeat(40),
  PLAYWRIGHT_BASE_URL: "https://printforge-id-card-studio-preview.vercel.app",
  VERCEL_AUTOMATION_BYPASS_SECRET: "synthetic-bypass-secret",
});

function runPreflight(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env,
  });
}

describe("E2E safety preflight", () => {
  it("accepts complete, explicitly confirmed isolated metadata", () => {
    const result = runPreflight(safeEnv());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("E2E safety preflight passed.");
    expect(result.stdout).not.toContain("synthetic-bypass-secret");
    expect(result.stdout).not.toContain("synthetic-test-password");
  });

  it("fails closed when the target ref is Production", () => {
    const env = safeEnv();
    env.E2E_PRODUCTION_SUPABASE_PROJECT_REF = env.E2E_SUPABASE_PROJECT_REF;
    const result = runPreflight(env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Target Supabase project ref matches production.");
  });

  it("rejects a URL whose hostname does not match the isolated ref", () => {
    const env = safeEnv();
    env.E2E_SUPABASE_URL = "https://production-project.supabase.co";
    const result = runPreflight(env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Supabase URL hostname does not match");
  });

  it("rejects an unreviewed Preview commit", () => {
    const env = safeEnv();
    env.E2E_PREVIEW_COMMIT_SHA = "b".repeat(40);
    const result = runPreflight(env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Inspected Preview commit SHA does not match");
  });

  it("requires the Vercel protection bypass secret without printing it", () => {
    const env = safeEnv();
    env.VERCEL_AUTOMATION_BYPASS_SECRET = "";
    const result = runPreflight(env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing required variable: VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(result.stdout + result.stderr).not.toContain("synthetic-test-password");
  });
});
