import { describe, expect, it, vi } from "vitest";
import { consumeRateLimit } from "./rate-limit";

describe("shared database rate limiter", () => {
  it("passes through an allowed RPC decision", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(consumeRateLimit({ rpc }, "batch_generate", 5)).resolves.toEqual({ allowed: true });
    expect(rpc).toHaveBeenCalledWith("consume_security_rate_limit", {
      p_action: "batch_generate",
      p_limit: 5,
      p_window_seconds: 60,
    });
  });

  it("returns a denied decision when the quota is exhausted", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(consumeRateLimit({ rpc }, "zip_export", 3)).resolves.toEqual({
      allowed: false,
      unavailable: false,
    });
  });

  it("fails closed when the shared RPC fails or returns malformed data", async () => {
    await expect(consumeRateLimit({ rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("offline") }) }, "batch_generate", 5))
      .resolves.toEqual({ allowed: false, unavailable: true });
    await expect(consumeRateLimit({ rpc: vi.fn().mockRejectedValue(new Error("offline")) }, "zip_export", 3))
      .resolves.toEqual({ allowed: false, unavailable: true });
  });
});
