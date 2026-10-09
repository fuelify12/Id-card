import { describe, expect, it } from "vitest";
import { physicalPixels, sanitizeSvg, validatePhysicalSize } from "@/lib/rendering/engine";

describe("physical card dimensions", () => {
  it("converts millimeters to pixels at the selected DPI", () => {
    expect(physicalPixels(85.6, 300)).toBe(1011);
    expect(physicalPixels(54, 300)).toBe(638);
  });

  it("rejects invalid dimensions and DPI", () => {
    expect(() => physicalPixels(0, 300)).toThrow();
    expect(() => physicalPixels(501, 300)).toThrow();
    expect(() => physicalPixels(85, 71)).toThrow();
    expect(() => physicalPixels(85, 1201)).toThrow();
  });

  it("limits total raster output pixels", () => {
    expect(validatePhysicalSize(85.6, 54, 300).widthPx).toBe(1011);
    expect(() => validatePhysicalSize(500, 500, 1200)).toThrow(/24-megapixel/);
  });
});

describe("SVG template sanitization", () => {
  it("accepts simple static SVG artwork", () => {
    const output = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#fff"/></svg>');
    expect(output.toString()).toContain("<rect");
  });

  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div>x</div></foreignObject></svg>',
    '<svg><image href="https://example.com/image.png"/></svg>',
    '<svg onload="alert(1)"></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>',
  ])("rejects active or externally referenced SVG: %s", (svg) => {
    expect(() => sanitizeSvg(svg)).toThrow();
  });
});
