import { unzipSync } from "fflate";
import { sha256, verifyZipDirectory } from "@/lib/exports/archive";

export type ExpectedArchiveItem = { filename: string; sha256: string };

export type ArchiveIntegrityResult = {
  ok: boolean;
  reason?: string;
  names: string[];
  verifiedItems: number;
};

/**
 * Verify the exact archive entry set, each packaged card's SHA-256, and (when
 * present) the JSON manifest's item list against the bytes actually in the ZIP.
 * This intentionally accepts no external URLs or storage paths.
 */
export function verifyArchiveIntegrity(
  bytes: Uint8Array,
  expectedNames: string[],
  expectedItems: ExpectedArchiveItem[],
): ArchiveIntegrityResult {
  if (expectedNames.length === 0 || expectedItems.length === 0) {
    return { ok: false, reason: "Archive integrity metadata is empty.", names: [], verifiedItems: 0 };
  }
  const directory = verifyZipDirectory(bytes, expectedNames);
  if (!directory.ok) {
    return { ok: false, reason: directory.reason ?? "ZIP directory verification failed.", names: directory.names, verifiedItems: 0 };
  }

  try {
    const files = unzipSync(bytes);
    const seen = new Set<string>();
    for (const item of expectedItems) {
      if (!item || typeof item.filename !== "string" || !item.filename || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(item.sha256)) {
        return { ok: false, reason: "Expected manifest item is missing a valid filename or SHA-256 hash.", names: directory.names, verifiedItems: seen.size };
      }
      if (seen.has(item.filename)) {
        return { ok: false, reason: "Duplicate filenames exist in the expected manifest.", names: directory.names, verifiedItems: seen.size };
      }
      seen.add(item.filename);
      const file = files[item.filename];
      if (!file) return { ok: false, reason: "A manifest item is missing from the ZIP archive.", names: directory.names, verifiedItems: seen.size - 1 };
      if (sha256(file) !== item.sha256.toLowerCase()) {
        return { ok: false, reason: "A packaged file SHA-256 does not match its manifest entry.", names: directory.names, verifiedItems: seen.size - 1 };
      }
    }

    const manifestPath = directory.names.find((name) => name === "manifest.json" || name.endsWith("/manifest.json"));
    if (manifestPath) {
      const parsed = JSON.parse(new TextDecoder().decode(files[manifestPath])) as { item_count?: unknown; items?: unknown };
      if (!Array.isArray(parsed.items) || parsed.item_count !== parsed.items.length || parsed.items.length !== expectedItems.length) {
        return { ok: false, reason: "JSON manifest item count does not match the verified archive contents.", names: directory.names, verifiedItems: seen.size };
      }
      const expectedByName = new Map(expectedItems.map((item) => [item.filename, item.sha256.toLowerCase()]));
      for (const raw of parsed.items) {
        if (!raw || typeof raw !== "object") return { ok: false, reason: "JSON manifest contains an invalid item.", names: directory.names, verifiedItems: seen.size };
        const item = raw as { filename?: unknown; sha256?: unknown };
        if (typeof item.filename !== "string" || typeof item.sha256 !== "string" || expectedByName.get(item.filename) !== item.sha256.toLowerCase()) {
          return { ok: false, reason: "JSON manifest filenames or SHA-256 values differ from verified archive items.", names: directory.names, verifiedItems: seen.size };
        }
        expectedByName.delete(item.filename);
      }
      if (expectedByName.size) return { ok: false, reason: "JSON manifest omits verified archive items.", names: directory.names, verifiedItems: seen.size };
    }

    return { ok: true, names: directory.names, verifiedItems: seen.size };
  } catch {
    return { ok: false, reason: "Archive or manifest could not be decoded for integrity verification.", names: directory.names, verifiedItems: 0 };
  }
}

/** Export archives have one canonical object key; prefixes alone are not sufficient. */
export function isExpectedExportStoragePath(path: unknown, userId: string, projectId: string, exportId: string): boolean {
  return typeof path === "string" && path === userId + "/" + projectId + "/" + exportId + "/archive.zip";
}
