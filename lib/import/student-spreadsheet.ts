import * as XLSX from "xlsx";

export const MAX_SPREADSHEET_BYTES = 15 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 15_000;
export const MAX_SPREADSHEET_COLUMNS = 200;

export type ImportIssue = {
  row: number;
  column?: string;
  code: "EMPTY_IDENTIFIER" | "DUPLICATE_IDENTIFIER" | "MISSING_REQUIRED_VALUE" | "INVALID_DATE" | "EMPTY_ROW";
  message: string;
};
export type SpreadsheetPreview = {
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: Array<{ sourceRow: number; values: Record<string, string> }>;
  issues: ImportIssue[];
  totalRows: number;
  totalColumns: number;
};
export type TemplateField = { key: string; label: string; required?: boolean };
export type FieldMapping = Record<string, string | null>;

function normalizeHeader(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s_./-]+/g, " ");
}

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  // Use the cell's number format (e.g. 000) when Excel stores a zero-padded ID as a number.
  // If the source workbook discarded that format, the original zeros cannot be recovered safely.
  if (cell.t === "n" && cell.z) {
    try { return XLSX.utils.format_cell(cell).trim(); } catch { /* fall through to the stored value */ }
  }
  if (cell.t === "d" && cell.v instanceof Date) {
    return Number.isNaN(cell.v.getTime()) ? "" : cell.v.toISOString().slice(0, 10);
  }
  return String(cell.w ?? cell.v).trim();
}

export function parseStudentSpreadsheet(
  input: ArrayBuffer | Uint8Array,
  options: { fileName: string; selectedSheet?: string; headerRow?: number; identifierColumn?: string; requiredColumns?: string[] }
): SpreadsheetPreview {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length) throw new Error("The selected spreadsheet is empty.");
  if (bytes.byteLength > MAX_SPREADSHEET_BYTES) throw new Error("Spreadsheet exceeds the 15 MB import limit.");
  const extension = options.fileName.toLowerCase().split(".").pop();
  if (!["csv", "xlsx", "xls"].includes(extension ?? "")) throw new Error("Supported import formats are CSV, XLSX, and XLS.");
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true, cellNF: true, cellText: true, bookVBA: false });
  if (!workbook.SheetNames.length) throw new Error("No worksheets were found in this file.");
  const selectedSheet = options.selectedSheet ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheet];
  if (!sheet) throw new Error("Select a worksheet that exists in this workbook.");
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const headerRow = Math.max(1, Math.floor(options.headerRow ?? 1));
  if (range.e.c - range.s.c + 1 > MAX_SPREADSHEET_COLUMNS) throw new Error("Spreadsheet exceeds the 200-column limit.");
  if (range.e.r - headerRow + 1 > MAX_SPREADSHEET_ROWS + 1) throw new Error("Spreadsheet exceeds the 15,000-row import limit.");
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const value = cellText(sheet[XLSX.utils.encode_cell({ r: headerRow - 1, c })]);
    headers.push(value || `Column ${c - range.s.c + 1}`);
  }
  if (headers.every((header, i) => !sheet[XLSX.utils.encode_cell({ r: headerRow - 1, c: range.s.c + i })] || /^Column \d+$/.test(header))) {
    throw new Error("A header row is required. Choose the row containing column names.");
  }
  const seenHeaders = new Set<string>();
  const duplicateHeaders = headers.filter(h => { const key = normalizeHeader(h); if (seenHeaders.has(key)) return true; seenHeaders.add(key); return false; });
  if (duplicateHeaders.length) throw new Error(`Duplicate column headers found: ${[...new Set(duplicateHeaders)].join(", ")}. Rename them before importing.`);

  const rows: SpreadsheetPreview["rows"] = [];
  const issues: ImportIssue[] = [];
  const idColumn = options.identifierColumn;
  const seenIds = new Map<string, number>();
  for (let r = headerRow; r <= range.e.r; r++) {
    const values: Record<string, string> = {};
    let nonEmpty = false;
    headers.forEach((header, i) => {
      const value = cellText(sheet[XLSX.utils.encode_cell({ r, c: range.s.c + i })]);
      values[header] = value;
      if (value !== "") nonEmpty = true;
    });
    if (!nonEmpty) continue; // Blank spreadsheet rows are ignored, not counted as students.
    const sourceRow = r + 1;
    rows.push({ sourceRow, values });
    if (idColumn) {
      const id = values[idColumn]?.trim() ?? "";
      if (!id) issues.push({ row: sourceRow, column: idColumn, code: "EMPTY_IDENTIFIER", message: `Required identifier "${idColumn}" is empty.` });
      else {
        const prior = seenIds.get(id);
        if (prior !== undefined) issues.push({ row: sourceRow, column: idColumn, code: "DUPLICATE_IDENTIFIER", message: `Identifier duplicates row ${prior}; resolve it before import.` });
        else seenIds.set(id, sourceRow);
      }
    }
    for (const column of options.requiredColumns ?? []) {
      if (!values[column]?.trim()) issues.push({ row: sourceRow, column, code: "MISSING_REQUIRED_VALUE", message: `Required value "${column}" is empty.` });
    }
  }
  if (!rows.length) throw new Error("No student rows were found below the selected header row.");
  return { sheetNames: workbook.SheetNames, selectedSheet, headers, rows, issues, totalRows: rows.length, totalColumns: headers.length };
}

export function suggestFieldMappings(headers: string[], fields: TemplateField[]): FieldMapping {
  const result: FieldMapping = {};
  const normalized = headers.map(header => ({ header, key: normalizeHeader(header) }));
  for (const field of fields) {
    const candidates = [field.key, field.label].map(normalizeHeader).filter(Boolean);
    const matches = normalized.filter(item => candidates.includes(item.key));
    // Only a single exact normalized match is safe to suggest. Ambiguity stays unmapped.
    result[field.key] = matches.length === 1 ? matches[0].header : null;
  }
  return result;
}

export function validateMappedRows(
  rows: SpreadsheetPreview["rows"],
  fields: TemplateField[],
  mapping: FieldMapping
): Array<{ sourceRow: number; values: Record<string, string>; errors: string[] }> {
  return rows.map(row => {
    const values: Record<string, string> = {};
    const errors: string[] = [];
    for (const field of fields) {
      const column = mapping[field.key];
      const value = column ? row.values[column] ?? "" : "";
      values[field.key] = value;
      if (field.required && !value.trim()) errors.push(`Required field "${field.label}" is unmapped or empty.`);
    }
    return { sourceRow: row.sourceRow, values, errors };
  });
}
