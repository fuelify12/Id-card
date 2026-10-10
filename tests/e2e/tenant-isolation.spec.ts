import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
const otherProjectId = process.env.E2E_OTHER_TENANT_PROJECT_ID;
const otherExportId = process.env.E2E_OTHER_TENANT_EXPORT_ID;
const isolated = process.env.E2E_ISOLATED_ENV === "true";

test("a signed-in tenant cannot list or download another tenant's export", async ({ page }) => {
  test.skip(
    !isolated || !email || !password || !otherProjectId || !otherExportId,
    "BLOCKED until an isolated environment and a synthetic export owned by a second test tenant are configured.",
  );

  const actualRef = process.env.E2E_SUPABASE_PROJECT_REF;
  const productionRef = process.env.E2E_PRODUCTION_SUPABASE_PROJECT_REF;
  const previewUrlText = process.env.PLAYWRIGHT_BASE_URL;
  const supabaseUrlText = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const inspectedSha = process.env.E2E_PREVIEW_COMMIT_SHA;
  const expectedSha = process.env.E2E_EXPECTED_COMMIT_SHA;
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  expect(process.env.E2E_ALLOW_MUTATIONS).toBe("true");
  expect(process.env.E2E_SYNTHETIC_DATA_CONFIRMED).toBe("true");
  expect(process.env.E2E_PREVIEW_INSPECTED).toBe("true");
  expect(actualRef).toBeTruthy();
  expect(actualRef).not.toBe(productionRef);
  expect(inspectedSha).toBeTruthy();
  expect(inspectedSha).toBe(expectedSha);
  expect(bypassSecret).toBeTruthy();

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(otherProjectId).toMatch(uuid);
  expect(otherExportId).toMatch(uuid);

  const supabaseUrl = new URL(supabaseUrlText!);
  expect(supabaseUrl.protocol).toBe("https:");
  expect(supabaseUrl.hostname).toBe(`${actualRef}.supabase.co`);

  const previewUrl = new URL(previewUrlText!);
  expect(previewUrl.protocol).toBe("https:");
  expect(previewUrl.hostname.endsWith(".vercel.app")).toBe(true);
  expect(previewUrl.hostname).not.toBe("printforge-id-card-studio.vercel.app");

  // Keep the deployment bypass header scoped to the login document request only.
  await page.route("**/login", async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), "x-vercel-protection-bypass": bypassSecret! },
    });
  });
  await page.goto("/login");
  await page.unroute("**/login");

  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);

  const listResponse = await page.request.get(`/api/projects/${otherProjectId}/exports`);
  expect([403, 404], "cross-tenant export listing must be denied").toContain(listResponse.status());

  const downloadResponse = await page.request.get(
    `/api/projects/${otherProjectId}/exports/${otherExportId}/download`,
  );
  expect([403, 404], "cross-tenant signed-download creation must be denied").toContain(downloadResponse.status());
  const bodyText = await downloadResponse.text();
  expect(bodyText).not.toMatch(/https:\/\/[^\s"']+\.supabase\.co\/storage\//i);
});
