import { expect, test } from "@playwright/test";

const browserDiagnostics = test.extend<{ collectDiagnostics: void }>({
  collectDiagnostics: [async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(`pageerror: ${error.name}: ${error.message}`));
    page.on("console", message => {
      if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 300)}`);
    });
    page.on("requestfailed", request => {
      const url = new URL(request.url());
      errors.push(`requestfailed: ${request.method()} ${url.origin}${url.pathname} (${request.failure()?.errorText ?? "unknown"})`);
    });
    await use();
    await testInfo.attach("browser-diagnostics.txt", {
      body: Buffer.from(errors.join("\n") || "No browser page errors, console errors, or failed requests observed."),
      contentType: "text/plain",
    });
    if (errors.some(error => error.startsWith("pageerror:"))) {
      throw new Error("Uncaught browser page error(s) observed; see browser-diagnostics.txt");
    }
  }, { auto: true }],
});

function isVercelAccessGate(url: URL) {
  return url.hostname === "vercel.com" && url.pathname.startsWith("/login");
}

browserDiagnostics("anonymous root navigation does not reveal protected workspace data", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => {
    const url = new URL(page.url());
    return isVercelAccessGate(url) || /\/login\/?$/.test(url.pathname);
  }).toBe(true);

  const url = new URL(page.url());
  if (isVercelAccessGate(url)) {
    await expect(page.getByRole("heading", { name: /log in to vercel/i })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: /id card studio/i })).toBeVisible();
  }
  await expect(page.getByText("School projects", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No school projects yet", { exact: true })).toHaveCount(0);
});

browserDiagnostics("direct dashboard navigation is denied to an anonymous browser", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect.poll(() => {
    const url = new URL(page.url());
    return isVercelAccessGate(url) || /\/login\/?$/.test(url.pathname);
  }).toBe(true);
  await expect(page.getByText("Create school project", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Production workflow", { exact: true })).toHaveCount(0);
});

browserDiagnostics("mobile access gate has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect.poll(() => {
    const url = new URL(page.url());
    return isVercelAccessGate(url) || /\/login\/?$/.test(url.pathname);
  }).toBe(true);
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport + 2);
});
