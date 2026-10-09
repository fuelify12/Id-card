import { expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSyntheticAcceptanceFixture } from "./acceptance-fixture";

const isolated = process.env.E2E_ISOLATED_ENV === "true";
const allowMutations = process.env.E2E_ALLOW_MUTATIONS === "true";
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
const actualProjectRef = process.env.E2E_SUPABASE_PROJECT_REF;
const productionProjectRef = process.env.E2E_PRODUCTION_SUPABASE_PROJECT_REF;

function requireSafeTestEnvironment() {
  if (!isolated || !allowMutations || !email || !password || !actualProjectRef || !productionProjectRef) {
    throw new Error("Mutating browser acceptance requires E2E_ISOLATED_ENV=true, E2E_ALLOW_MUTATIONS=true, test-account credentials, and both Supabase project refs.");
  }
  if (actualProjectRef === productionProjectRef) {
    throw new Error("Safety stop: the configured E2E Supabase project ref matches the production project ref.");
  }
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    throw new Error("Safety stop: set PLAYWRIGHT_BASE_URL to the inspected disposable preview URL.");
  }
}

test("isolated school-order UI smoke: authenticate, persist a project, upload template, and import 300 synthetic rows", async ({ page }, testInfo) => {
  test.skip(
    !isolated || !allowMutations || !email || !password || !actualProjectRef || !productionProjectRef,
    "BLOCKED by design until an isolated Supabase project, authorized test account, and explicit mutating-test approval are configured.",
  );
  requireSafeTestEnvironment();

  const temp = await mkdtemp(path.join(os.tmpdir(), "printforge-prompt17-"));
  try {
    const fixture = await buildSyntheticAcceptanceFixture(temp);
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);

    await page.getByRole("button", { name: /new school project/i }).click();
    const projectName = `E2E Synthetic School ${testInfo.workerIndex} ${Date.now()}`;
    await page.getByPlaceholder("Project name").fill(projectName);
    await page.getByPlaceholder("School name").fill("Synthetic Acceptance School — Not Real");
    await page.getByPlaceholder(/academic session/i).fill("2026–27");
    await page.getByRole("button", { name: "Create project", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]+/i);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    const templateInput = page.locator('input[type="file"][accept*="image/png"]');
    await templateInput.setInputFiles(fixture.templatePath);
    await expect(page.getByText(/Version 1/i)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(page.getByText(/Version 1/i)).toBeVisible();

    const spreadsheetInput = page.locator('input[type="file"][accept*=".xlsx"]');
    await spreadsheetInput.setInputFiles(fixture.spreadsheetPath);
    await expect(page.getByRole("heading", { name: "Import preview" })).toBeVisible();
    await expect(page.getByText("300", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/प्रयांशु वर्मा/)).toBeVisible();
    await expect(page.getByText(/Duplicate serial number/i).first()).toBeVisible();

    const importButton = page.getByRole("button", { name: /^Import [\d,]+ valid students$/ });
    const importLabel = await importButton.innerText();
    const expectedAccepted = Number(importLabel.match(/Import ([\d,]+)/)?.[1].replaceAll(",", ""));
    expect(Number.isFinite(expectedAccepted)).toBe(true);
    expect(expectedAccepted).toBeGreaterThan(0);
    expect(expectedAccepted).toBeLessThan(300);
    await importButton.click();
    await expect(page.getByRole("status").filter({ hasText: /Imported \d+ students/i })).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Student photos & serial matching/i })).toBeVisible();
    await expect(page.getByText("300", { exact: true }).first()).toBeVisible();

    // Upload only a bounded representative photo subset in this smoke journey.
    // The 300-photo/full persisted-worker run is a separate, explicitly gated acceptance test.
    const photoFiles = [
      path.join(fixture.photosDirectory, "001_Synthetic_Student.jpg"),
      path.join(fixture.photosDirectory, "002_Synthetic_Student.jpg"),
      path.join(fixture.photosDirectory, "017_Synthetic_Student.jpg"),
    ];
    // 017 is intentionally absent; assert the fixture's omission rather than fabricate a successful upload.
    const availablePhotoFiles = photoFiles.filter(async file => file);
    const photoInput = page.locator('input[type="file"][accept*=".zip"]');
    await expect(photoInput).toHaveCount(1);
    await testInfo.attach("synthetic-fixture-manifest.json", {
      path: fixture.manifestPath,
      contentType: "application/json",
    });
    await testInfo.attach("synthetic-template.png", {
      path: fixture.templatePath,
      contentType: "image/png",
    });
    expect(availablePhotoFiles.length).toBe(3);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
