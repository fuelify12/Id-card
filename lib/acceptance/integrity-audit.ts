export type AcceptanceStatus = "SUCCEEDED" | "FAILED" | "NEEDS_REVIEW" | "SKIPPED";

export type IntegrityChainRecord = {
  sourceRowId: string;
  studentId: string;
  sourceSerial: string;
  normalizedSerial: string;
  requiredFieldsPresent: boolean;
  matchedPhotoStudentId: string | null;
  matchedPhotoSha256: string | null;
  approvedPhotoSha256: string | null;
  renderedStudentId: string | null;
  renderedSerial: string | null;
  renderedPhotoSha256: string | null;
  renderedTemplateVersion: number | null;
  expectedTemplateVersion: number;
  status: AcceptanceStatus;
  outputFilename: string | null;
  outputSha256: string | null;
};

export type IntegrityManifestEntry = {
  studentId: string;
  serialNumber: string;
  filename: string;
  sha256: string;
};

export type IntegrityIssue = {
  code: string;
  studentId: string;
  message: string;
};

export type IntegrityAuditResult = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  needsReview: number;
  issues: IntegrityIssue[];
  humanReviewRequired: string[];
  ok: boolean;
};

/**
 * Audits deterministic identifiers, approvals, renderer metadata, hashes, archive
 * membership and manifest correspondence. It cannot prove that a photograph
 * depicts the named child; visual operator approval remains a separate gate.
 */
