import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseStudentSpreadsheet, suggestFieldMappings, validateMappedRows } from "@/lib/import/student-spreadsheet";

function csvBytes(text: string) { return new TextEncoder().encode(text); }

describe("student spreadsheet import safety", () => {
  it("parses CSV, keeps extra columns available, skips blank rows, and preserves Unicode", () => {
    const parsed = parseStudentSpreadsheet(csvBytes("Admission No,Student Name,Extra\n001,आरव शर्मा,ignore\n,,\n002,Long Name,unused\n"), { fileName: "students.csv", identifierColumn: "Admission No" });
    expect(parsed.totalRows).toBe(2);
    expect(parsed.headers).toEqual(["Admission No", "Student Name", "Extra"]);
    expect(parsed.rows[0].values["Admission No"]).toBe("001");
    expect(parsed.rows[0].values["Student Name"]).toBe("आरव शर्मा");
    expect(parsed.issues).toEqual([]);
  });

  it("preserves Excel zero-padding when it is present in the number format", () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Roll"], [1], [2]]);
    sheet.A2.z = "000";
    sheet.A2.w = "001";
    XLSX.utils.book_append_sheet(book, sheet, "Students");
    const parsed = parseStudentSpreadsheet(XLSX.write(book, { type: "array", bookType: "xlsx" }), { fileName: "students.xlsx", identifierColumn: "Roll" });
    expect(parsed.rows[0].values.Roll).toBe("001");
  });

  it("reports duplicate and missing identifiers before import", () => {
    const parsed = parseStudentSpreadsheet(csvBytes("ID,Name\n001,A\n001,B\n,C\n"), { fileName: "students.csv", identifierColumn: "ID", requiredColumns: ["Name"] });
    expect(parsed.issues.map(issue => issue.code)).toEqual(["DUPLICATE_IDENTIFIER", "EMPTY_IDENTIFIER"]);
  });

  it("rejects duplicate headers and unsupported file types", () => {
    expect(() => parseStudentSpreadsheet(csvBytes("Name,name\nA,B\n"), { fileName: "students.csv" })).toThrow(/Duplicate column headers/);
    expect(() => parseStudentSpreadsheet(csvBytes("x"), { fileName: "students.xlsm" })).toThrow(/Supported import formats/);
  });

  it("maps only unambiguous exact column names and validates required mapped fields", () => {
    const fields = [{ key: "student_name", label: "Student Name", required: true }, { key: "class", label: "Class", required: true }];
    const mapping = suggestFieldMappings(["Student Name", "Class", "Extra"], fields);
    expect(mapping).toEqual({ student_name: "Student Name", class: "Class" });
    const ambiguous = suggestFieldMappings(["Student Name", "student_name"], fields.slice(0, 1));
    expect(ambiguous.student_name).toBeNull();
    const checked = validateMappedRows([{ sourceRow: 2, values: { "Student Name": "A", Class: "" } }], fields, mapping);
    expect(checked[0].values).toEqual({ student_name: "A", class: "" });
    expect(checked[0].errors).toHaveLength(1);
  });

  it("rejects empty and oversized input", () => {
    expect(() => parseStudentSpreadsheet(new Uint8Array(), { fileName: "students.csv" })).toThrow(/empty/);
    expect(() => parseStudentSpreadsheet(new Uint8Array(15 * 1024 * 1024 + 1), { fileName: "students.csv" })).toThrow(/15 MB/);
  });
});
