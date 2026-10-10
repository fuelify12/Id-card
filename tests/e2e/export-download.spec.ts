import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";

const isolated = process.env.E2E_ISOLATED_ENV === "true";
const allowMutations = process.env.E2E_ALLOW_MUTATIONS === "true";
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
const projectId = process.env.E2E_EXPORT_PROJECT_ID;
const exportId = process.env.E2E_EXPORT_ID;
const actualProjectRef = process.env.E2E_SUPABASE_PROJECT_REF;
const productionProjectRef = process.env.E2E_PRODUCTION_SUPABASE_PROJECT_REF;

function requireSafeEnvironment() {
  if (!isolated || !allowMutations || !email || !password || !projectId || !exportId || !actualProjectRef || !productionProjectRef) {
    throw new Error("Export download acceptance requires isolated-environment flags, test-account credentials, project/export IDs, and both Supabase refs.");
  }
  if (actualProjectRef === productionProjectRef) {
    throw new Error("Safety stop: export download test project ref matches production.");
  }
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    throw new Error("Safety stop: set PLAYWRIGHT_BASE_URL to the inspected isolated preview URL.");
  }
}

test("downloads a completed synthetic ZIP and verifies its archive hash and manifest", async ({ page }) => {
  test.skip(
    !isolated || !allowMutations || !email || !password || !projectId || !exportId || !actualProjectRef || !productionProjectRef,
    "BLOCKED by design until an isolated Supabase project, authorized synthetic export, and inspected preview are configured.",
  );
  requireSafeEnvironment();

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);

  const historyResponse = await page.request.get(`/api/projects/${projectId}/exports`);
  expect(historyResponse.status()).toBe(200);
  const history = await historyResponse.json();
  const record = (history.exports ?? []).find((item: any) => item.id === exportId);
  expect(record, "configured export must exist in the authorized project").toBeTruthy();
  expect(["completed", "completed_with_errors"]).toContain(record.status);
  expect(record.archive_sha256).toMatch(/^[a-f0-9]{64}$/i);

  const linkResponse = await page.request.get(`/api/projects/${projectId}/exports/${exportId}/download`);
  expect(linkResponse.status()).toBe(200);
  const link = await linkResponse.json();
  expect(link.url).toMatch(/^https:\/\//);
  expect(link.expiresInSeconds).toBeGreaterThan(0);
  expect(link.expiresInSeconds).toBeLessThanOrEqual(60);

  // This request is the real signed-URL download, not a mock of the API response.
  const download = await page.request.get(link.url);
  expect(download.status()).toBe(200);
  const bytes = Buffer.from(await download.body());
  expect(bytes.length).toBeGreaterThan(22);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.archive_sha256);
  if (record.archive_bytes != null) expect(bytes.length).toBe(Number(record.archive_bytes));

  const files = unzipSync(bytes);
  const names = Object.keys(files);
  expect(names.length).toBeGreaterThan(0);
  expect(names.some((name) => name.startsWith("/") || name.includes("\\") || name.split("/").some((part) => part === "." || part === ".."))).toBe(false);
  expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);

  const manifestPath = names.find((name) => name === "manifest.json" || name.endsWith("/manifest.json"));
  if (manifestPath) {
    const manifest = JSON.parse(new TextDecoder().decode(files[manifestPath])) as { item_count: number; items: Array<{ filename: string; sha256: string }> };
    expect(manifest.item_count).toBe(manifest.items.length);
    for (const item of manifest.items) {
      expect(files[item.filename], `manifest file ${item.filename} exists in the downloaded ZIP`).toBeTruthy();
      expect(item.sha256).toMatch(/^[a-f0-9]{64}$/i);
      expect(createHash("sha256").update(files[item.filename]).digest("hex")).toBe(item.sha256);
    }
  }
});
