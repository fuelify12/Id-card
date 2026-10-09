import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

export type ExportSeverity = "CRITICAL" | "ERROR" | "WARNING" | "INFO";
export type ExportCardLike = {
  id: string; student_id: string | null; serial_number: number; status: string;
  validation_status: string; approval_status: string; storage_path: string | null;
  output_sha256: string | null; output_format: string | null; card_side?: string | null;
};
export function safeFilenamePart(input: unknown, fallback = "card", maxLength = 80): string {
  const raw = String(input ?? "").normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/g, "-");
  const safe = raw.replace(/[^\p{L}\p{N}._ -]/gu, "").replace(/\s+/g, "_").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "").replace(/[-_]{2,}/g, "_").slice(0, maxLength);
  return safe && safe !== "." && safe !== ".." ? safe : fallback;
}
export function uniqueArchiveName(candidate: string, used: Set<string>): string {
  const parts = candidate.split("/");
  const leaf = parts.pop() || "card";
  const dot = leaf.lastIndexOf(".");
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const ext = dot > 0 ? leaf.slice(dot) : "";
  let name = candidate, n = 2;
  while (used.has(name.toLocaleLowerCase("en-US"))) name = [...parts, `${stem}_${n++}${ext}`].join("/");
  used.add(name.toLocaleLowerCase("en-US"));
  return name;
}
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}
export function buildManifests(items: Array<Record<string, unknown>>, exportId: string, createdAt: string) {
  const columns = ["item_number","serial_number","student_ref","filename","side","format","validation_status","template_version","batch_id","exported_at"];
  const csv = [columns.join(","), ...items.map((item, i) => columns.map((key) => csvCell(item[key] ?? (key === "item_number" ? i + 1 : ""))).join(","))].join("\r\n") + "\r\n";
  const json = JSON.stringify({ schema_version: 1, export_id: exportId, exported_at: createdAt, item_count: items.length, items }, null, 2) + "\n";
  return { csv, json };
}
export function sourceFormatSupports(sourceInput: unknown, requested: string): boolean { const source=String(sourceInput??"").toLowerCase()==="jpg"?"jpeg":String(sourceInput??"").toLowerCase(); if(requested==="original")return ["png","jpeg","pdf"].includes(source); if(requested==="pdf")return source==="pdf"; if(requested==="png"||requested==="jpeg")return source==="png"||source==="jpeg"; return false; }
export function chooseCardSides<T extends {side:string;eligible:boolean;format:string}>(cards:T[], requestedSide:"front"|"both", format:string):{items:T[];reason?:string}{const wanted=requestedSide==="front"?["front"]:["front","back"];const selected:T[]=[];for(const side of wanted){const candidates=cards.filter(c=>c.side===side&&c.eligible&&sourceFormatSupports(c.format,format));if(candidates.length!==1)return {items:[],reason:candidates.length===0?"A required card side is missing, invalid, unapproved, stale, or unavailable in the requested format.":"Multiple outputs exist for the same student and card side."};selected.push(candidates[0]);}return {items:selected};}
export function exportEligibilityReasons(card: ExportCardLike, unresolved: Array<{severity:string; status:string}> = [], allowWarnings = false): string[] {
  const reasons: string[] = [];
  if (card.status !== "generated") reasons.push("Card generation did not complete successfully.");
  if (card.approval_status !== "approved") reasons.push("Card has not been explicitly approved.");
  if (!["passed", ...(allowWarnings ? ["warning"] : [])].includes(card.validation_status)) reasons.push("Card does not satisfy the configured validation policy.");
  if (!card.storage_path || !card.output_sha256) reasons.push("Stored output or integrity hash is missing.");
  if (unresolved.some(f => f.status === "OPEN" || f.status === "IN_REVIEW")) {
    const blocking = unresolved.filter(f => ["CRITICAL","ERROR"].includes(f.severity) && ["OPEN","IN_REVIEW"].includes(f.status));
    if (blocking.length) reasons.push("Unresolved critical/error validation findings exist.");
    else if (!allowWarnings && unresolved.some(f => f.severity === "WARNING" && ["OPEN","IN_REVIEW"].includes(f.status))) reasons.push("Unresolved warnings require review under this project's policy.");
  }
  return reasons;
}
export function verifyZipDirectory(bytes: Uint8Array, expectedNames: string[]): {ok:boolean;reason?:string;names:string[]} {
  try {
    if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return {ok:false,reason:"ZIP signature is missing.",names:[]};
    // fflate's unzip validates the central directory and entry CRCs. Export archives are
    // bounded before this call, so verification has a deterministic upper memory limit.
    const files = unzipSync(bytes);
    const names = Object.keys(files);
    if (names.some(n => n.startsWith("/") || n.includes("\\") || n.split("/").some(p => p === ".." || p === "."))) return {ok:false,reason:"Unsafe archive path detected.",names};
    if (new Set(names.map(n => n.toLocaleLowerCase("en-US"))).size !== names.length) return {ok:false,reason:"Duplicate archive entry names detected.",names};
    const actual = new Set(names), expected = new Set(expectedNames);
    if (actual.size !== expected.size || [...expected].some(n => !actual.has(n))) return {ok:false,reason:"Archive entries do not match the expected manifest.",names};
    return {ok:true,names};
  } catch { return {ok:false,reason:"ZIP archive is corrupt or cannot be opened.",names:[]}; }
}
export function sha256(bytes: Uint8Array | Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
