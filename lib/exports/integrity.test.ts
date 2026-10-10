import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { sha256 } from "@/lib/exports/archive";
import { isExpectedExportStoragePath, verifyArchiveIntegrity } from "@/lib/exports/integrity";

function archive(items: Array<{ filename: string; bytes: Uint8Array }>, manifest = true) {
  const expectedItems = items.map(({ filename, bytes }) => ({ filename, sha256: sha256(bytes) }));
  const root = "PRINTFORGE_Synthetic_2026";
  const files: Record<string, Uint8Array> = {};
  for (const item of items) files[root + "/" + item.filename] = item.bytes;
  const names = Object.keys(files);
  if (manifest) {
    const json = {
      schema_version: 1,
      export_id: "synthetic-export",
      exported_at: "2026-10-10T00:00:00.000Z",
      item_count: expectedItems.length,
      items: expectedItems.map((item) => ({ ...item, filename: root + "/" + item.filename })),
    };
    files[root + "/manifest.json"] = strToU8(JSON.stringify(json));
    files[root + "/manifest.csv"] = strToU8("filename,sha256\r\n");
    names.push(root + "/manifest.json", root + "/manifest.csv");
  }
  return { bytes: zipSync(files), names, expectedItems: expectedItems.map((item) => ({ ...item, filename: root + "/" + item.filename })) };
}

describe("Prompt 19 export integrity", () => {
  it("verifies ZIP entry set, packaged bytes, SHA-256 and JSON manifest", () => {
    const input = archive([{ filename: "front/001.png", bytes: strToU8("synthetic card bytes") }]);
    expect(verifyArchiveIntegrity(input.bytes, input.names, input.expectedItems)).toMatchObject({ ok: true, verifiedItems: 1 });
  });

  it("rejects a card whose packaged bytes no longer match the expected SHA-256", () => {
    const input = archive([{ filename: "front/001.png", bytes: strToU8("tampered bytes") }]);
    expect(verifyArchiveIntegrity(input.bytes, input.names, [{ ...input.expectedItems[0], sha256: "0".repeat(64) }])).toMatchObject({
      ok: false, reason: "A packaged file SHA-256 does not match its manifest entry.",
    });
  });

  it("rejects a JSON manifest that lies about the packaged item hash", () => {
    const input = archive([{ filename: "front/001.png", bytes: strToU8("synthetic card bytes") }]);
    const files = {
      "PRINTFORGE_Synthetic_2026/front/001.png": strToU8("synthetic card bytes"),
      "PRINTFORGE_Synthetic_2026/manifest.json": strToU8(JSON.stringify({
        item_count: 1,
        items: [{ filename: "PRINTFORGE_Synthetic_2026/front/001.png", sha256: "f".repeat(64) }],
      })),
    };
    const bytes = zipSync(files);
    expect(verifyArchiveIntegrity(bytes, Object.keys(files), input.expectedItems)).toMatchObject({
      ok: false, reason: "JSON manifest filenames or SHA-256 values differ from verified archive items.",
    });
  });

  it("rejects extra ZIP files, unsafe names and corrupt archives", () => {
    const input = archive([{ filename: "front/001.png", bytes: strToU8("card") }]);
    expect(verifyArchiveIntegrity(input.bytes, [...input.names, "unexpected.txt"], input.expectedItems).ok).toBe(false);
    const unsafe = zipSync({ "../escape.txt": strToU8("nope") });
    expect(verifyArchiveIntegrity(unsafe, ["../escape.txt"], []).ok).toBe(false);
    expect(verifyArchiveIntegrity(strToU8("not a zip"), [], []).ok).toBe(false);
  });

  it("requires the exact canonical private-storage key, not merely an owner/project prefix", () => {
    expect(isExpectedExportStoragePath("user/project/export/archive.zip", "user", "project", "export")).toBe(true);
    expect(isExpectedExportStoragePath("user/project/export/other.zip", "user", "project", "export")).toBe(false);
    expect(isExpectedExportStoragePath("user/project/export/../../archive.zip", "user", "project", "export")).toBe(false);
    expect(isExpectedExportStoragePath("other/project/export/archive.zip", "user", "project", "export")).toBe(false);
  });
});
