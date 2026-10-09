import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { buildManifests, chooseCardSides, exportEligibilityReasons, safeFilenamePart, sourceFormatSupports, uniqueArchiveName, verifyZipDirectory } from "./archive";

describe("Phase 11 ZIP export helpers", () => {
  it("sanitizes path traversal, separators and control characters while preserving Unicode", () => {
    const safe = safeFilenamePart("../../कक्षा/Student\nName");
    expect(safe).toContain("कक्षा");
    expect(safe).not.toContain("..");
    expect(safe).not.toContain("/");
    expect(safeFilenamePart("..")).toBe("card");
  });
  it("preserves leading-zero serials when callers pass them as strings", () => {
    expect(safeFilenamePart("007")).toBe("007");
  });
  it("makes duplicate archive names deterministic", () => {
    const used = new Set<string>();
    expect(uniqueArchiveName("front/001_नाम.png", used)).toBe("front/001_नाम.png");
    expect(uniqueArchiveName("front/001_नाम.png", used)).toBe("front/001_नाम_2.png");
  });
  it("CSV-escapes quotes and keeps valid JSON manifest data", () => {
    const m = buildManifests([{ serial_number:"001", filename:'front/A,"B.png', side:"front", format:"png" }], "export-id", "2026-10-09T00:00:00Z");
    expect(m.csv).toContain('"front/A,""B.png');
    expect(JSON.parse(m.json).item_count).toBe(1);
  });
  it("excludes unapproved, failed, and critically flagged cards", () => {
    const card = {id:"c",student_id:"s",serial_number:1,status:"generated",validation_status:"passed",approval_status:"approved",storage_path:"u/p/c.png",output_sha256:"abc"};
    expect(exportEligibilityReasons({...card,approval_status:"pending"})).toContain("Card has not been explicitly approved.");
    expect(exportEligibilityReasons(card,[{severity:"CRITICAL",status:"OPEN"}])).toContain("Unresolved critical/error validation findings exist.");
  });
  it("supports deterministic image conversion and only existing PDF outputs", () => {
    expect(sourceFormatSupports("png","jpeg")).toBe(true);
    expect(sourceFormatSupports("jpg","png")).toBe(true);
    expect(sourceFormatSupports("pdf","png")).toBe(false);
    expect(sourceFormatSupports("pdf","pdf")).toBe(true);
  });
  it("requires both approved sides for duplex export and excludes missing sides", () => {
    const front={side:"front",eligible:true,format:"png",id:"front"};
    const back={side:"back",eligible:true,format:"png",id:"back"};
    expect(chooseCardSides([front,back],"both","jpeg").items).toHaveLength(2);
    expect(chooseCardSides([front],"both","original").reason).toContain("required card side");
  });
  it("verifies exact ZIP contents and rejects missing/unexpected entries", () => {
    const bytes = zipSync({ "front/001.png": strToU8("synthetic image"), "manifest.json": strToU8("{}") });
    expect(verifyZipDirectory(bytes,["front/001.png","manifest.json"]).ok).toBe(true);
    expect(verifyZipDirectory(bytes,["front/002.png","manifest.json"]).ok).toBe(false);
  });
  it("handles a 300-student synthetic eligibility report without dropping leading-zero serials", () => {
    const cards = Array.from({length:300},(_,i)=>({id:String(i),student_id:String(i),serial_number:i+1,status:"generated",validation_status:"passed",approval_status:"approved",storage_path:`u/p/${i}.png`,output_sha256:"hash"}));
    const eligible = cards.filter(c=>exportEligibilityReasons(c).length===0);
    expect(eligible).toHaveLength(300);
    expect(safeFilenamePart(String(eligible[0].serial_number).padStart(3,"0"))).toBe("001");
  });
});
