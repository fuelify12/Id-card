#!/usr/bin/env node

/**
 * Fail-closed gate for authenticated, mutating E2E acceptance.
 * This validates operator-provided metadata only; it cannot prove the database
 * contains synthetic data. Inspect the isolated project and seed fixtures first.
 */

const fail = (message) => {
  console.error(`E2E SAFETY PREFLIGHT FAILED: ${message}`);
  process.exitCode = 1;
};

const required = [
  "E2E_ISOLATED_ENV",
  "E2E_ALLOW_MUTATIONS",
  "E2E_SYNTHETIC_DATA_CONFIRMED",
  "E2E_PREVIEW_INSPECTED",
  "E2E_TEST_EMAIL",
  "E2E_TEST_PASSWORD",
  "E2E_EXPORT_PROJECT_ID",
  "E2E_EXPORT_ID",
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_PRODUCTION_SUPABASE_PROJECT_REF",
  "E2E_PREVIEW_COMMIT_SHA",
  "E2E_EXPECTED_COMMIT_SHA",
  "PLAYWRIGHT_BASE_URL",
];

for (const key of required) {
  if (!process.env[key]?.trim()) fail(`Missing required variable: ${key}`);
}
if (process.exitCode) process.exit(1);

if (process.env.E2E_ISOLATED_ENV !== "true") fail("E2E_ISOLATED_ENV must be exactly true.");
if (process.env.E2E_ALLOW_MUTATIONS !== "true") fail("E2E_ALLOW_MUTATIONS must be exactly true.");
if (process.env.E2E_SYNTHETIC_DATA_CONFIRMED !== "true") fail("Confirm that the target contains synthetic-only fixtures.");
if (process.env.E2E_PREVIEW_INSPECTED !== "true") fail("Inspect the target Preview read-only before allowing mutations.");

const projectRef = process.env.E2E_SUPABASE_PROJECT_REF;
if (projectRef === process.env.E2E_PRODUCTION_SUPABASE_PROJECT_REF) {
  fail("Target Supabase project ref matches production.");
}

const supabaseUrlText = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrlText) {
  fail("Set E2E_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL so the target project URL can be checked.");
} else {
  try {
    const supabaseUrl = new URL(supabaseUrlText);
    const match = supabaseUrl.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    if (supabaseUrl.protocol !== "https:" || !match) {
      fail("Supabase URL must be standard HTTPS <project-ref>.supabase.co; custom hosts require manual review.");
    } else if (match[1] !== projectRef) {
      fail("Supabase URL hostname does not match E2E_SUPABASE_PROJECT_REF.");
    }
  } catch {
    fail("Supabase URL is invalid.");
  }
}

try {
  const previewUrl = new URL(process.env.PLAYWRIGHT_BASE_URL);
  if (previewUrl.protocol !== "https:") fail("Remote acceptance must use HTTPS.");
  if (!previewUrl.hostname.endsWith(".vercel.app")) fail("Target must be a Vercel Preview hostname.");
  if (previewUrl.hostname === "printforge-id-card-studio.vercel.app") {
    fail("Target is the production alias, not an isolated Preview deployment.");
  }
} catch {
  fail("PLAYWRIGHT_BASE_URL is invalid.");
}

if (process.env.E2E_PREVIEW_COMMIT_SHA !== process.env.E2E_EXPECTED_COMMIT_SHA) {
  fail("Inspected Preview commit SHA does not match the expected tested commit SHA.");
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for (const key of ["E2E_EXPORT_PROJECT_ID", "E2E_EXPORT_ID"]) {
  if (!uuidPattern.test(process.env[key])) fail(`${key} must be a valid UUID.`);
}

if (process.exitCode) process.exit(1);

console.log("E2E safety preflight passed.");
console.log(`Target Supabase ref: ${projectRef} (different from production)`);
console.log(`Target Preview host: ${new URL(process.env.PLAYWRIGHT_BASE_URL).hostname}`);
console.log(`Inspected commit: ${process.env.E2E_PREVIEW_COMMIT_SHA}`);
console.log("Credentials and full environment values were not printed.");
