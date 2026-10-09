import * as XLSX from "xlsx";

export type CellValue = string | number | boolean | null;
export type ParsedStudentRow = { sourceRow: number; values: Record<string, CellValue>; serialNumber: string | null; issues: string[]; blank: boolean };
export type SpreadsheetPreview = { sheetName: string; headers: string[]; normalizedHeaders: string[]; headerRow: number; serialColumn: string | null; rows: ParsedStudentRow[]; summary: { total: number; blank: number; missingSerial: number; duplicates: number; invalid: number } };
const SERIAL_HEADERS = new Set(["serial","serialno","serialnumber","sno","srno","srnumber","srlno","studentno","studentnumber","क्रमांक","क्रमसंख्या","अनुक्रमांक"]);
export function normalizeColumnName(value: unknown, index = 0): string {
  const s = String(value ?? "").normalize("NFKC").trim().toLowerCase()
    .replace(/[.()\[\]{}]/g, " ").replace(/[\s_\-/\\]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();
  return s || `column ${index + 1}`;
}
export function detectSerialColumn(headers: string[]): string | null {
  const exact = headers.find(h => SERIAL_HEADERS.has(normalizeColumnName(h).replace(/\s/g, "")));
  if (exact) return exact;
  const likely = headers.filter(h => /(^|\b)(serial|s\.?\s?no|sr\.?\s?no|sno|student no|क्रमांक|अनुक्रमांक)(\b|$)/i.test(h.trim()));
  return likely.length === 1 ? likely[0] : null;
}
function cellText(v: unknown): CellValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  if (typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0,10);
  return String(v);
}
function rowBlank(row: unknown[]) { return row.every(v => v === null || v === undefined || String(v).trim() === ""); }
export function parseWorkbook(buffer: ArrayBuffer, fileName: string): SpreadsheetPreview {
  if (buffer.byteLength > 25 * 1024 * 1024) throw new Error("Spreadsheet exceeds 25 MB.");
  const ext = fileName.toLowerCase().split(".").pop();
  if (!["csv","xlsx","xls"].includes(ext || "")) throw new Error("Upload CSV, XLSX, or XLS files only.");
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, dense: true, raw: true });
  if (!wb.SheetNames.length) throw new Error("Workbook has no worksheets.");
  const candidates = wb.SheetNames.map((name, order) => {
    const sheet = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true }) as unknown[][];
    const scan = matrix.slice(0, 30).map((row, i) => ({ row, i, filled: row.filter(v => v !== null && v !== undefined && String(v).trim() !== "").length }));
    const best = scan.filter(x => x.filled >= 2).sort((a,b) => b.filled-a.filled || a.i-b.i)[0];
    return { name, order, matrix, headerIndex: best?.i ?? -1, score: best?.filled ?? 0 };
  }).sort((a,b) => b.score-a.score || a.order-b.order);
  const chosen = candidates[0];
  if (!chosen || chosen.headerIndex < 0) throw new Error("Could not find a header row with at least two non-empty cells in the first 30 rows.");
  const headerRow = chosen.matrix[chosen.headerIndex];
  const headers: string[] = [];
  const used = new Map<string, number>();
  for (let i=0;i<headerRow.length;i++) {
    const original = String(headerRow[i] ?? "").trim();
    if (!original) continue;
    const base = original;
    const count = (used.get(normalizeColumnName(base)) ?? 0)+1;
    used.set(normalizeColumnName(base),count);
    headers.push(count===1 ? base : `${base} (${count})`);
  }
  const indexes = headerRow.map((v,i)=>({v,i})).filter(x=>String(x.v??"").trim()!=="");
  const normalizedHeaders = headers.map((h,i)=>normalizeColumnName(h,i));
  const serialColumn = detectSerialColumn(headers);
  const serialIndex = serialColumn ? headers.indexOf(serialColumn) : -1;
  const rows: ParsedStudentRow[] = [];
  for (let r=chosen.headerIndex+1;r<chosen.matrix.length;r++) {
    const raw = chosen.matrix[r] ?? [];
    const blank = rowBlank(raw);
    const values: Record<string,CellValue> = {};
    indexes.forEach((x,i)=>{ values[headers[i]] = cellText(raw[x.i]); });
    if (blank) { rows.push({sourceRow:r+1,values,serialNumber:null,issues:["Blank row"],blank:true}); continue; }
    const rawSerial = serialIndex >= 0 ? raw[indexes[serialIndex]?.i] : null;
    const serialNumber = rawSerial === null || rawSerial === undefined || String(rawSerial).trim()==="" ? null : String(rawSerial).trim();
    const issues: string[] = [];
    if (!serialColumn) issues.push("Serial-number column not detected; choose a column before importing.");
    else if (!serialNumber) issues.push("Missing serial number");
    rows.push({sourceRow:r+1,values,serialNumber,issues,blank:false});
  }
  const counts = new Map<string,number>();
  rows.forEach(r=>{ if(r.serialNumber) counts.set(r.serialNumber,(counts.get(r.serialNumber)??0)+1); });
  rows.forEach(r=>{ if(r.serialNumber && (counts.get(r.serialNumber)??0)>1) r.issues.push("Duplicate serial number"); });
  const dataRows = rows.filter(r=>!r.blank);
  return {sheetName:chosen.name,headers,normalizedHeaders,headerRow:chosen.headerIndex+1,serialColumn,rows,summary:{total:dataRows.length,blank:rows.filter(r=>r.blank).length,missingSerial:dataRows.filter(r=>!r.serialNumber).length,duplicates:dataRows.filter(r=>r.issues.includes("Duplicate serial number")).length,invalid:dataRows.filter(r=>r.issues.length>0).length}};
}
export function validateStudentRows(rows: ParsedStudentRow[], serialColumn: string | null) {
  const seen = new Set<string>();
  return rows.filter(r=>!r.blank).map(r=>{
    const issues = r.issues.filter(i=>!["Serial-number column not detected; choose a column before importing.","Missing serial number","Duplicate serial number"].includes(i));
    const raw = serialColumn ? r.values[serialColumn] : null;
    const serial = raw === null || raw === undefined ? "" : String(raw).trim();
    if (!serial) issues.push("Missing serial number");
    else if (!/^\\d+$/.test(serial)) issues.push("Serial number must be a whole number");
    if (serial && seen.has(serial)) issues.push("Duplicate serial number");
    if (serial) seen.add(serial);
    if (!Object.values(r.values).some(v=>v!==null && String(v).trim()!=="")) issues.push("Row contains no values");
    return {...r,serialNumber:serial||null,issues};
  });
}
