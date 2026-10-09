import {describe,expect,it} from "vitest";
import * as XLSX from "xlsx";
import {parseWorkbook,normalizeColumnName,validateStudentRows} from "@/lib/imports/student-spreadsheet";
function workbook(rows: unknown[][], name="students.xlsx") { const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),"Students");return {buffer:XLSX.write(wb,{type:"array",bookType:name.endsWith(".csv")?"csv":"xlsx"}),name};}
describe("student spreadsheet import",()=>{
 it("detects headers and serial column despite title rows",()=>{const x=workbook([["School list"],["Generated"],["Serial No","Name","Father Name","Class"],[1,"Asha","Ravi","5"],[2,"Imran","Salim","6"]]);const p=parseWorkbook(x.buffer,x.name);expect(p.headerRow).toBe(3);expect(p.serialColumn).toBe("Serial No");expect(p.summary.total).toBe(2);});
 it("preserves values and flags duplicate, missing serial and blank rows",()=>{const x=workbook([["S.No","Name","DOB"],[1,"Asha","2014-01-02"],[1,"Ravi",null],[null,"Missing serial",null],[null,null,null]]);const p=parseWorkbook(x.buffer,x.name);expect(p.summary.duplicates).toBe(2);expect(p.summary.missingSerial).toBe(1);expect(p.summary.blank).toBe(1);expect(p.rows[0].values.Name).toBe("Asha");});
 it("normalizes names deterministically",()=>{expect(normalizeColumnName("  Father_Name. ")).toBe("father name");});
 it("scales to 10,000 records without dropping rows",()=>{const rows:unknown[][]=[["Serial","Name","Class"]];for(let i=1;i<=10000;i++)rows.push([i,`Student ${i}`,String(i%12+1)]);const x=workbook(rows);const p=parseWorkbook(x.buffer,x.name);expect(p.summary.total).toBe(10000);expect(p.summary.invalid).toBe(0);});
 it("revalidates rows when the user changes serial column",()=>{const x=workbook([["Serial","ID","Name"],[null,7,"A"],[null,8,"B"]]);const p=parseWorkbook(x.buffer,x.name);const fixed=p.rows.map(r=>({...r,values:{...r.values,Serial:r.values.ID}}));expect(validateStudentRows(fixed,"Serial").every(r=>r.serialNumber)).toBe(true);});
});
