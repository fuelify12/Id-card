import {describe,expect,it} from "vitest";
import {validateStudents} from "@/lib/validation/engine";

describe("required student field validation",()=>{
 it("recognizes template fields when spreadsheet headers use common aliases",()=>{
  const findings=validateStudents([{id:"student-1",serial_number:1,data:{"Student Name":"Aarav Sharma","Father's Name":"Ravi Sharma","Class":"VIII","Section":"B","Admission Number":"A-12","Address":"Village Rampur, Firozabad, Uttar Pradesh","Academic Session":"2025–26"}}],["father_name","class_sec","admission_no","address_line_1","address_line_2","session_start","session_end"]);
  expect(findings.filter(f=>f.ruleId==="STUDENT_REQUIRED_FIELD_MISSING")).toEqual([]);
 });
 it("does not claim a second address line exists when a short address cannot be split",()=>{
  const findings=validateStudents([{id:"student-2",serial_number:2,data:{"Student Name":"Sia","Address":"Agra"}}],["address_line_2"]);
  expect(findings.some(f=>f.ruleId==="STUDENT_REQUIRED_FIELD_MISSING"&&f.fieldRef==="address_line_2")).toBe(true);
 });
});
