export type IdentifierNormalization = "exact" | "numeric";
export type EdgeWhitespacePolicy = "reject" | "trim";
export type StudentIdentifierPolicy = {
  normalization: IdentifierNormalization;
  caseSensitive: boolean;
  edgeWhitespace: EdgeWhitespacePolicy;
  maxLength: number;
};
export const DEFAULT_STUDENT_IDENTIFIER_POLICY: Readonly<StudentIdentifierPolicy> = Object.freeze({
  normalization: "exact",
  caseSensitive: true,
  edgeWhitespace: "reject",
  maxLength: 64,
});
export type IdentifierResult =
  | { ok: true; original: string; value: string; key: string; legacySerialNumber: number | null }
  | { ok: false; original: string; error: string };

export function canonicalizeStudentIdentifier(
  input: unknown,
  policy: StudentIdentifierPolicy = DEFAULT_STUDENT_IDENTIFIER_POLICY,
): IdentifierResult {
  if (typeof input !== "string") {
    if (typeof input === "number" && Number.isSafeInteger(input)) {
      input = String(input);
    } else {
      return { ok: false, original: String(input ?? ""), error: "Identifier must be supplied as text." };
    }
  }
  const original = input as string;
  if (!original.length) return { ok: false, original, error: "Identifier is required." };
  if (/[\u0000-\u001f\u007f]/.test(original)) return { ok: false, original, error: "Identifier contains control characters." };
  let value = original;
  if (value !== value.trim()) {
    if (policy.edgeWhitespace === "trim") value = value.trim();
    else return { ok: false, original, error: "Identifier has leading or trailing whitespace; correct it or explicitly enable trimming." };
  }
  if (!value) return { ok: false, original, error: "Identifier is required." };
  if (value.length > Math.max(1, Math.min(64, policy.maxLength))) return { ok: false, original, error: "Identifier exceeds the configured maximum length." };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u.test(value)) {
    return { ok: false, original, error: "Identifier must start with a letter or digit and may contain only letters, digits, dot, underscore, slash, or hyphen." };
  }
  if (policy.normalization === "numeric" && /^\d+$/.test(value)) {
    // BigInt avoids Number precision loss. This transformation is opt-in at project level.
    value = BigInt(value).toString();
  }
  const key = policy.caseSensitive ? value : value.toLocaleLowerCase("en-US");
  const legacySerialNumber = /^\d+$/.test(value) && value === String(Number(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647
    ? Number(value) : null;
  return { ok: true, original, value, key, legacySerialNumber };
}

export function findDuplicateIdentifiers(values: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

export function identifierMatches(left: unknown, right: unknown, policy: StudentIdentifierPolicy = DEFAULT_STUDENT_IDENTIFIER_POLICY): boolean {
  const a = canonicalizeStudentIdentifier(left, policy);
  const b = canonicalizeStudentIdentifier(right, policy);
  return a.ok && b.ok && a.key === b.key;
}

export function studentIdentifierPolicyFromConfig(value: unknown): StudentIdentifierPolicy {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    normalization: raw.normalization === "numeric" ? "numeric" : "exact",
    caseSensitive: raw.caseSensitive === false || raw.case_sensitive === false ? false : true,
    edgeWhitespace: raw.edgeWhitespace === "trim" || raw.edge_whitespace === "trim" ? "trim" : "reject",
    maxLength: typeof raw.maxLength === "number" && Number.isInteger(raw.maxLength) ? Math.max(1, Math.min(64, raw.maxLength))
      : typeof raw.max_length === "number" && Number.isInteger(raw.max_length) ? Math.max(1, Math.min(64, raw.max_length)) : 64,
  };
}
