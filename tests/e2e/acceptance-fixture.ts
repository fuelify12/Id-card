import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import sharp from "sharp";

export type ExpectedOutcome = "EXPECTED_IMPORT" | "EXPECTED_REJECT" | "EXPECTED_REVIEW";
export type SyntheticRecord = {
  sourceRow: number;
  serial: string;
  studentName: string;
  className: string;
  section: string;
  expected: ExpectedOutcome;
  reason: string;
};

const names = [
  "आरव शर्मा", "Asha Patel", "प्रयांशु वर्मा", "Mohammed Aariz",
  "Zoë Fernandes", "Ananya Reddy", "Kabir Singh", "मीरा जोशी",
  "A very long fictional student name for layout review",
];

export async function buildSyntheticAcceptanceFixture(directory: string) {
  await mkdir(directory, { recursive: true });
  const records: SyntheticRecord[] = [];
  const rows: unknown[][] = [[
    "Serial Number", "Student Name", "Class", "Section", "Father Name", "Optional Note",
  ]];

  for (let i = 1; i <= 300; i++) {
    let serial = String(i).padStart(3, "0");
    let studentName = names[(i - 1) % names.length];
    let expected: ExpectedOutcome = "EXPECTED_IMPORT";
    let reason = "Unique serial and non-empty student name.";

    if (i === 42 || i === 43) {
      serial = i === 42 ? "042" : "42";
      expected = "EXPECTED_REJECT";
      reason = "Duplicate canonical serial pair (042 / 42); neither row should be silently treated as a unique student.";
    } else if (i === 100) {
      serial = "";
      expected = "EXPECTED_REJECT";
      reason = "Missing required serial number.";
    } else if (i === 101) {
      studentName = "";
      expected = "EXPECTED_REVIEW";
      reason = "Missing student name; must remain visible for human correction and must not be considered print-ready.";
    }

    records.push({
      sourceRow: i + 1, serial, studentName,
      className: String(((i - 1) % 12) + 1),
      section: ["A", "B", "C"][i % 3],
      expected, reason,
    });
    rows.push([
      serial, studentName, String(((i - 1) % 12) + 1),
      ["A", "B", "C"][i % 3], i % 7 ? "Fictional Parent" : "",
      i % 4 ? "" : "optional Unicode: हिन्दी",
    ]);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Synthetic School");
  const spreadsheetPath = path.join(directory, "phase17-synthetic-school-300.xlsx");
  await writeFile(spreadsheetPath, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  const templateSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#f8fafc"/><rect x="12" y="12" width="576" height="876" rx="24" fill="none" stroke="#1d4ed8" stroke-width="8"/><rect x="210" y="35" width="180" height="90" rx="8" fill="#dbeafe" stroke="#1d4ed8"/><text x="300" y="85" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#1e3a8a">TEST LOGO</text><text x="300" y="165" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#111827">SYNTHETIC SCHOOL</text><rect x="190" y="210" width="220" height="250" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/><text x="300" y="500" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#111827">PHOTO REGION</text><text x="50" y="570" font-family="sans-serif" font-size="20" fill="#111827">Name:</text><text x="50" y="625" font-family="sans-serif" font-size="20" fill="#111827">Serial:</text><text x="50" y="680" font-family="sans-serif" font-size="20" fill="#111827">Class / Section:</text><text x="300" y="830" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#64748b">SYNTHETIC TEST ARTWORK — NOT FOR PRINT</text></svg>`);
  const templatePath = path.join(directory, "phase17-synthetic-template.png");
  await sharp(templateSvg).png().toFile(templatePath);

  const photosDirectory = path.join(directory, "photos");
  await mkdir(photosDirectory, { recursive: true });
  const photos: string[] = [];
  for (let i = 1; i <= 300; i++) {
    // Deliberately omit photo 017 to exercise the missing-photo path.
    if (i === 17) continue;
    const serial = String(i).padStart(3, "0");
    const photoSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#dbeafe"/><circle cx="320" cy="245" r="130" fill="#f2c9a5"/><path d="M190 230 Q180 80 320 95 Q460 80 450 230 L430 185 Q320 140 210 185Z" fill="#334155"/><path d="M125 790 Q130 490 320 475 Q510 490 515 790Z" fill="#2563eb"/><circle cx="275" cy="245" r="10" fill="#111827"/><circle cx="365" cy="245" r="10" fill="#111827"/><path d="M280 305 Q320 335 360 305" stroke="#7c2d12" stroke-width="8" fill="none" stroke-linecap="round"/><text x="320" y="750" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#fff">SYNTHETIC ${serial}</text></svg>`);
    const photoPath = path.join(photosDirectory, `${serial}_Synthetic_Student.jpg`);
    await sharp(photoSvg).jpeg({ quality: 78 }).toFile(photoPath);
    photos.push(photoPath);
  }
  // Same bytes under a second filename; the duplicate must not become an approved photo.
  await writeFile(path.join(photosDirectory, "001_duplicate.jpg"), await import("node:fs/promises").then(fs => fs.readFile(photos[0])));
  await writeFile(path.join(photosDirectory, "photo.jpg"), Buffer.from("not an image"));
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#fff"/></svg>')).png().toFile(path.join(photosDirectory, "low_resolution.png"));

  const manifest = {
    schemaVersion: 1,
    syntheticOnly: true,
    totalSpreadsheetRecords: records.length,
    records,
    photoFiles: photos.length + 3,
    specialPhotoCases: [
      { filename: "017_Synthetic_Student.jpg", expected: "MISSING_PHOTO", reason: "Intentionally omitted." },
      { filename: "001_duplicate.jpg", expected: "DUPLICATE_PHOTO", reason: "Byte-identical to 001_Synthetic_Student.jpg." },
      { filename: "photo.jpg", expected: "INVALID_IMAGE", reason: "Intentionally corrupt bytes." },
      { filename: "low_resolution.png", expected: "NEEDS_REVIEW", reason: "16×16 low-resolution image." },
    ],
  };
  const manifestPath = path.join(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { spreadsheetPath, templatePath, photosDirectory, manifestPath, manifest };
}
