import {describe,expect,it} from "vitest";
import {autoMapFields,type Field} from "@/lib/imports/template-field-mapping";

function field(key:string,label:string,x:number):Field{
 return {id:key,key,label,field_type:key==="student_photo"?"photo":"text",required:true,x,y:10,width:100,height:24,font_family:"Noto Sans",font_size:18,font_weight:"400",color:"#000000",alignment:"left",fit_mode:"contain",source_column:null,confidence:.9,render_options:{}};
}

describe("template field auto-mapping",()=>{
 it("maps common header variants for name, father, admission, and photo",()=>{
  const fields=[field("student_name","Student Name",10),field("father_name","Father's Name",40),field("admission_no","Admission No.",70),field("student_photo","Student Photo",100)];
  const mapped=autoMapFields(fields,["Student Full Name","Father’s Name","Admission Number","Photo Filename"]);
  expect(mapped.map(f=>f.source_column)).toEqual(["Student Full Name","Father’s Name","Admission Number","Photo Filename"]);
 });
 it("composes Class & Sec from separate columns and splits a combined session year",()=>{
  const fields=[field("class_sec","Class & Sec",10),field("session_start","Session",100),field("session_end","Session",300)];
  const mapped=autoMapFields(fields,["Class","Section","Academic Session"]);
  expect(mapped[0].source_column).toBe("Class");
  expect(mapped[0].render_options?.valueTransform).toBe("class_section");
  expect(mapped[0].render_options?.valueTransformSecondaryColumn).toBe("Section");
  expect(mapped[1].source_column).toBe("Academic Session");
  expect(mapped[1].render_options?.valueTransform).toBe("session_start");
  expect(mapped[2].source_column).toBe("Academic Session");
  expect(mapped[2].render_options?.valueTransform).toBe("session_end");
 });
 it("uses a single Address column for two address lines when separate line columns are absent",()=>{
  const mapped=autoMapFields([field("address_line_1","Address Line 1",10),field("address_line_2","Address Line 2",30)],["Address"]);
  expect(mapped.map(f=>f.source_column)).toEqual(["Address","Address"]);
  expect(mapped.map(f=>f.render_options?.valueTransform)).toEqual(["address_line_1","address_line_2"]);
 });
 it("does not guess between similarly named headers when there is no clear match",()=>{
  const mapped=autoMapFields([field("father_name","Father's Name",10)],["Student Name","Parent Name"]);
  expect(mapped[0].source_column).toBeNull();
 });
});
