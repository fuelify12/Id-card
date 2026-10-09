import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("Supabase environment validation", () => {
  it("fails with a generic configuration error when required variables are absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => getSupabasePublicEnv()).toThrow(/must be configured/);
  });

  it("accepts a publishable key and HTTPS project URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
    expect(getSupabasePublicEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key",
    });
  });

  it("rejects non-HTTPS project URLs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
    expect(() => getSupabasePublicEnv()).toThrow(/must use HTTPS/);
  });

  it("rejects service-role JWTs even though legacy anonymous JWT keys are supported", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const payload = btoa(JSON.stringify({ role: "service_role" })).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic-signature`);
    expect(() => getSupabasePublicEnv()).toThrow(/unsupported format/);
  });
});
