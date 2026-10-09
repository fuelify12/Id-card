import { describe, expect, it } from "vitest";
import { csvCell, safeFilenamePart, verifyZipDirectory } from "@/lib/exports/archive";
import { strToU8, zipSync } from "fflate";

describe("security regression cases for student exports", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1)", "\t=cmd", "\r=1+1"])(
    "neutralizes spreadsheet formula prefix %j",
    (value) => {
      expect(csvCell(value).startsWith('"\'')).toBe(true);
    },
  );

  it("does not allow an untrusted student label to become an archive path", () => {
    const value = safeFilenamePart("../../../../outside\u0000file.png");
    expect(value).not.toContain("/");
    expect(value).not.toContain("..");
    expect(value).not.toContain("\u0000");
  });

  it("rejects archive entries that were not in the approved export manifest", () => {
    const zip = zipSync({
      "cards/approved.png": strToU8("synthetic"),
      "../../outside.txt": strToU8("synthetic"),
    });
    const result = verifyZipDirectory(zip, ["cards/approved.png"]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});
