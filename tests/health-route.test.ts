import { afterEach, describe, expect, it, vi } from "vitest";

const envKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NODE_ENV",
] as const;
const original = new Map(envKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of envKeys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("returns minimal readiness without disclosing configuration", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_placeholder";
    process.env.NODE_ENV = "production";
    vi.resetModules();
    const { GET } = await import("../app/api/health/route");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body).not.toHaveProperty("url");
    expect(body).not.toHaveProperty("key");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed when required configuration is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NODE_ENV = "production";
    vi.resetModules();
    const { GET } = await import("../app/api/health/route");
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual(expect.objectContaining({ status: "not_ready" }));
    expect(JSON.stringify(body)).not.toContain("SUPABASE");
  });
});
