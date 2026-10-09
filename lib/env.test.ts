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

  it("rejects service-role-shaped keys instead of passing them to browser clients", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "service_role_secret");
    expect(() => getSupabasePublicEnv()).toThrow(/unsupported format/);
  });
});
