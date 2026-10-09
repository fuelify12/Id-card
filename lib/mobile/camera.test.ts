import { describe, expect, it } from "vitest";
import { cameraErrorMessage, cameraSupportMessage } from "@/lib/mobile/camera";

describe("mobile camera recovery", () => {
  it("explains permission denial and offers device-picker recovery", () => {
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toContain("permission was denied");
    expect(cameraErrorMessage({ name: "SecurityError" })).toContain("permission was denied");
    expect(cameraErrorMessage(new Error("permission"))).toContain("Choose from device");
  });
  it("handles missing cameras and busy camera hardware", () => {
    expect(cameraErrorMessage({ name: "NotFoundError" })).toContain("No compatible camera");
    expect(cameraErrorMessage({ name: "OverconstrainedError" })).toContain("No compatible camera");
    expect(cameraErrorMessage({ name: "NotReadableError" })).toContain("busy in another app");
  });
  it("requires a secure context and supports browsers without camera APIs", () => {
    expect(cameraSupportMessage(false, true)).toContain("requires HTTPS");
    expect(cameraSupportMessage(true, false)).toContain("does not support camera");
    expect(cameraSupportMessage(true, true)).toBeNull();
  });
});