export function auditStudentCardIntegrity(
  records: IntegrityChainRecord[],
  manifest: IntegrityManifestEntry[],
  archiveFiles: Record<string, string>,
): IntegrityAuditResult {
  const issues: IntegrityIssue[] = [];
  const humanReviewRequired: string[] = [];
  const issue = (code: string, studentId: string, message: string) => issues.push({ code, studentId, message });
  const countSerials = new Map<string, number>();
  const countStudentIds = new Map<string, number>();
  const countOutputNames = new Map<string, number>();
  const manifestByStudent = new Map<string, IntegrityManifestEntry[]>();
  const manifestByName = new Map<string, IntegrityManifestEntry[]>();

  for (const r of records) {
    countStudentIds.set(r.studentId, (countStudentIds.get(r.studentId) ?? 0) + 1);
    if (r.normalizedSerial) countSerials.set(r.normalizedSerial, (countSerials.get(r.normalizedSerial) ?? 0) + 1);
    if (r.outputFilename) countOutputNames.set(r.outputFilename.toLocaleLowerCase("en-US"), (countOutputNames.get(r.outputFilename.toLocaleLowerCase("en-US")) ?? 0) + 1);
  }
  for (const e of manifest) {
    manifestByStudent.set(e.studentId, [...(manifestByStudent.get(e.studentId) ?? []), e]);
    manifestByName.set(e.filename.toLocaleLowerCase("en-US"), [...(manifestByName.get(e.filename.toLocaleLowerCase("en-US")) ?? []), e]);
  }

  for (const r of records) {
    if (countStudentIds.get(r.studentId)! > 1) issue("DUPLICATE_STUDENT_ID", r.studentId, "Student identifier appears more than once in the audit input.");
    if (r.normalizedSerial && countSerials.get(r.normalizedSerial)! > 1) issue("DUPLICATE_SERIAL", r.studentId, "Canonical serial number is not unique; outputs must not be treated as unambiguous.");
    if (r.status !== "SUCCEEDED") {
      if (manifestByStudent.has(r.studentId)) issue("INELIGIBLE_IN_MANIFEST", r.studentId, "Failed, skipped, or review-required record appears in the export manifest.");
      if (r.outputFilename && archiveFiles[r.outputFilename] !== undefined) issue("INELIGIBLE_ARCHIVE_FILE", r.studentId, "Failed, skipped, or review-required record has a card file in the accepted archive.");
      continue;
    }
    if (!r.requiredFieldsPresent) issue("REQUIRED_FIELDS_MISSING", r.studentId, "Required mapped fields are missing.");
    if (r.matchedPhotoStudentId !== r.studentId) issue("PHOTO_STUDENT_MISMATCH", r.studentId, "Matched photograph is not associated with this student.");
    if (!r.matchedPhotoSha256 || r.approvedPhotoSha256 !== r.matchedPhotoSha256) issue("PHOTO_NOT_APPROVED_OR_CHANGED", r.studentId, "Approved photo hash is absent or differs from the matched photo.");
    if (r.renderedStudentId !== r.studentId) issue("RENDERED_STUDENT_MISMATCH", r.studentId, "Rendered card is not linked to the expected student.");
    if (r.renderedSerial !== r.sourceSerial) issue("RENDERED_SERIAL_MISMATCH", r.studentId, "Rendered serial does not preserve the source serial string.");
    if (r.renderedPhotoSha256 !== r.approvedPhotoSha256) issue("RENDERED_PHOTO_MISMATCH", r.studentId, "Rendered card metadata does not reference the approved photo hash.");
    if (r.renderedTemplateVersion !== r.expectedTemplateVersion) issue("STALE_TEMPLATE_VERSION", r.studentId, "Rendered output was produced from a different template version.");
    if (!r.outputFilename || !r.outputSha256) {
      issue("OUTPUT_METADATA_MISSING", r.studentId, "Successful status lacks an output filename or SHA-256 hash.");
      continue;
    }
    if (countOutputNames.get(r.outputFilename.toLocaleLowerCase("en-US"))! > 1) issue("DUPLICATE_OUTPUT_NAME", r.studentId, "Multiple records target the same output filename.");
    const archiveHash = archiveFiles[r.outputFilename];
    if (!archiveHash) issue("ARCHIVE_FILE_MISSING", r.studentId, "Manifested card output is missing from the archive.");
    else if (archiveHash !== r.outputSha256) issue("ARCHIVE_HASH_MISMATCH", r.studentId, "Archive file hash does not match the rendered output hash.");

    const entries = manifestByStudent.get(r.studentId) ?? [];
    const matching = entries.filter(e => e.filename === r.outputFilename && e.serialNumber === r.sourceSerial && e.sha256 === r.outputSha256);
    if (matching.length !== 1 || entries.length !== 1) issue("MANIFEST_MISMATCH", r.studentId, "Manifest does not contain exactly one matching entry for this card.");
    if ((manifestByName.get(r.outputFilename.toLocaleLowerCase("en-US")) ?? []).length > 1) issue("DUPLICATE_MANIFEST_NAME", r.studentId, "Manifest contains duplicate output filenames.");
    humanReviewRequired.push(r.studentId);
  }

  for (const e of manifest) {
    if (!records.some(r => r.studentId === e.studentId && r.status === "SUCCEEDED" && r.outputFilename === e.filename && r.outputSha256 === e.sha256)) {
      issue("ORPHAN_MANIFEST_ENTRY", e.studentId, "Manifest entry does not correspond to an eligible successful record.");
    }
    if (archiveFiles[e.filename] === undefined) issue("MANIFEST_FILE_MISSING", e.studentId, "Manifest references a file absent from the archive.");
  }
  for (const filename of Object.keys(archiveFiles)) {
    if (!manifest.some(e => e.filename === filename)) issue("UNMANIFESTED_ARCHIVE_FILE", filename, "Archive contains a card file not represented in the manifest.");
  }

  const succeeded = records.filter(r => r.status === "SUCCEEDED").length;
  const failed = records.filter(r => r.status === "FAILED").length;
  const skipped = records.filter(r => r.status === "SKIPPED").length;
  const needsReview = records.filter(r => r.status === "NEEDS_REVIEW").length;
  return {
    total: records.length,
    succeeded,
    failed,
    skipped,
    needsReview,
    issues,
    humanReviewRequired,
    ok: issues.length === 0 && succeeded + failed + skipped + needsReview === records.length,
  };
}
