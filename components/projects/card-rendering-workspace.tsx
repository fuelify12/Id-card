"use client";
import {useState} from "react";
type Student={id:string;serial_number:number;data:Record<string,unknown>};
type Template={id:string;name:string;version_number:number;width_px:number|null;height_px:number|null};
type Field={id:string;key:string;label:string;field_type:string;required:boolean;source_column:string|null;static_value?:string|null};
export function CardRenderingWorkspace({projectId,template,fields,students}:{projectId:string;template:Template|null;fields:Field[];students:Student[]}){
 const [studentId,setStudentId]=useState(students[0]?.id??"");
 const [widthMm,setWidthMm]=useState("");const [heightMm,setHeightMm]=useState("");const [dpi,setDpi]=useState("300");const [format,setFormat]=useState<"png"|"jpeg">("png");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [preflight,setPreflight]=useState<any>(null);const [preview,setPreview]=useState<any>(null);
 async function request(action:"preflight"|"render"){
  if(!template){setError("Upload a PNG or JPEG template and define its fields first.");return}
  if(!widthMm||!heightMm){setError("Enter the actual physical card width and height in millimeters. Dimensions are not assumed.");return}
  if(action==="render"&&!studentId){setError("Import student records before generating a sample.");return}
  setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/projects/"+projectId+"/render",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,templateId:template.id,studentId,widthMm:Number(widthMm),heightMm:Number(heightMm),dpi:Number(dpi),format})});
   const json=await res.json();if(!res.ok)throw new Error([json.error,...(json.issues??[]),...(json.fields??[])].filter(Boolean).join(" "));
   if(action==="preflight"){setPreflight(json);setNotice("Preflight completed. Resolve critical configuration errors before production.");}
   else{setPreview(json);setNotice(json.reused?"Matching saved card output reused.":"Sample card rendered, validated, and saved to private storage.");}
  }catch(e){setError(e instanceof Error?e.message:"Rendering request failed.")}finally{setBusy(false)}
 }
 return <section className="pf-panel mt-5 p-5 space-y-4">
  <div><p className="text-xs tracking-wide text-blue-300">PHASE 8 · RASTER RENDERER</p><h2 className="mt-1 text-xl font-bold">Card rendering & sample approval</h2><p className="pf-muted mt-1 text-sm">The original template remains unchanged. A sample uses the same server renderer and private output storage as an individual card.</p></div>
  {!template?<p className="text-sm text-amber-300">Upload a PNG or JPEG template and configure fields above to begin.</p>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <label className="text-sm">Template<div className="mt-1 rounded border border-slate-700 p-2">{template.name} · v{template.version_number}<p className="pf-muted text-xs">{template.width_px??"?"} × {template.height_px??"?"} source px</p></div></label>
   <label className="text-sm">Sample student<select className="pf-input mt-1 w-full" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>Serial {s.serial_number}{typeof s.data?.student_name==="string"?" · "+s.data.student_name:""}</option>)}</select></label>
   <label className="text-sm">Output format<select className="pf-input mt-1 w-full" value={format} onChange={e=>setFormat(e.target.value as "png"|"jpeg")}><option value="png">PNG · lossless</option><option value="jpeg">JPEG · quality 95</option></select></label>
   <label className="text-sm">Physical width (mm)<input className="pf-input mt-1 w-full" type="number" min="1" max="500" step="0.1" value={widthMm} onChange={e=>setWidthMm(e.target.value)} placeholder="Confirm card width"/></label>
   <label className="text-sm">Physical height (mm)<input className="pf-input mt-1 w-full" type="number" min="1" max="500" step="0.1" value={heightMm} onChange={e=>setHeightMm(e.target.value)} placeholder="Confirm card height"/></label>
   <label className="text-sm">Print resolution (DPI)<select className="pf-input mt-1 w-full" value={dpi} onChange={e=>setDpi(e.target.value)}><option value="150">150 DPI · draft</option><option value="300">300 DPI · print</option><option value="600">600 DPI · high resolution</option></select></label>
  </div>}
  <div className="flex flex-wrap gap-2"><button className="pf-button" disabled={busy||!template} onClick={()=>void request("preflight")}>{busy?"Working…":"Run preflight"}</button><button className="pf-button" disabled={busy||!template||!students.length} onClick={()=>void request("render")}>{busy?"Rendering…":"Generate sample card"}</button></div>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
  {preflight&&<div className="rounded border border-slate-700 p-4 space-y-2"><h3 className="font-semibold">Preflight report</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div><p className="pf-muted text-xs">Student records</p><p className="text-xl font-bold">{preflight.totalStudents}</p></div><div><p className="pf-muted text-xs">Eligible</p><p className="text-xl font-bold">{preflight.eligibleStudents}</p></div><div><p className="pf-muted text-xs">Blocked</p><p className="text-xl font-bold">{preflight.blockedStudents}</p></div><div><p className="pf-muted text-xs">Output pixels</p><p className="text-sm font-semibold">{preflight.dimensions?.outputWidth??"—"} × {preflight.dimensions?.outputHeight??"—"}</p></div></div>{(preflight.configurationErrors??[]).map((x:string,i:number)=><p key={i} className="text-sm text-red-300">{x}</p>)}{(preflight.issues??[]).slice(0,10).map((x:any,i:number)=><p key={i} className="pf-muted text-xs">Serial {x.serialNumber}: {x.issues.join("; ")}</p>)}{preflight.issues?.length>10&&<p className="pf-muted text-xs">Showing first 10 of {preflight.issues.length} listed issues.</p>}</div>}
  {preview?.previewUrl&&<div className="rounded border border-slate-700 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Rendered sample</h3><a className="text-sm text-blue-300 underline" href={preview.previewUrl} target="_blank" rel="noreferrer">Open private preview</a></div><p className="pf-muted mt-1 text-xs">{preview.width} × {preview.height} px · {preview.dpi} DPI · {preview.format} · {preview.reused?"reused deterministic output":"new output persisted"}</p><img className="mt-3 max-h-[520px] max-w-full rounded border border-slate-700 object-contain" src={preview.previewUrl} alt="Rendered sample student ID card"/>{(preview.warnings??[]).map((w:any,i:number)=><p key={i} className="mt-2 text-sm text-amber-300">{w.code}: {w.message}</p>)}</div>}
  <p className="pf-muted text-xs">This phase renders individual PNG/JPEG cards only. PDF/SVG template ingestion and print-sheet imposition are not silently simulated; batch production is reserved for Phase 9.</p>
 </section>
}
