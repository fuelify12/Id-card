import { describe, expect, it } from "vitest";
import { getSecurityHeaders } from "./headers";

describe("production browser security headers", () => {
  it("blocks framing, plugins, base URL injection and cross-origin form submissions", () => {
    const headers = Object.fromEntries(getSecurityHeaders(true).map(({ key, value }) => [key.toLowerCase(), value]));
    const csp = headers["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it("permits same-origin camera capture while denying microphone and geolocation", () => {
    const headers = getSecurityHeaders(true);
    expect(headers.find((h) => h.key === "Permissions-Policy")?.value).toContain("camera=(self)");
    expect(headers.find((h) => h.key === "Permissions-Policy")?.value).toContain("microphone=()");
    expect(headers.find((h) => h.key === "Permissions-Policy")?.value).toContain("geolocation=()");
  });

  it("sets HSTS only in production and keeps student data responses non-cacheable", () => {
    const production = getSecurityHeaders(true);
    const development = getSecurityHeaders(false);
    expect(production.some((h) => h.key === "Strict-Transport-Security")).toBe(true);
    expect(development.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    expect(production.find((h) => h.key === "Cache-Control")?.value).toContain("no-store");
  });

  it("allows Supabase HTTPS and realtime endpoints needed by auth/storage", () => {
    const csp = getSecurityHeaders(true).find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("wss://*.supabase.co");
  });
});
