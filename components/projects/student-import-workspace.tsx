"use client";
import {useMemo,useState} from "react";
import * as XLSX from "xlsx";
import {parseWorkbook,validateStudentRows,type SpreadsheetPreview,type ParsedStudentRow} from "@/lib/imports/student-spreadsheet";
import {importStudentRows,saveTemplateFields} from "@/app/dashboard/actions";

type Field={id:string;key:string;label:string;field_type:string;required:boolean;x:number;y:number;width:number;height:number;font_family:string|null;font_size:number|null;font_weight:string|null;color:string|null;alignment:string|null;fit_mode:string|null;source_column:string|null;confidence:number|null};
export function StudentImportWorkspace({projectId,templateId,fields:initialFields}:{projectId:string;templateId:string|null;fields:Field[]}) {
 const [preview,setPreview]=useState<SpreadsheetPreview|null>(null);
 const [fields,setFields]=useState(initialFields);
 const [serialColumn,setSerialColumn]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [replaceExisting,setReplaceExisting]=useState(false);
 const [page,setPage]=useState(0);
 const columns=preview?.headers??[];
 const validated=useMemo(()=>preview?validateStudentRows(preview.rows,serialColumn||null):[],[preview,serialColumn]);
 const validRows=useMemo(()=>validated.filter(r=>r.issues.length===0),[validated]);
 async function onFile(file?:File) {
  if(!file)return;setError("");setNotice("");setPreview(null);setBusy(true);
  try { const p=parseWorkbook(await file.arrayBuffer(),file.name);setPreview(p);setSerialColumn(p.serialColumn??"");setPage(0); }
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
 const visible=validated.slice(page*100,page*100+100);
 return <section className="pf-panel mt-5 p-5">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-blue-300">PHASE 5</p><h2 className="text-xl font-bold">Student spreadsheet import</h2><p className="pf-muted mt-1 text-sm">Import XLSX, XLS, or CSV. Values are stored as source data; card fields are used only when explicitly mapped.</p></div><label className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm font-medium">{busy?"Working…":"Choose spreadsheet"}<input className="sr-only" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" disabled={busy} onChange={e=>void onFile(e.target.files?.[0])}/></label></div>
  {error&&<p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
  {preview&&<div className="mt-5 space-y-5">
   <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Rows",preview.summary.total],["Blank rows",preview.summary.blank],["Missing serial",validated.filter(r=>!r.serialNumber).length],["Duplicates",validated.filter(r=>r.issues.includes("Duplicate serial number")).length],["Rows to import",validRows.length]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-white/10 p-3"><p className="pf-muted text-xs">{label}</p><p className="mt-1 text-xl font-semibold">{Number(value).toLocaleString()}</p></div>)}</div>
   <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Worksheet detected</label><div className="rounded-lg border border-white/10 px-3 py-2 text-sm">{preview.sheetName} · header row {preview.headerRow}</div></div><div><label className="mb-1 block text-sm font-medium">Serial-number column</label><select className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm" value={serialColumn} onChange={e=>setSerialColumn(e.target.value)}><option value="">Choose column…</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
   <div><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Import preview</h3><p className="pf-muted text-xs">Rows {validated.length?Math.min(page*100+1,validated.length):0}–{Math.min((page+1)*100,validated.length)} of {validated.length.toLocaleString()}</p></div><div className="pf-table-scroll mt-2 max-h-[420px] overflow-auto rounded-lg border border-white/10 hidden md:block"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-slate-900"><tr><th className="p-2">Source row</th>{columns.map(c=><th key={c} className="p-2">{c}</th>)}<th className="p-2">Validation</th></tr></thead><tbody>{visible.map(r=><tr key={r.sourceRow} className="border-t border-white/10"><td className="p-2">{r.sourceRow}</td>{columns.map(c=><td key={c} className="max-w-48 truncate p-2">{r.values[c]===null?"—":String(r.values[c])}</td>)}<td className="max-w-64 p-2">{r.issues.length?<span className="text-amber-300">{r.issues.join(", ")}</span>:<span className="text-emerald-300">Ready</span>}</td></tr>)}</tbody></table></div><div className="mt-2 space-y-2 md:hidden">{visible.map(r=><article key={r.sourceRow} className="rounded-lg border border-white/10 p-3"><div className="flex items-start justify-between gap-2"><strong className="text-sm">Source row {r.sourceRow}</strong><span className={r.issues.length?"text-xs text-amber-300":"text-xs text-emerald-300"}>{r.issues.length?"Needs review":"Ready"}</span></div><dl className="mt-2 grid grid-cols-1 gap-2">{columns.map(c=><div key={c} className="min-w-0"><dt className="pf-muted text-xs">{c}</dt><dd className="break-words text-sm">{r.values[c]===null||r.values[c]===""?"—":String(r.values[c])}</dd></div>)}</dl>{r.issues.length>0&&<p className="mt-2 text-xs text-amber-300">{r.issues.join(", ")}</p>}</article>)}</div><div className="mt-2 flex justify-end gap-2"><button className="rounded-md border border-white/15 px-3 py-1.5 text-sm disabled:opacity-40" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><button className="rounded-md border border-white/15 px-3 py-1.5 text-sm disabled:opacity-40" disabled={(page+1)*100>=validated.length} onClick={()=>setPage(p=>p+1)}>Next 100</button></div></div>
   <div className="rounded-xl border border-white/10 p-4"><div><h3 className="font-semibold">Template field mapping</h3><p className="pf-muted mt-1 text-sm">Only mapped columns will feed card fields. Unused columns remain stored but are not automatically printed.</p></div>{!fields.length?<p className="mt-3 text-sm text-amber-200">Analyze the template or add fields in the template editor before mapping columns.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2">{fields.map(f=><div key={f.id}><label className="mb-1 block text-sm font-medium">{f.label}</label><select className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm" value={f.source_column??""} onChange={e=>mapField(f.id,e.target.value)}><option value="">Not mapped</option>{columns.map(c=><option key={c} value={c}>{c}</option>)}</select></div>)}</div>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>void saveMappings()} disabled={busy||!templateId||!fields.length} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-40">Save mappings to template version</button></div></div>
   <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-4"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={replaceExisting} onChange={e=>setReplaceExisting(e.target.checked)} className="mt-1"/>Replace existing student records with matching serial numbers. Leave unchecked to block collisions.</label><p className="pf-muted text-xs">Only rows with a unique, non-empty serial number are imported. Rows with missing/duplicate serials are excluded. Student serial numbers must be whole numbers for the current database schema.</p><button onClick={()=>void importRows()} disabled={busy||!validRows.length} className="self-start rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Processing…":`Import ${validRows.length.toLocaleString()} valid students`}</button></div>
  </div>}
 </section>;
}
