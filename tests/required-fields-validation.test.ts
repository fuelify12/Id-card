import {describe,expect,it} from "vitest";
import {requiredFieldValue,validateStudents} from "@/lib/validation/engine";

describe("required student field validation",()=>{
 it("recognizes template fields when spreadsheet headers use common aliases",()=>{
  const findings=validateStudents([{id:"student-1",serial_number:1,data:{"Student Name":"Aarav Sharma","Father's Name":"Ravi Sharma","Class":"VIII","Section":"B","Admission Number":"A-12","Address":"Village Rampur, Firozabad, Uttar Pradesh","Academic Session":"2025–26"}}],["father_name","class_sec","admission_no","address_line_1","address_line_2","session_start","session_end"]);
  expect(findings.filter(f=>f.ruleId==="STUDENT_REQUIRED_FIELD_MISSING")).toEqual([]);
 });
 it("does not claim a second address line exists when a short address cannot be split",()=>{
  const findings=validateStudents([{id:"student-2",serial_number:2,data:{"Student Name":"Sia","Address":"Agra"}}],["address_line_2"]);
  expect(findings.some(f=>f.ruleId==="STUDENT_REQUIRED_FIELD_MISSING"&&f.fieldRef==="address_line_2")).toBe(true);
 });
 it("resolves mapped values through normalized headers and aliases used by preflight",()=>{
  const data={
   "Student Full Name":"Aarav Sharma",
   "Father Name":"Ravi Sharma",
   "Grade":"V",
   "Section Name":"A",
   "Admission No":"A-12",
   "Academic Year":"2025-2026",
   "Complete Address":"Village Rampur, Firozabad, Uttar Pradesh",
   "Address Line 1":"Ward 5"
  };
  expect(requiredFieldValue(data,"Student Name")).toBe("Aarav Sharma");
  expect(requiredFieldValue(data,"Father's Name")).toBe("Ravi Sharma");
  expect(requiredFieldValue(data,"Class & Sec")).toBe("V - A");
  expect(requiredFieldValue(data,"Admission Number")).toBe("A-12");
  expect(requiredFieldValue(data,"Session")).toBe("2025-2026");
  expect(requiredFieldValue(data,"Address Line 1")).toBe("Ward 5");
  expect(requiredFieldValue(data,"Address Line 2")).toBe("Firozabad, Uttar Pradesh");
 });
 it("does not raise generic project-required findings for supported header aliases",()=>{
  const findings=validateStudents([{id:"student-3",serial_number:3,data:{"Student Full Name":"Aarav Sharma","Father Name":"Ravi Sharma","Grade":"V","Section Name":"A","Academic Year":"2025-2026"}}],["father's name","class","section","session"]);
  expect(findings.filter(f=>f.ruleId==="STUDENT_REQUIRED_FIELD_MISSING")).toEqual([]);
  expect(findings.some(f=>f.ruleId==="STUDENT_NAME_MISSING")).toBe(false);
 });
});