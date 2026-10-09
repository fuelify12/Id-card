import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Zip, ZipPassThrough } from "fflate";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { buildManifests, chooseCardSides, exportEligibilityReasons, safeFilenamePart, sha256, sourceFormatSupports, uniqueArchiveName, verifyZipDirectory } from "@/lib/exports/archive";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_CARDS = 1000;
const MAX_ARCHIVE_BYTES = 90 * 1024 * 1024;
const RETENTION_DAYS = 7;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
type Auth = { db: any; uid: string; project: any } | { error: string; status: number };
async function authorize(projectId: string): Promise<Auth> {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return { error: "Unauthorized", status: 401 };
  const { data: project, error } = await db.from("school_projects").select("id,owner_id,name,school_name,academic_session,validation_settings").eq("id", projectId).eq("owner_id", uid).maybeSingle();
  if (error) return { error: "Could not verify project access.", status: 500 };
  if (!project) return { error: "Project not found or access denied.", status: 404 };
  return { db, uid, project };
}
function nameOf(student: any) {
  const d = student?.data ?? {};
  return String(d.student_name ?? d.name ?? d.full_name ?? d["Student Name"] ?? "Student").trim().slice(0, 100) || "Student";
}
function sideOf(card: any) { return String(card.card_side ?? "front").toLowerCase() === "back" ? "back" : "front"; }
function extOf(format: unknown) { const f = String(format ?? "").toLowerCase(); return f === "jpg" ? "jpeg" : f; }
async function boundedMap<T,R>(items:T[], concurrency:number, worker:(item:T,index:number)=>Promise<R>):Promise<R[]>{const results=new Array<R>(items.length);let next=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)return;results[i]=await worker(items[i],i)}}));return results;}
async function currentCards(db: any, projectId: string, uid: string, batchId: string) {
  const { data: batch, error: be } = await db.from("batches").select("id,name,status,project_id,owner_id,template_id,template_version,created_at,total_count,completed_count,failed_count,review_count").eq("id", batchId).eq("project_id", projectId).eq("owner_id", uid).maybeSingle();
  if (be) throw new Error("Could not load generation batch.");
  if (!batch) throw Object.assign(new Error("Batch not found in this project."), { status: 404 });
  const status = String(batch.status).toLowerCase();
  if (!["completed","completed_with_errors"].includes(status)) throw Object.assign(new Error("Export is available only after the source batch has finished."), { status: 422 });
  const [{ data: cards, error: ce }, { data: items, error: ie }, { data: students, error: se }, { data: findings, error: fe }, { data: templates, error: te }, { data: photos, error: pe }] = await Promise.all([
    db.from("generated_cards").select("id,project_id,owner_id,batch_id,student_id,serial_number,storage_path,filename,status,validation_status,approval_status,template_id,template_version,photo_id,photo_version,output_sha256,output_format,output_width_px,output_height_px,output_dpi,render_input_hash,render_config_snapshot,card_side,generated_at,created_at").eq("project_id", projectId).eq("owner_id", uid).eq("batch_id", batchId).order("serial_number").limit(MAX_CARDS + 1),
    db.from("batch_generation_items").select("id,student_id,serial_number,status,output_card_id,output_storage_path,input_fingerprint,error_summary").eq("project_id", projectId).eq("owner_id", uid).eq("batch_id", batchId).order("serial_number").limit(MAX_CARDS + 1),
    db.from("students").select("id,project_id,owner_id,serial_number,data,updated_at").eq("project_id", projectId).eq("owner_id", uid).limit(MAX_CARDS + 1),
    db.from("card_validation_findings").select("id,student_id,generated_card_id,severity,status,rule_id,message").eq("project_id", projectId).eq("owner_id", uid).in("status", ["OPEN","IN_REVIEW"]).limit(10000),
    db.from("templates").select("id,version_number").eq("project_id", projectId).eq("owner_id", uid),
    db.from("student_photos").select("id,project_id,owner_id,student_id,image_version,match_status,processing_status,crop_approved_at,processed_storage_path").eq("project_id", projectId).eq("owner_id", uid).limit(10000)
  ]);
  if (ce || ie || se || fe || te || pe) throw new Error("Could not load complete export eligibility data.");
  if ((cards ?? []).length > MAX_CARDS || (items ?? []).length > MAX_CARDS) throw Object.assign(new Error("This batch exceeds the 1,000-card-output export limit. Split it into smaller batches."), { status: 413 });
  return { batch, cards: cards ?? [], items: items ?? [], students: students ?? [], findings: findings ?? [], templates: templates ?? [], photos: photos ?? [] };
}
async function checkCard(db: any, card: any, d: any, project: any, verifyBytes = true, keepBytes = false) {
  let sourceBytes: Buffer | null = null;
  const student = d.students.find((s: any) => s.id === card.student_id);
  const batchItem = d.items.find((i: any) => i.output_card_id === card.id || i.student_id === card.student_id);
  const template = d.templates.find((t: any) => t.id === card.template_id);
  const photo = d.photos.find((p: any) => p.id === card.photo_id);
  const findings = d.findings.filter((f: any) => f.generated_card_id === card.id || (!!card.student_id && f.student_id === card.student_id));
  const allowWarnings = project.validation_settings?.allow_warnings_for_approval === true;
  const reasons = exportEligibilityReasons(card, findings, allowWarnings);
  if (!batchItem || batchItem.status !== "SUCCEEDED" || batchItem.output_card_id !== card.id || batchItem.output_storage_path !== card.storage_path || !batchItem.input_fingerprint || batchItem.input_fingerprint !== card.render_input_hash) reasons.push("Batch output fingerprint does not match the intended generated card.");
  if (!student) reasons.push("Student record is missing or does not belong to this project.");
  if (!template || Number(template.version_number) !== Number(card.template_version)) reasons.push("Template version is stale; regenerate and revalidate this card.");
  const renderedAt = card.generated_at ?? card.created_at;
  if (student?.updated_at && renderedAt && Date.parse(student.updated_at) > Date.parse(renderedAt)) reasons.push("Student data changed after rendering; regenerate and revalidate this card.");
  if (card.photo_id && (!photo || photo.project_id !== card.project_id || photo.owner_id !== card.owner_id || photo.student_id !== card.student_id || photo.match_status !== "APPROVED" || photo.processing_status !== "APPROVED" || !photo.crop_approved_at || !photo.processed_storage_path || Number(photo.image_version) !== Number(card.photo_version))) reasons.push("Approved photo assignment changed or is no longer valid.");
  if (card.storage_path && (!card.storage_path.startsWith(project.owner_id + "/" + project.id + "/") || card.storage_path.includes("..") || card.storage_path.startsWith("/"))) reasons.push("Stored card path is outside the private project namespace.");
  if (verifyBytes && card.storage_path && reasons.length===0) {
    const { data, error } = await db.storage.from(STORAGE_BUCKETS.generatedCards).download(card.storage_path);
    if (error || !data) reasons.push("Generated card is missing from private storage.");
    else {
      const bytes = Buffer.from(await data.arrayBuffer());if(keepBytes)sourceBytes=bytes;
      if (sha256(bytes) !== card.output_sha256) reasons.push("Stored card integrity hash does not match the approved output.");
      if (bytes.length === 0) reasons.push("Stored card output is empty.");
      if (bytes.length > 20 * 1024 * 1024) reasons.push("Stored card exceeds the supported 20 MB source limit.");
      if (!reasons.length) {
        try {
          if (extOf(card.output_format) === "pdf") {
            if (bytes.subarray(0, 5).toString() !== "%PDF-") reasons.push("Stored PDF is not readable."); else {const pdf=await PDFDocument.load(bytes,{throwOnInvalidObject:true});if(pdf.getPageCount()!==1)reasons.push("Stored PDF must contain exactly one card page.");else{const z=pdf.getPage(0).getSize(),dpi=Number(card.output_dpi)||300,w=Math.round(z.width*dpi/72),h=Math.round(z.height*dpi/72);if(card.output_width_px&&w!==card.output_width_px)reasons.push("Stored PDF width differs from recorded dimensions.");if(card.output_height_px&&h!==card.output_height_px)reasons.push("Stored PDF height differs from recorded dimensions.");}}
          } else {
            const meta = await sharp(bytes, { limitInputPixels: 100_000_000, failOn: "error" }).metadata();
            if (!meta.width || !meta.height || !["png","jpeg"].includes(String(meta.format))) reasons.push("Stored image cannot be decoded.");
            if (card.output_width_px && meta.width !== card.output_width_px) reasons.push("Stored image width differs from its recorded dimensions.");
            if (card.output_height_px && meta.height !== card.output_height_px) reasons.push("Stored image height differs from its recorded dimensions.");
          }
        } catch { reasons.push("Stored card output cannot be decoded."); }
      }
    }
  }
  return { card, student, reasons: [...new Set(reasons)], findings, bytes:sourceBytes };
}
async function preflight(db: any, project: any, uid: string, batchId: string) {
  const d = await currentCards(db, project.id, uid, batchId);
  const checks = await boundedMap(d.cards,3,(c: any) => checkCard(db, c, d, project, true));
  const missing = d.items.filter((i: any) => !["SUCCEEDED"].includes(i.status) || !d.cards.some((c: any) => c.id === i.output_card_id));
  const allSides = new Map<string, any[]>();
  for (const x of checks) if (x.card.student_id) allSides.set(x.card.student_id, [...(allSides.get(x.card.student_id) ?? []), x]);
  const eligibleStudents = [...allSides.entries()].filter(([, arr]) => arr.some(x => x.reasons.length === 0)).map(([id]) => id);
  const counts = { batchItems:d.items.length, generatedOutputs:d.cards.length, eligible:checks.filter(x=>x.reasons.length===0).length, excluded:checks.filter(x=>x.reasons.length>0).length + missing.length, failed:d.items.filter((i:any)=>["FAILED","SKIPPED"].includes(i.status)).length, reviewRequired:checks.filter(x=>x.card.approval_status!=="approved" || x.card.validation_status==="warning").length };
  const eligibleChecks=checks.filter(x=>x.reasons.length===0);const formats = ["original"];
  if (eligibleChecks.length && eligibleChecks.every(x => ["png","jpeg"].includes(extOf(x.card.output_format)))) formats.push("png","jpeg");
  if (eligibleChecks.length && eligibleChecks.every(x => extOf(x.card.output_format)==="pdf")) formats.push("pdf");
  return { batch:d.batch, counts, cards:checks.map(x=>({id:x.card.id,studentId:x.card.student_id,serialNumber:x.card.serial_number,studentName:nameOf(x.student),side:sideOf(x.card),format:extOf(x.card.output_format),eligible:x.reasons.length===0,reasons:x.reasons,approvalStatus:x.card.approval_status,validationStatus:x.card.validation_status})), eligibleStudentIds, eligibleStudentCount:eligibleStudents.length, formats, missingItems:missing.map((i:any)=>({serialNumber:i.serial_number,status:i.status,reason:i.error_summary??"No completed generated output exists."})), _private:{...d,checks} };
}
async function insertAudit(db:any, uid:string, projectId:string, action:string, exportId:string, metadata:Record<string,unknown>={}) {
  const { error } = await db.from("audit_logs").insert({ owner_id:uid, project_id:projectId, action, entity_type:"export", entity_id:exportId, metadata });
  if (error) throw new Error("Could not record the export audit event.");
}
export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) {
  const { id } = await params; const auth = await authorize(id); if ("error" in auth) return fail(auth.error, auth.status);
  const { db, uid, project } = auth; const url = new URL(request.url); const batchId = url.searchParams.get("batchId");
  try {
    const [{ data: batches, error: be }, { data: exports, error: ee }] = await Promise.all([
      db.from("batches").select("id,name,status,total_count,completed_count,failed_count,review_count,created_at,completed_at").eq("project_id",id).eq("owner_id",uid).order("created_at",{ascending:false}).limit(100),
      db.from("exports").select("id,batch_id,filename,status,created_at,updated_at,started_at,storage_path,selected_count,eligible_count,excluded_count,packaged_file_count,failed_item_count,archive_bytes,archive_sha256,expires_at,error_summary,options,retry_count,retryable").eq("project_id",id).eq("owner_id",uid).order("created_at",{ascending:false}).limit(100)
    ]);
    if (be || ee) throw new Error("Could not load export history.");
    if (!batchId) { const now=Date.now(); for (const item of exports??[]) { const expired=["completed","completed_with_errors"].includes(String(item.status).toLowerCase()) && item.expires_at && Date.parse(item.expires_at)<=now; const stalled=String(item.status).toLowerCase()==="running" && item.started_at && Date.parse(item.started_at)<now-10*60*1000; if(expired||stalled) { if(item.storage_path) await db.storage.from(STORAGE_BUCKETS.exports).remove([item.storage_path]); const nextStatus=expired?"expired":"failed"; const reason=expired?null:"Export worker stopped before completion. Retry to resume with fresh validation."; await db.from("exports").update({status:nextStatus,storage_path:expired?null:item.storage_path,error_summary:reason,retryable:!expired,updated_at:new Date().toISOString()}).eq("id",item.id).eq("project_id",id).eq("owner_id",uid); item.status=nextStatus;item.error_summary=reason; if(expired)item.storage_path=null; } } const safeExports=(exports??[]).map(({storage_path,...item}:any)=>item); return NextResponse.json({ batches:batches??[], exports:safeExports, retentionDays:RETENTION_DAYS, maxCards:MAX_CARDS, maxArchiveBytes:MAX_ARCHIVE_BYTES }); }
    const report = await preflight(db, project, uid, batchId);
    const { _private, ...publicReport } = report;
    return NextResponse.json(publicReport);
  } catch(e:any) { return fail(e?.message??"Could not prepare export eligibility.", e?.status??500); }
}
export async function POST(request: Request, { params }: { params: Promise<{id:string}> }) {
  const { id } = await params; const auth = await authorize(id); if ("error" in auth) return fail(auth.error, auth.status);
  const { db, uid, project } = auth; let body:any; try { body=await request.json(); } catch { return fail("Request body must be valid JSON."); }
  if (body?.action !== "create") return fail("Unsupported export action.");
  if (body.confirm !== true) return fail("Confirm the export options before creating the archive.");
  const batchId = String(body.batchId??"");
  const side = body.side === "both" ? "both" : "front";
  const format = ["original","png","jpeg","pdf"].includes(body.format) ? body.format : "original";
  const folderLayout = body.folderLayout !== false;
  const includeManifest = body.includeManifest !== false;
  const includeNames = body.includeNames === true;
  const hasSelection=Array.isArray(body.selectedStudentIds);const selected = hasSelection ? [...new Set(body.selectedStudentIds.filter((x:any)=>typeof x==="string"))] : [];
  if (!batchId) return fail("Choose a completed generation batch.");
  if (selected.length > MAX_CARDS) return fail("Select no more than 1,000 students.",413);
  try {
    const report = await preflight(db, project, uid, batchId);
    const data = report._private;
    const eligibleByStudent = new Map<string, any[]>();
    for (const c of data.checks) if (c.card.student_id) eligibleByStudent.set(c.card.student_id,[...(eligibleByStudent.get(c.card.student_id)??[]),c]);
    if(hasSelection&&!selected.length)return fail("Select at least one student to export.");
    const requestedStudents = hasSelection ? selected : report.eligibleStudentIds;
    const missingSelection = requestedStudents.filter((sid:string)=>!eligibleByStudent.has(sid));
    if (missingSelection.length) return fail("One or more selected students are not in this batch.",422);
    const chosen:any[] = []; const excluded:any[] = [];
    for (const sid of requestedStudents) {
      const all = eligibleByStudent.get(sid)??[];
      const sideSelection=chooseCardSides(all.map((x:any)=>({side:sideOf(x.card),eligible:x.reasons.length===0,format:extOf(x.card.output_format),check:x})),side,format);
      if(sideSelection.reason){excluded.push({studentId:sid,serialNumber:all[0]?.card.serial_number,reason:sideSelection.reason});continue;}
      chosen.push(...sideSelection.items.map((x:any)=>x.check));
    }
    if (!chosen.length) return NextResponse.json({error:"No selected cards satisfy the current export policy.",excluded,preflight:{counts:report.counts}}, {status:422});
    if (chosen.length > MAX_CARDS) return fail("Export contains more than 1,000 card-side outputs. Split it into smaller batches.",413);
    const exportId = randomUUID(), now = new Date();
    const school = safeFilenamePart(project.school_name || project.name || "School","School",60);
    const session = safeFilenamePart(project.academic_session || String(now.getFullYear()),String(now.getFullYear()),24);
    const filename = `PRINTFORGE_${school}_${session}.zip`;
    const used = new Set<string>();
    const itemSnapshot = chosen.map((x:any) => {
      const serial = String(x.card.serial_number).padStart(3,"0");
      const studentName = safeFilenamePart(nameOf(x.student),"Student",60);
      const sideName = sideOf(x.card);
      const ext = format === "original" ? extOf(x.card.output_format) : format;
      const base = includeNames ? `${serial}_${studentName}` : serial;
      const leaf = side === "both" && !folderLayout ? `${base}_${sideName}.${ext}` : `${base}.${ext}`;
      const path = folderLayout ? `${sideName}/${leaf}` : leaf;
      const archiveName = uniqueArchiveName(path,used);
      return {cardId:x.card.id,studentId:x.card.student_id,studentRef:createHash("sha256").update(String(x.card.student_id)).digest("hex").slice(0,12),serialNumber:String(x.card.serial_number).padStart(3,"0"),side:sideName,sourcePath:x.card.storage_path,sourceHash:x.card.output_sha256,sourceFormat:extOf(x.card.output_format),format:ext,archiveName,validationStatus:x.card.validation_status,templateVersion:x.card.template_version,batchId,studentName:includeNames?nameOf(x.student):undefined};
    });
    const storagePath = `${uid}/${id}/${exportId}/archive.zip`;
    const expiresAt = new Date(now.getTime()+RETENTION_DAYS*24*60*60*1000).toISOString();
    const options = {side,format,folderLayout,includeManifest,includeNames,selectedStudentCount:requestedStudents.length};
    const {data:created,error} = await db.from("exports").insert({id:exportId,batch_id:batchId,project_id:id,owner_id:uid,storage_path:storagePath,filename,status:"queued",options,selected_count:requestedStudents.length,eligible_count:chosen.length,excluded_count:report.counts.excluded+excluded.length,packaged_file_count:0,failed_item_count:0,retry_count:0,retryable:false,archive_bytes:null,archive_sha256:null,error_summary:null,started_at:null,completed_at:null,expires_at:expiresAt,item_snapshot:itemSnapshot,excluded_snapshot:[...excluded,...report.cards.filter((c:any)=>!c.eligible).map((c:any)=>({serialNumber:c.serialNumber,side:c.side,reason:c.reasons.join(" ")})),...report.missingItems] }).select("id,status,filename,eligible_count,excluded_count,expires_at").single();
    if (error || !created) throw new Error("Could not create the persistent export job.");
    await insertAudit(db,uid,id,"export_created",exportId,{batchId,selectedCount:requestedStudents.length,eligibleCount:chosen.length,excludedCount:report.counts.excluded+excluded.length,format,side});
    return NextResponse.json({export:created,excluded:[...excluded,...report.cards.filter((c:any)=>!c.eligible).map((c:any)=>({serialNumber:c.serialNumber,side:c.side,reason:c.reasons.join(" ")})),...report.missingItems]}, {status:201});
  } catch(e:any) { return fail(e?.message??"Could not create export job.",e?.status??500); }
}
export async function PUT(request: Request, { params }: { params: Promise<{id:string}> }) {
  const {id}=await params;const auth=await authorize(id);if("error"in auth)return fail(auth.error,auth.status);
  const {db,uid,project}=auth;let body:any;try{body=await request.json()}catch{return fail("Request body must be valid JSON.");}
  const exportId=String(body.exportId??"");if(!exportId)return fail("Export ID is required.");
  const {data:job,error}=await db.from("exports").select("*").eq("id",exportId).eq("project_id",id).eq("owner_id",uid).maybeSingle();
  if(error||!job)return fail("Export not found or access denied.",404);
  if(body.action==="delete"){
    if(job.storage_path)await db.storage.from(STORAGE_BUCKETS.exports).remove([job.storage_path]);
    const {error:de}=await db.from("exports").delete().eq("id",exportId).eq("project_id",id).eq("owner_id",uid);if(de)return fail("Could not delete export history.",500);
    await insertAudit(db,uid,id,"export_deleted",exportId,{status:job.status});return NextResponse.json({ok:true});
  }
  if(body.action==="retry"){
    if(String(job.status).toLowerCase()!=="failed")return fail("Only failed exports can be retried. A completed archive is preserved; create a new export to package newly eligible cards.",422);if(job.retryable!==true)return fail("This failure is not classified as transient and cannot be retried safely.",422);if(Number(job.retry_count??0)>=3)return fail("This export has reached its maximum of three retry attempts.",422);if(job.updated_at&&Date.now()-Date.parse(job.updated_at)<5000)return fail("Wait at least five seconds before retrying this export.",429);
    if(job.storage_path)await db.storage.from(STORAGE_BUCKETS.exports).remove([job.storage_path]);
    const {error:ue}=await db.from("exports").update({status:"queued",storage_path:`${uid}/${id}/${exportId}/archive.zip`,packaged_file_count:0,failed_item_count:0,retry_count:Number(job.retry_count??0)+1,retryable:false,archive_bytes:null,archive_sha256:null,error_summary:null,started_at:null,completed_at:null,updated_at:new Date().toISOString()}).eq("id",exportId).eq("project_id",id).eq("owner_id",uid);
    if(ue)return fail("Could not queue export retry.",500);
    await insertAudit(db,uid,id,"export_retry_requested",exportId,{});return NextResponse.json({ok:true,status:"queued"});
  }
  return fail("Unsupported export action.");
}
export async function PATCH(request: Request, { params }: { params: Promise<{id:string}> }) {
  const {id}=await params;const auth=await authorize(id);if("error"in auth)return fail(auth.error,auth.status);
  const {db,uid,project}=auth;let body:any;try{body=await request.json()}catch{return fail("Request body must be valid JSON.");}
  const exportId=String(body.exportId??"");const {data:job,error}=await db.from("exports").select("*").eq("id",exportId).eq("project_id",id).eq("owner_id",uid).maybeSingle();
  if(error||!job)return fail("Export not found or access denied.",404);
  if(String(job.status).toLowerCase()==="completed"&&job.expires_at&&Date.parse(job.expires_at)<=Date.now()){await db.from("exports").update({status:"expired",storage_path:null,updated_at:new Date().toISOString()}).eq("id",exportId);if(job.storage_path)await db.storage.from(STORAGE_BUCKETS.exports).remove([job.storage_path]);return fail("This archive has expired and was removed.",410);}
  if(String(job.status).toLowerCase()!=="queued")return fail("Export is not queued for processing.",409);
  const {data:claimed,error:claimError}=await db.from("exports").update({status:"running",retryable:false,started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",exportId).eq("project_id",id).eq("owner_id",uid).eq("status","queued").select("id").maybeSingle();
  if(claimError)return fail("Could not claim export job.",500);if(!claimed)return fail("Export is already being processed or is no longer queued.",409);
  const temp=await mkdtemp(join(tmpdir(),"printforge-export-"));const zipPath=join(temp,"archive.zip");let uploadedPath:string|null=null;let processed=0,failed=0;const actualManifest:any[]=[];const expectedNames:string[]=[];let writer:any;
  try {
    const fresh=await currentCards(db,id,uid,job.batch_id);
    const snap=Array.isArray(job.item_snapshot)?job.item_snapshot:[];
    if(!snap.length)throw new Error("Export job has no persisted item snapshot.");
    const {data:findings,error:fe}=await db.from("card_validation_findings").select("id,student_id,generated_card_id,severity,status").eq("project_id",id).eq("owner_id",uid).in("status",["OPEN","IN_REVIEW"]).limit(10000);
    if(fe)throw new Error("Could not refresh validation findings before packaging.");
    fresh.findings=findings??[];
    const {data:students,error:se}=await db.from("students").select("id,project_id,owner_id,serial_number,data,updated_at").eq("project_id",id).eq("owner_id",uid).limit(MAX_CARDS+1);
    if(se)throw new Error("Could not refresh student records before packaging.");
    fresh.students=students??[];
    const {data:photos,error:pe}=await db.from("student_photos").select("id,project_id,owner_id,student_id,image_version,match_status,processing_status,crop_approved_at,processed_storage_path").eq("project_id",id).eq("owner_id",uid).limit(10000);
    if(pe)throw new Error("Could not refresh photo records before packaging.");
    fresh.photos=photos??[];
    const {data:templates,error:te}=await db.from("templates").select("id,version_number").eq("project_id",id).eq("owner_id",uid);
    if(te)throw new Error("Could not refresh template versions before packaging.");
    fresh.templates=templates??[];
    const {data:projectFresh,error:pr}=await db.from("school_projects").select("id,owner_id,validation_settings").eq("id",id).eq("owner_id",uid).maybeSingle();
    if(pr||!projectFresh)throw new Error("Project authorization could not be reverified.");
    const {data:batchItems,error:bi}=await db.from("batch_generation_items").select("id,student_id,serial_number,status,output_card_id,output_storage_path,input_fingerprint,error_summary").eq("project_id",id).eq("owner_id",uid).eq("batch_id",job.batch_id).limit(MAX_CARDS+1);
    if(bi)throw new Error("Could not refresh batch items.");
    fresh.items=batchItems??[];
    const root=job.options?.folderLayout!==false?safeFilenamePart(String(job.filename).replace(/\.zip$/i,""),"PRINTFORGE",100):"";
    const used=new Set<string>();
    writer=createWriteStream(zipPath);
    const zipFinished = new Promise<void>((resolve,reject)=>{writer.once("finish",resolve);writer.once("error",reject);});
    const zip=new Zip((err,data,final)=>{if(err){writer.destroy(err);return;}if(data?.length)writer.write(Buffer.from(data));if(final)writer.end();});
    const allExcluded=Array.isArray(job.excluded_snapshot)?job.excluded_snapshot:[];const runtimeExcluded:any[]=[];
    for(const item of snap){
      const card=fresh.cards.find((c:any)=>c.id===item.cardId);
      if(!card||card.student_id!==item.studentId||card.storage_path!==item.sourcePath||card.output_sha256!==item.sourceHash){failed++;runtimeExcluded.push({serialNumber:item.serialNumber,side:item.side,reason:"Card record or input fingerprint changed before packaging."});continue;}
      const checked=await checkCard(db,card,fresh,projectFresh,true,true);
      if(checked.reasons.length||sideOf(card)!==item.side||Number(card.template_version)!==Number(item.templateVersion)){failed++;runtimeExcluded.push({serialNumber:item.serialNumber,side:item.side,reason:checked.reasons.join(" ")||"Card side or template version changed."});continue;}
      if(!sourceFormatSupports(card.output_format,job.options?.format??"original")){failed++;continue;}
      let bytes=checked.bytes;if(!bytes){failed++;runtimeExcluded.push({serialNumber:item.serialNumber,side:item.side,reason:"Stored source output could not be retrieved."});continue;}
      if(sha256(bytes)!==item.sourceHash){failed++;runtimeExcluded.push({serialNumber:item.serialNumber,side:item.side,reason:"Stored source hash changed before packaging."});continue;}
      const outFormat=String(item.format), source=extOf(card.output_format);
      if(outFormat==="png"&&source!=="png")bytes=await sharp(bytes,{limitInputPixels:100_000_000,failOn:"error"}).png().toBuffer();
      else if(outFormat==="jpeg"&&source!=="jpeg")bytes=await sharp(bytes,{limitInputPixels:100_000_000,failOn:"error"}).jpeg({quality:95,chromaSubsampling:"4:4:4"}).toBuffer();
      const archiveName=uniqueArchiveName(root?root+"/"+item.archiveName:item.archiveName,used);
      const entry=new ZipPassThrough(archiveName);zip.add(entry);entry.push(bytes,true);if(writer.writableNeedDrain)await new Promise<void>((resolve,reject)=>{writer.once("drain",resolve);writer.once("error",reject);});
      expectedNames.push(archiveName);processed++;
      actualManifest.push({item_number:processed,serial_number:item.serialNumber,student_ref:item.studentRef,filename:archiveName,side:item.side,format:outFormat,validation_status:card.validation_status,template_version:card.template_version,batch_id:job.batch_id,exported_at:new Date().toISOString()});
      const {error:peu}=await db.from("exports").update({packaged_file_count:processed,failed_item_count:failed,status:"running",updated_at:new Date().toISOString()}).eq("id",exportId).eq("owner_id",uid);
      if(peu)throw new Error("Could not persist export progress.");
      {const size=(await stat(zipPath).catch(()=>({size:0} as any))).size;if(size>MAX_ARCHIVE_BYTES)throw Object.assign(new Error("Archive exceeded the 90 MB storage safety limit."),{code:"ARCHIVE_LIMIT"});}
    }
    if(!processed)throw new Error("No cards remained eligible when packaging began. Run preflight and create a new export.");
    if(job.options?.includeManifest!==false){
      const manifests=buildManifests(actualManifest,exportId,new Date().toISOString());
      const jsonObj=JSON.parse(manifests.json);jsonObj.excluded_items=allExcluded;jsonObj.failed_item_count=failed;
      const manifestFiles=[["manifest.csv",manifests.csv],["manifest.json",JSON.stringify(jsonObj,null,2)+"\n"],["exclusions.csv",["serial_number,side,reason",...finalExcluded.map((x:any)=>[`"${String(x.serialNumber??"").replace(/"/g,'""')}"`,`"${String(x.side??"").replace(/"/g,'""')}"`,`"${String(x.reason??x.error_summary??"").replace(/"/g,'""')}"`].join(","))].join("\r\n")+"\r\n"]];
      for(const [name,content] of manifestFiles){const full=root?root+"/"+name:name;const uniqueName=uniqueArchiveName(full,used);const entry=new ZipPassThrough(uniqueName);zip.add(entry);entry.push(Buffer.from(content,"utf8"),true);expectedNames.push(uniqueName);}
    }
    zip.end();await zipFinished;
    await db.from("exports").update({status:"verifying",updated_at:new Date().toISOString()}).eq("id",exportId).eq("owner_id",uid);
    const info=await stat(zipPath);if(info.size>MAX_ARCHIVE_BYTES)throw Object.assign(new Error("Archive exceeded the 90 MB storage safety limit."),{code:"ARCHIVE_LIMIT"});
    const archive=await readFile(zipPath);
    const verification=verifyZipDirectory(archive,expectedNames);
    if(!verification.ok)throw new Error("ZIP integrity verification failed: "+(verification.reason??"unknown archive error"));
    if(verification.names.length!==expectedNames.length)throw new Error("ZIP entry count does not match the manifest.");
    const archiveHash=sha256(archive);
    const storagePath=String(job.storage_path??`${uid}/${id}/${exportId}/archive.zip`);
    const {error:up}=await db.storage.from(STORAGE_BUCKETS.exports).upload(storagePath,createReadStream(zipPath) as any,{contentType:"application/zip",upsert:true,cacheControl:"0"});
    if(up)throw new Error("Could not store the verified ZIP archive in private storage.");
    uploadedPath=storagePath;
    const {data:stored,error:storedError}=await db.storage.from(STORAGE_BUCKETS.exports).download(storagePath);
    if(storedError||!stored)throw new Error("Stored archive could not be retrieved for final verification.");
    const storedBytes=Buffer.from(await stored.arrayBuffer());
    if(sha256(storedBytes)!==archiveHash)throw new Error("Stored archive hash differs from the verified archive.");
    const finalVerification=verifyZipDirectory(storedBytes,expectedNames);
    if(!finalVerification.ok)throw new Error("Stored archive failed final integrity verification.");
    const status=failed?"completed_with_errors":"completed";
    const {error:done}=await db.from("exports").update({status,retryable:false,storage_path:storagePath,packaged_file_count:processed,failed_item_count:failed,archive_bytes:storedBytes.length,archive_sha256:archiveHash,completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),error_summary:failed?`${failed} card output(s) failed final revalidation and were excluded.`:null,manifest:{entries:actualManifest.length,expected_names:expectedNames}}).eq("id",exportId).eq("owner_id",uid);
    if(done)throw new Error("Archive was stored but completion could not be persisted.");
    await insertAudit(db,uid,id,"export_completed",exportId,{packagedFileCount:processed,failedItemCount:failed,archiveBytes:storedBytes.length,archiveSha256:archiveHash});
    return NextResponse.json({ok:true,status,packagedFileCount:processed,failedItemCount:failed,archiveBytes:storedBytes.length});
  } catch(e:any) {
    if(uploadedPath)await db.storage.from(STORAGE_BUCKETS.exports).remove([uploadedPath]).catch(()=>{});
    const rawMessage=String(e?.message??"");const message=e?.code==="ARCHIVE_LIMIT"?"Archive exceeds the configured 90 MB limit. Export fewer cards or split the batch.":"Export packaging failed. Check the source batch and private storage before retrying.";const retryable=e?.code!=="ARCHIVE_LIMIT"&&!rawMessage.includes("No cards remained eligible")&&!rawMessage.includes("integrity verification failed")&&!rawMessage.includes("exceeded the 90 MB")&&!rawMessage.includes("invalid archive path");
    await db.from("exports").update({status:"failed",retryable,error_summary:message,failed_item_count:failed,updated_at:new Date().toISOString()}).eq("id",exportId).eq("owner_id",uid);
    await insertAudit(db,uid,id,"export_failed",exportId,{reason:message,failedItemCount:failed}).catch(()=>{});
    return fail(message,500);
  } finally { await rm(temp,{recursive:true,force:true}).catch(()=>{}); }
}
