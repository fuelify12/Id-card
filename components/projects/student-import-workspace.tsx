"use client";
import {useMemo,useState} from "react";
import * as XLSX from "xlsx";
import {parseWorkbook,validateStudentRows,type SpreadsheetPreview,type ParsedStudentRow} from "@/lib/imports/student-spreadsheet";
import {importStudentRows,saveTemplateFields} from "@/app/dashboard/actions";

type Field={id:string;key:string;label:string;field_type:string;required:boolean;x:number;y:number;width:number;height:number;font_family:string|null;font_size:number|null;font_weight:string|null;color:string|null;alignment:string|null;fit_mode:string|null;source_column:string|null;confidence:number|null;render_options?:Record<string,unknown>|null};
function normalizeMappingName(value:string){return value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/['’`]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ")}
function fieldAliases(field:Field):string[]{
 const identity=normalizeMappingName([field.key,field.label].join(" "));
 const aliases:Record<string,string[]>={
  student_name:["student name","name","student full name","name of student","विद्यार्थी का नाम","छात्र का नाम","विद्यार्थी का पूरा नाम"],
  student_photo:["student photo","photo","photo filename","photo file name","student photo filename","student image","image filename","picture filename","विद्यार्थी का फोटो"],
  father_name:["father name","fathers name","father's name","father","father name of student","पिता का नाम","पिता का नाम"],
  mother_name:["mother name","mothers name","mother's name","mother","माता का नाम"],
  guardian_name:["guardian name","guardian","अभिभावक का नाम"],
  class:["class","class name","grade","कक्षा"],
  section:["section","सेक्शन","वर्ग"],
  class_sec:["class & sec","class sec","class & section","class section","class and section","class-section","grade and section","कक्षा एवं सेक्शन","कक्षा और सेक्शन"],
  class_section:["class & sec","class sec","class & section","class section","class and section","class-section","grade and section","कक्षा एवं सेक्शन","कक्षा और सेक्शन"],
  roll_number:["roll no","roll number","rollno","रोल नंबर","अनुक्रमांक"],
  admission_number:["admission no","admission number","admissionno","admission id","enrollment no","enrollment number","प्रवेश संख्या","प्रवेशांक"],
  admission_no:["admission no","admission number","admissionno","admission id","enrollment no","enrollment number","प्रवेश संख्या","प्रवेशांक"],
  admissionno:["admission no","admission number","admissionno","admission id","enrollment no","enrollment number","प्रवेश संख्या","प्रवेशांक"],
  date_of_birth:["date of birth","dob","birth date","date of birth (dob)","जन्म तिथि","जन्मतिथि"],
  dob:["date of birth","dob","birth date","जन्म तिथि","जन्मतिथि"],
  address:["address","पता"],
  address_line_1:["address line 1","address line one","address 1","address1","पहला पता","पता पंक्ति 1"],
  address_line_2:["address line 2","address line two","address 2","address2","second address line","दूसरा पता","पता पंक्ति 2"],
  blood_group:["blood group","blood type","रक्त समूह"],
  phone:["phone","mobile","mobile number","contact number","मोबाइल नंबर","फोन नंबर"],
  session:["session","academic session","school session","academic year","session year","शैक्षिक सत्र","शैक्षणिक सत्र"],
  session_start:["session start","start session","session from","from year","start year","academic year start","academic session start","session year start","सत्र प्रारंभ"],
  session_end:["session end","end session","session to","to year","end year","academic year end","academic session end","session year end","सत्र समाप्ति"],
  session_year_start:["session start","start session","session from","from year","start year","academic year start","सत्र प्रारंभ"],
  session_year_end:["session end","end session","session to","to year","end year","academic year end","सत्र समाप्ति"],
  academic_session_start:["session start","start session","session from","from year","start year","academic year start","सत्र प्रारंभ"],
  academic_session_end:["session end","end session","session to","to year","end year","academic year end","सत्र समाप्ति"],
  academic_session:["session","academic session","school session","academic year","session year","शैक्षिक सत्र","शैक्षणिक सत्र"],
  school_session:["session","academic session","school session","academic year","session year","शैक्षिक सत्र","शैक्षणिक सत्र"],
  gender:["gender","sex","लिंग"],
  student_id:["student id","student code","विद्यार्थी आईडी"],
  serial_number:["serial number","serial no","s no","sno","क्रमांक","अनुक्रमांक"]
 };
 const key=normalizeMappingName(field.key).replace(/ /g,"_");
 const labelKey=normalizeMappingName(field.label).replace(/ /g,"_");
 const aliasKey=Object.keys(aliases).find(k=>aliases[k].some(a=>normalizeMappingName(a)===labelKey));
 return [...new Set([field.source_column??"",field.key,field.label,...(aliases[key]??[]),...(aliases[labelKey.replace(/ /g,"_")]??[]),...(aliases[labelKey]??[]),...(aliasKey?aliases[aliasKey]:[]),...(aliases[identity.replace(/ /g,"_")]??[])].map(normalizeMappingName).filter(Boolean))];
}
function autoMapFields(fields:Field[],headers:string[]):Field[]{
 const normalized=headers.map(raw=>({raw,n:normalizeMappingName(raw)}));
 const used=new Set<string>();
 const startNames=["session start","start session","session from","from year","start year","academic year start","academic session start","session year start","session start year","academic session from","session year from"];
 const endNames=["session end","end session","session to","to year","end year","academic year end","academic session end","session year end","session end year","academic session to","session year to"];
 const sessionStart=normalized.find(h=>startNames.includes(h.n));
 const sessionEnd=normalized.find(h=>endNames.includes(h.n));
 const combinedSession=normalized.find(h=>["session","academic session","school session","academic year","session year","session period","academic year period","शैक्षिक सत्र","शैक्षणिक सत्र"].includes(h.n));
 const sessionFields=fields.filter(f=>normalizeMappingName(f.label)==="session").slice().sort((a,b)=>a.x-b.x);
 const sessionIndex=new Map(sessionFields.map((f,i)=>[f.id,i]));
 const tokenScore=(alias:string,header:string)=>{
  if(alias===header)return 1;
  const a=alias.split(" ").filter(Boolean),h=header.split(" ").filter(Boolean);
  if(a.length>=2&&a.every(t=>h.includes(t)))return .9;
  if(h.length>=2&&h.every(t=>a.includes(t)))return .86;
  const intersection=a.filter(t=>h.includes(t)).length;
  return intersection/Math.max(a.length,h.length);
 };
 return fields.map(field=>{
  const key=normalizeMappingName(field.key).replace(/ /g,"_");
  const label=normalizeMappingName(field.label);
  let chosen:null|{raw:string;n:string}=null;
  let valueTransform:string|undefined;
  if(label==="session"&&(key.includes("start")||key.includes("from"))){if(sessionStart)chosen=sessionStart;else if(combinedSession){chosen=combinedSession;valueTransform="session_start";}}
  else if(label==="session"&&(key.includes("end")||key.includes("to"))){if(sessionEnd)chosen=sessionEnd;else if(combinedSession){chosen=combinedSession;valueTransform="session_end";}}
  else if(label==="session"&&sessionFields.length>=2){
   const idx=sessionIndex.get(field.id);
   if(idx===0&&sessionStart)chosen=sessionStart;
   else if(idx===sessionFields.length-1&&sessionEnd)chosen=sessionEnd;
   else if(!sessionStart&&!sessionEnd&&combinedSession){chosen=combinedSession;valueTransform=idx===0?"session_start":idx===sessionFields.length-1?"session_end":undefined;}
  }
  if(!chosen){
   const aliases=[...new Set(fieldAliases(field))];
   const exact=normalized.filter(h=>aliases.includes(h.n));
   const availableExact=exact.filter(h=>!used.has(h.n));
   if(exact.length===1&&availableExact.length===1)chosen=availableExact[0];
   else if(exact.length===0){
    const candidates=normalized.filter(h=>!used.has(h.n)).map(h=>({h,score:Math.max(0,...aliases.map(a=>tokenScore(a,h.n)))})).filter(x=>x.score>=.8).sort((a,b)=>b.score-a.score);
    if(candidates.length&&(!candidates[1]||candidates[0].score-candidates[1].score>=.12))chosen=candidates[0].h;
   }
  }
  if(chosen&&!(valueTransform&&combinedSession?.n===chosen.n))used.add(chosen.n);
  return {...field,source_column:chosen?.raw??null,render_options:valueTransform?{...(field.render_options??{}),valueTransform}:field.render_options??null};
 });
}
export function StudentImportWorkspace({projectId,templateId,fields:initialFields}:{projectId:string;templateId:string|null;fields:Field[]}) {
 const [preview,setPreview]=useState<SpreadsheetPreview|null>(null);
 const [fields,setFields]=useState(initialFields);
 const [serialColumn,setSerialColumn]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [replaceExisting,setReplaceExisting]=useState(false);
 const [page,setPage]=useState(0);
 const [showAllMappings,setShowAllMappings]=useState(false);
 const [showAllPreviewValues,setShowAllPreviewValues]=useState<Record<number,boolean>>({});
 const columns=preview?.headers??[];
 const validated=useMemo(()=>preview?validateStudentRows(preview.rows,serialColumn||null):[],[preview,serialColumn]);
 const validRows=useMemo(()=>validated.filter(r=>r.issues.length===0),[validated]);
 async function onFile(file?:File) {
  if(!file)return;setError("");setNotice("");setPreview(null);setBusy(true);
  try { const p=parseWorkbook(await file.arrayBuffer(),file.name);setPreview(p);setSerialColumn(p.serialColumn??"");setPage(0);const mappedFields=autoMapFields(fields,p.headers);setFields(mappedFields);const mappedCount=mappedFields.filter(f=>Boolean(f.source_column)).length;if(templateId){await saveTemplateFields({projectId,templateId,fields:mappedFields});setNotice(`Automatically mapped and saved ${mappedCount} of ${mappedFields.length} template fields to spreadsheet columns. Review the mappings below before importing.`)}else{setNotice(`Automatically matched ${mappedCount} of ${mappedFields.length} template fields to spreadsheet columns.`)} }
  catch(e){setError(e instanceof Error?e.message:"Could not read this spreadsheet.");}
  finally{setBusy(false);}
 }
 function mapField(id:string,column:string){setFields(old=>old.map(f=>f.id===id?{...f,source_column:column||null}:f));}
 async function saveMappings(){
  if(!templateId){setError("Upload a template and define template fields before saving mappings.");return;}
  setBusy(true);setError("");setNotice("");
  try{await saveTemplateFields({projectId,templateId,fields:fields.map(f=>({...f,source_column:f.source_column||null}))});setNotice("Field-to-column mappings saved to this template version.");}
  catch(e){setError(e instanceof Error?e.message:"Could not save mappings.");}finally{setBusy(false);}
 }
 async function importRows(){
  setBusy(true);setError("");setNotice("");
  try{
   const nonInteger=validRows.filter(r=>!r.serialNumber||!/^\d+$/.test(r.serialNumber));
   if(nonInteger.length)throw new Error(`${nonInteger.length} row(s) have serial numbers that are not whole numbers. Correct the sheet before importing.`);
   const result=await importStudentRows({projectId,replaceExisting,rows:validRows.map(r=>({sourceRow:r.sourceRow,serialNumber:r.serialNumber!,values:r.values as Record<string,string|number|boolean|null>}))});
   setNotice(`Imported ${result.imported.toLocaleString()} students. Original spreadsheet values were preserved in each student's data; only explicitly mapped fields will be used by later card rendering.`);
  }catch(e){setError(e instanceof Error?e.message:"Import failed.");}finally{setBusy(false);}
 }
 const pageSize=20;
 const visible=validated.slice(page*pageSize,page*pageSize+pageSize);
 return <section className="pf-panel mt-5 p-5">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-blue-300">PHASE 5</p><h2 className="text-xl font-bold">Student spreadsheet import</h2><p className="pf-muted mt-1 text-sm">Import XLSX, XLS, or CSV. Values are stored as source data; card fields are used only when explicitly mapped.</p></div><label className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm font-medium">{busy?"Working…":"Choose spreadsheet"}<input className="sr-only" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" disabled={busy} onChange={e=>void onFile(e.target.files?.[0])}/></label></div>
  {error&&<p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
  {preview&&<div className="mt-5 space-y-5">
   <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Rows",preview.summary.total],["Blank rows",preview.summary.blank],["Missing serial",validated.filter(r=>!r.serialNumber).length],["Duplicates",validated.filter(r=>r.issues.includes("Duplicate serial number")).length],["Rows to import",validRows.length]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-white/10 p-3"><p className="pf-muted text-xs">{label}</p><p className="mt-1 text-xl font-semibold">{Number(value).toLocaleString()}</p></div>)}</div>
   <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Worksheet detected</label><div className="rounded-lg border border-white/10 px-3 py-2 text-sm">{preview.sheetName} · header row {preview.headerRow}</div></div><div><label className="mb-1 block text-sm font-medium">Serial-number column</label><select className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm" value={serialColumn} onChange={e=>setSerialColumn(e.target.value)}><option value="">Choose column…</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
   <div><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Import preview</h3><p className="pf-muted text-xs">Rows {validated.length?Math.min(page*pageSize+1,validated.length):0}–{Math.min((page+1)*pageSize,validated.length)} of {validated.length.toLocaleString()}</p></div><div className="pf-table-scroll mt-2 max-h-[420px] overflow-auto rounded-lg border border-white/10 hidden md:block"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-slate-900"><tr><th className="p-2">Source row</th>{columns.map(c=><th key={c} className="p-2">{c}</th>)}<th className="p-2">Validation</th></tr></thead><tbody>{visible.map(r=><tr key={r.sourceRow} className="border-t border-white/10"><td className="p-2">{r.sourceRow}</td>{columns.map(c=><td key={c} className="max-w-48 truncate p-2">{r.values[c]===null?"—":String(r.values[c])}</td>)}<td className="max-w-64 p-2">{r.issues.length?<span className="text-amber-300">{r.issues.join(", ")}</span>:<span className="text-emerald-300">Ready</span>}</td></tr>)}</tbody></table></div><div className="mt-2 space-y-2 md:hidden">{visible.map(r=><article key={r.sourceRow} className="rounded-xl border border-white/10 bg-white/60 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">Row {r.sourceRow} · {String(r.values[serialColumn]??r.serialNumber??"No serial")}</strong><span className={r.issues.length?"text-xs text-amber-600":"text-xs text-emerald-700"}>{r.issues.length?"Review":"Ready"}</span></div><p className="mt-1 truncate text-sm font-semibold">{String(r.values.student_name??r.values.name??r.values["Student Name"]??r.values["Name"]??"Student record")}</p><button type="button" className="mt-2 text-sm font-semibold text-indigo-700 underline" aria-expanded={!!showAllPreviewValues[r.sourceRow]} onClick={()=>setShowAllPreviewValues(old=>({...old,[r.sourceRow]:!old[r.sourceRow]}))}>{showAllPreviewValues[r.sourceRow]?"Hide all details":"View all details"}</button>{showAllPreviewValues[r.sourceRow]&&<dl className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200 pt-3">{columns.map(c=><div key={c} className="min-w-0"><dt className="pf-muted text-xs">{c}</dt><dd className="break-words text-sm">{r.values[c]===null||r.values[c]===""?"—":String(r.values[c])}</dd></div>)}</dl>}{r.issues.length>0&&<p className="mt-2 text-xs text-amber-700">{r.issues.join(", ")}</p>}</article>)}</div><div className="mt-2 flex justify-end gap-2"><button className="rounded-md border border-white/15 px-3 py-1.5 text-sm disabled:opacity-40" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="rounded-md border border-white/15 px-3 py-1.5 text-sm disabled:opacity-40" disabled={(page+1)*pageSize>=validated.length} onClick={()=>setPage(p=>p+1)}>Next 20</button></div></div>
   <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer list-none font-semibold">Template field mapping <span className="pf-muted text-sm">· {fields.filter(f=>f.source_column).length}/{fields.length} mapped</span><p className="pf-muted mt-1 text-sm font-normal">Open to review or change column assignments.</p></summary><div className="mt-4">{!fields.length?<p className="mt-3 text-sm text-amber-200">Analyze the template or add fields in the template editor before mapping columns.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2">{fields.map(f=><div key={f.id}><label className="mb-1 block text-sm font-medium">{f.label}</label><select className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm" value={f.source_column??""} onChange={e=>mapField(f.id,e.target.value)}><option value="">Not mapped</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}</div>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>void saveMappings()} disabled={busy||!templateId||!fields.length} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-40">Save mappings to template version</button></div></div></details>
   <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-4"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={replaceExisting} onChange={e=>setReplaceExisting(e.target.checked)} className="mt-1"/>Replace existing student records with matching serial numbers. Leave unchecked to block collisions.</label><p className="pf-muted text-xs">Only rows with a unique, non-empty serial number are imported. Rows with missing/duplicate serials are excluded. Student serial numbers must be whole numbers for the current database schema.</p><button onClick={()=>void importRows()} disabled={busy||!validRows.length} className="self-start rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Processing…":`Import ${validRows.length.toLocaleString()} valid students`}</button></div>
  </div>}
 </section>;
}
