"use server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument } from "pdf-lib";
import { sanitizeSvg } from "@/lib/rendering/engine";
import { STORAGE_BUCKETS, type StorageBucket, projectObjectPath } from "@/lib/supabase/storage";
import { consumeRateLimit, type RateLimitAction } from "@/lib/security/rate-limit";
const LIMITS:Record<StorageBucket,number>={[STORAGE_BUCKETS.templates]:20*1024*1024,[STORAGE_BUCKETS.studentPhotos]:10*1024*1024,[STORAGE_BUCKETS.generatedCards]:20*1024*1024,[STORAGE_BUCKETS.exports]:100*1024*1024};
const TYPES:Record<StorageBucket,string[]>={[STORAGE_BUCKETS.templates]:["image/png","image/jpeg","image/svg+xml","application/pdf"],[STORAGE_BUCKETS.studentPhotos]:["image/jpeg","image/png","image/webp"],[STORAGE_BUCKETS.generatedCards]:["image/png","image/jpeg","application/pdf"],[STORAGE_BUCKETS.exports]:["application/zip","application/pdf"]};
function pngDimensions(b:Uint8Array){if(b.length<24||b[0]!==137||b[1]!==80||b[2]!==78||b[3]!==71)return null;const d=new DataView(b.buffer,b.byteOffset,b.byteLength);const w=d.getUint32(16),h=d.getUint32(20);return w&&h?{width:w,height:h}:null}
function jpegDimensions(b:Uint8Array){if(b.length<4||b[0]!==255||b[1]!==216)return null;let i=2;while(i+9<b.length){if(b[i]!==255){i++;continue}const m=b[i+1];i+=2;if(m===216||m===217)continue;if(i+2>b.length)return null;const n=(b[i]<<8)|b[i+1];if(n<2||i+n>b.length)return null;const sof=[192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m);if(sof)return{width:(b[i+5]<<8)|b[i+6],height:(b[i+3]<<8)|b[i+4]};i+=n}return null}
async function validateTemplate(f:File){
 if(!f.size||f.size>20*1024*1024)throw new Error("Template must be between 1 byte and 20 MB.");
 if(!["image/png","image/jpeg","image/svg+xml","application/pdf"].includes(f.type))throw new Error("Supported templates are PNG, JPG, sanitized SVG, and single-page PDF.");
 const b=new Uint8Array(await f.arrayBuffer());let d:{width:number;height:number}|null=null;
 if(f.type==="image/png")d=pngDimensions(b);
 else if(f.type==="image/jpeg")d=jpegDimensions(b);
 else if(f.type==="image/svg+xml"){const clean=sanitizeSvg(Buffer.from(b));const text=clean.toString("utf8");const width=text.match(/\bwidth=["']([0-9.]+)(px)?["']/i),height=text.match(/\bheight=["']([0-9.]+)(px)?["']/i),view=text.match(/\bviewBox=["'][^"']*?([0-9.]+)[ ,]+([0-9.]+)["']/i);const w=width?Number(width[1]):view?Number(view[1]):0,h=height?Number(height[1]):view?Number(view[2]):0;if(w>0&&h>0)d={width:Math.round(w),height:Math.round(h)}}
 else {if(b.length<5||String.fromCharCode(...b.slice(0,5))!=="%PDF-")throw new Error("The PDF template signature is invalid.");const pdf=await PDFDocument.load(Buffer.from(b),{throwOnInvalidObject:true,updateMetadata:false});if(pdf.getPageCount()!==1)throw new Error("Upload a one-page PDF for each template side.");const size=pdf.getPage(0).getSize();d={width:Math.round(size.width*96/72),height:Math.round(size.height*96/72)}}
 if(!d)throw new Error("Template dimensions could not be read. Check the file or convert it to PNG/JPEG.");
 if(d.width<100||d.height<100)throw new Error("Template resolution is too small. Use at least 100×100 units.");
 if(d.width>12000||d.height>12000)throw new Error("Template dimensions are too large. Maximum is 12000×12000 units.");
 return d
}
async function auth(){const s=await createClient();const{data:claims}=await s.auth.getClaims();const uid=claims?.claims?.sub;if(!uid)throw new Error("Unauthorized");return{s,uid}}
async function enforceActionRateLimit(client:any,action:RateLimitAction,limit:number,windowSeconds=60){
 const decision=await consumeRateLimit(client,action,limit,windowSeconds);
 if(!decision.allowed) throw new Error(decision.unavailable?"This operation is temporarily unavailable. Try again shortly.":"Too many requests. Wait before trying again.");
}
export async function createProject(input:{name:string;schoolName:string;schoolAddress?:string;academicSession?:string}){const{s,uid}=await auth();await enforceActionRateLimit(s,"project_create",10,3600);const name=input.name.trim(),schoolName=input.schoolName.trim();if(!name||!schoolName)throw new Error("Project name and school name are required");const{data,error}=await s.from("school_projects").insert({owner_id:uid,name,school_name:schoolName,school_address:input.schoolAddress?.trim()||null,academic_session:input.academicSession?.trim()||null,status:"draft"}).select("id,name,school_name,status").single();if(error)throw new Error(error.message);return data}
export async function updateProject(input:{projectId:string;name:string;schoolName:string;schoolAddress?:string;academicSession?:string}){const{s}=await auth();const name=input.name.trim(),schoolName=input.schoolName.trim();if(!name||!schoolName)throw new Error("Project name and school name are required");const{data,error}=await s.from("school_projects").update({name,school_name:schoolName,school_address:input.schoolAddress?.trim()||null,academic_session:input.academicSession?.trim()||null,updated_at:new Date().toISOString()}).eq("id",input.projectId).select("id,name,school_name,school_address,academic_session,status").single();if(error)throw new Error(error.message);return data}
export async function uploadTemplate(input:{projectId:string;file:File}){const{s,uid}=await auth();await enforceActionRateLimit(s,"template_upload",10,3600);const dimensions=await validateTemplate(input.file);const{data:project}=await s.from("school_projects").select("id").eq("id",input.projectId).maybeSingle();if(!project)throw new Error("Project not found.");const{data:current}=await s.from("templates").select("id,version_number").eq("project_id",input.projectId).order("version_number",{ascending:false}).limit(1);const next=(current?.[0]?.version_number??0)+1;const sourceTypeMap:Record<string,string>={"image/png":"png","image/jpeg":"jpeg","image/svg+xml":"svg","application/pdf":"pdf"};const sourceType=sourceTypeMap[input.file.type];if(!sourceType)throw new Error("Unsupported template file type.");const path=projectObjectPath(uid,input.projectId,input.file.name);const{error:up}=await s.storage.from(STORAGE_BUCKETS.templates).upload(path,input.file,{contentType:input.file.type,upsert:false});if(up)throw new Error(up.message);if(current?.[0]){const{error:e}=await s.from("templates").update({is_active:false,updated_at:new Date().toISOString()}).eq("project_id",input.projectId).eq("is_active",true);if(e){await s.storage.from(STORAGE_BUCKETS.templates).remove([path]);throw new Error(e.message)}}const{data:t,error}=await s.from("templates").insert({owner_id:uid,project_id:input.projectId,name:input.file.name,source_path:path,source_type:sourceType,width_px:dimensions.width,height_px:dimensions.height,analysis_status:"pending",analysis:{engine:"manual-first",version:1,source:"uploaded"},render_config:{coordinateMode:"template-pixels",defaultDpi:300,side:"front"},version_number:next,is_active:true}).select("id,name,source_path,source_type,width_px,height_px,analysis_status,version_number,is_active,created_at").single();if(error){await s.storage.from(STORAGE_BUCKETS.templates).remove([path]);throw new Error(error.message)}return t}
export async function deleteTemplate(input:{projectId:string;templateId:string}){const{s}=await auth();const{data:t}=await s.from("templates").select("id,source_path,is_active").eq("id",input.templateId).eq("project_id",input.projectId).maybeSingle();if(!t)throw new Error("Template not found.");const{error}=await s.from("templates").delete().eq("id",input.templateId).eq("project_id",input.projectId);if(error)throw new Error(error.message);if(t.source_path)await s.storage.from(STORAGE_BUCKETS.templates).remove([t.source_path]);return{deleted:true,wasActive:t.is_active}}
export async function createTemplatePreview(input:{bucket:StorageBucket;path:string}){const{s}=await auth();if(input.bucket!==STORAGE_BUCKETS.templates)throw new Error("Invalid template bucket.");const{data,error}=await s.storage.from(input.bucket).createSignedUrl(input.path,600);if(error)throw new Error(error.message);return data.signedUrl}
export async function uploadProjectFile(input:{projectId:string;bucket:StorageBucket;file:File}){const{s,uid}=await auth();if(!Object.values(STORAGE_BUCKETS).includes(input.bucket))throw new Error("Invalid storage bucket");if(!input.file.size||input.file.size>LIMITS[input.bucket])throw new Error("File exceeds the allowed size");if(!TYPES[input.bucket].includes(input.file.type))throw new Error("File type is not allowed");const{data:project,error:pe}=await s.from("school_projects").select("id").eq("id",input.projectId).maybeSingle();if(pe)throw new Error(pe.message);if(!project)throw new Error("Project not found");const path=projectObjectPath(uid,input.projectId,input.file.name);const{error}=await s.storage.from(input.bucket).upload(path,input.file,{contentType:input.file.type,upsert:false});if(error)throw new Error(error.message);return{bucket:input.bucket,path}}
export async function createProjectDownload(input:{bucket:StorageBucket;path:string;expiresIn?:number}){const{s}=await auth();if(!Object.values(STORAGE_BUCKETS).includes(input.bucket))throw new Error("Invalid storage bucket");const{data,error}=await s.storage.from(input.bucket).createSignedUrl(input.path,Math.min(Math.max(input.expiresIn??300,30),3600));if(error)throw new Error(error.message);return data.signedUrl}
export async function saveTemplateFields(input:{projectId:string;templateId:string;fields:Array<{id?:string;key:string;label:string;field_type:string;required:boolean;x:number;y:number;width:number;height:number;font_family:string|null;font_size:number|null;font_weight:string|null;color:string|null;alignment:string|null;fit_mode:string|null;source_column:string|null;confidence:number|null}>}){const{s,uid}=await auth();const{data:t}=await s.from("templates").select("id").eq("id",input.templateId).eq("project_id",input.projectId).maybeSingle();if(!t)throw new Error("Template not found.");const fields=input.fields.slice(0,100).map((f,i)=>({...f,id:undefined,template_id:input.templateId,owner_id:uid,sort_order:i,x:Math.max(0,f.x),y:Math.max(0,f.y),width:Math.max(1,f.width),height:Math.max(1,f.height),confidence:f.confidence==null?1:Math.min(1,Math.max(0,f.confidence)),render_options:(f as any).render_options??{}}));const{error:de}=await s.from("template_fields").delete().eq("template_id",input.templateId);if(de)throw new Error(de.message);if(fields.length){const{error:ie}=await s.from("template_fields").insert(fields);if(ie)throw new Error(ie.message)}return{saved:fields.length}}
export async function importStudentRows(input:{projectId:string;rows:Array<{sourceRow:number;serialNumber:string;values:Record<string,string|number|boolean|null>}>;replaceExisting?:boolean}) {
 const {s,uid}=await auth();
 await enforceActionRateLimit(s,"student_import",20,3600);
 if(!input.rows.length) throw new Error("There are no valid student rows to import.");
 if(input.rows.length>15000) throw new Error("Import is limited to 15,000 rows per batch.");
 const {data:project,error:pe}=await s.from("school_projects").select("id").eq("id",input.projectId).maybeSingle();
 if(pe) throw new Error(pe.message); if(!project) throw new Error("Project not found.");
 const normalized=input.rows.map(r=>({source_row:r.sourceRow,serial_number:Number(r.serialNumber),data:r.values,owner_id:uid,project_id:input.projectId}));
 if(normalized.some(r=>!Number.isSafeInteger(r.serial_number)||r.serial_number<0||r.serial_number>2147483647)) throw new Error("Serial numbers must be whole numbers from 0 to 2,147,483,647. Fix invalid rows before importing.");
 const seen=new Set<number>(); for(const r of normalized){if(seen.has(r.serial_number)) throw new Error("Duplicate serial numbers are not allowed. Fix duplicates before importing.");seen.add(r.serial_number);}
 const {data:existing,error:ee}=await s.from("students").select("serial_number").eq("project_id",input.projectId);
 if(ee) throw new Error(ee.message);
 const incoming=new Set(normalized.map(r=>r.serial_number));
 const collisions=(existing??[]).filter(r=>incoming.has(r.serial_number));
 if(collisions.length && !input.replaceExisting) throw new Error(`${collisions.length} serial number(s) already exist in this project. Remove them from the import or explicitly choose replace existing records.`);
 if(input.replaceExisting) {
   for(let i=0;i<normalized.length;i+=500) { const {error}=await s.from("students").upsert(normalized.slice(i,i+500),{onConflict:"project_id,serial_number"}); if(error) throw new Error(error.message); }
 } else {
   for(let i=0;i<normalized.length;i+=500) { const {error}=await s.from("students").insert(normalized.slice(i,i+500)); if(error) throw new Error(error.message); }
 }
 await s.from("audit_logs").insert({owner_id:uid,project_id:input.projectId,action:"student_spreadsheet_imported",entity_type:"students",metadata:{count:normalized.length,source:"spreadsheet",replaced:!!input.replaceExisting}});
 return {imported:normalized.length};
}


import { assertPhotoAssignmentProject, parsePhotoFilename, proposePhotoMatch } from "@/lib/photos/matching";
import { inspectPhotoBuffer } from "@/lib/photos/image-validation";
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_MAX_FILES = 500;
const PHOTO_MAX_BATCH_BYTES = 500 * 1024 * 1024;
const PHOTO_BUCKET = STORAGE_BUCKETS.studentPhotos;
function displayPhotoFilename(name:string) { return name.replace(/[\u0000-\u001f]/g,"").slice(0,255)||"photo"; }
function safePhotoFilename(name:string) {
 const base=name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g,"").trim()||"photo";
 return base.slice(0,180).replace(/[^a-zA-Z0-9._ -]/g,"_")||"photo";
}
async function getOwnedProject(s:Awaited<ReturnType<typeof createClient>>, projectId:string, uid:string) {
 const {data,error}=await s.from("school_projects").select("id,photo_serial_prefix").eq("id",projectId).eq("owner_id",uid).maybeSingle();
 if(error) throw new Error(error.message);
 if(!data) throw new Error("Project not found or access denied.");
 return data;
}
export async function createPhotoBatch(input:{projectId:string;totalCount:number;name?:string}) {
 const {s,uid}=await auth(); await getOwnedProject(s,input.projectId,uid);
 if(!Number.isInteger(input.totalCount)||input.totalCount<1||input.totalCount>PHOTO_MAX_FILES) throw new Error("A photo batch must contain 1–500 image files.");
 const {data,error}=await s.from("batches").insert({owner_id:uid,project_id:input.projectId,name:(input.name||"Photo upload").slice(0,120),status:"uploading",total_count:input.totalCount,completed_count:0,failed_count:0,review_count:0,started_at:new Date().toISOString()}).select("id,name,total_count,status").single();
 if(error) throw new Error(error.message); return data;
}
export async function createPhotoUploadTicket(input:{projectId:string;batchId:string;filename:string;size:number}) {
 const {s,uid}=await auth(); await getOwnedProject(s,input.projectId,uid);
 await enforceActionRateLimit(s,"photo_upload_ticket",300,60);
 if(!Number.isInteger(input.size)||input.size<1||input.size>PHOTO_MAX_BYTES) throw new Error("Each photo must be between 1 byte and 10 MB.");
 const {data:batch,error:be}=await s.from("batches").select("id").eq("id",input.batchId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();
 if(be) throw new Error(be.message); if(!batch) throw new Error("Upload batch not found.");
 const filename=safePhotoFilename(input.filename);
 const path=projectObjectPath(uid,input.projectId,filename);
 const {data:reserved,error:re}=await s.rpc("reserve_photo_upload",{p_batch_id:input.batchId,p_project_id:input.projectId,p_path:path,p_size:input.size});
 if(re) throw new Error(re.message); if(!reserved) throw new Error("Photo batch exceeds the 500 MB aggregate limit or is no longer uploading.");
 const {data,error}=await s.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path,{upsert:false});
 if(error) { await s.rpc("release_photo_upload",{p_batch_id:input.batchId,p_project_id:input.projectId,p_path:path}); throw new Error(error.message); }
 return {path,token:data.token};
}
export async function registerStudentPhoto(input:{projectId:string;batchId:string;storagePath:string;originalFilename:string}) {
 const {s,uid}=await auth(); const project=await getOwnedProject(s,input.projectId,uid);
 if(!input.storagePath.startsWith(uid+"/"+input.projectId+"/")||input.storagePath.includes("..")) throw new Error("Invalid project storage path.");
 const {data:batch,error:be}=await s.from("batches").select("id").eq("id",input.batchId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();
 if(be) throw new Error(be.message); if(!batch) throw new Error("Upload batch not found.");
 const {data:prior,error:pe}=await s.from("student_photos").select("id,match_status,content_sha256,student_id,serial_number,normalized_serial_number,original_serial_number,original_filename,storage_path,project_id,owner_id,batch_id,mime_type,width_px,height_px,file_size_bytes,matching_method,validation_errors,duplicate_of_id,approved_at,approved_by,created_at,updated_at").eq("project_id",input.projectId).eq("storage_path",input.storagePath).maybeSingle();
 if(pe) throw new Error(pe.message); if(prior) return {photoId:prior.id,status:prior.match_status,idempotent:true};
 const {data:blob,error:de}=await s.storage.from(PHOTO_BUCKET).download(input.storagePath);
 if(de||!blob) throw new Error("Uploaded object could not be verified in private storage.");
 if(blob.size<1||blob.size>PHOTO_MAX_BYTES) { await s.storage.from(PHOTO_BUCKET).remove([input.storagePath]); throw new Error("Photo exceeds the server-side file-size limit."); }
 const bytes=Buffer.from(await blob.arrayBuffer());
 const {data:finalized,error:fe}=await s.rpc("finalize_photo_upload",{p_batch_id:input.batchId,p_project_id:input.projectId,p_path:input.storagePath,p_actual_size:bytes.length});
 if(fe)throw new Error(fe.message);if(!finalized)throw new Error("Uploaded image size exceeds the reserved per-file or aggregate batch limit.");
 const inspected=await inspectPhotoBuffer(bytes);
 const mime=inspected.mime;
 const width=inspected.width,height=inspected.height;
 const validationErrors=inspected.errors;
 const hash=inspected.sha256;
 if(validationErrors.length) {
  await s.storage.from(PHOTO_BUCKET).remove([input.storagePath]);
  const {data:invalid,error:ie}=await s.from("student_photos").insert({owner_id:uid,project_id:input.projectId,batch_id:input.batchId,student_id:null,serial_number:null,original_filename:displayPhotoFilename(input.originalFilename),original_serial_number:null,normalized_serial_number:null,storage_path:input.storagePath,mime_type:mime??"application/octet-stream",width_px:width,height_px:height,file_size_bytes:bytes.length,content_sha256:hash,matching_method:null,match_status:"INVALID_FILE",validation_errors:validationErrors,crop_settings:{}}).select("id,match_status").single();
  if(ie) throw new Error(ie.message); await s.rpc("release_photo_batch_bytes",{p_batch_id:input.batchId,p_project_id:input.projectId,p_size:bytes.length}); return {photoId:invalid.id,status:invalid.match_status,idempotent:false};
 }
 const {data:dupes,error:he}=await s.from("student_photos").select("id,match_status").eq("project_id",input.projectId).eq("content_sha256",hash).limit(10);
 if(he) throw new Error(he.message);
 const duplicateRows=(dupes??[]).filter(d=>!["INVALID_FILE","UPLOAD_FAILED"].includes(d.match_status));
 const filenameMatch=parsePhotoFilename(input.originalFilename,project.photo_serial_prefix);
 const students: {id:string;serial_number:number}[]=[];
 for(let from=0;from<15000;from+=1000){const {data,error}=await s.from("students").select("id,serial_number").eq("project_id",input.projectId).eq("owner_id",uid).range(from,from+999);if(error)throw new Error(error.message);students.push(...(data??[]));if((data??[]).length<1000)break;}
 const proposal=proposePhotoMatch(filenameMatch,students,duplicateRows.length>0);
 let status=proposal.status,studentId=proposal.studentId;
 const errors=proposal.reason?[proposal.reason]:[];
 if(status==="MATCHED"&&studentId){
  const {data:existing,error}=await s.from("student_photos").select("id,match_status").eq("project_id",input.projectId).eq("student_id",studentId).in("match_status",["MATCHED","APPROVED"]).limit(5);
  if(error) throw new Error(error.message);
  if((existing??[]).length){status="NEEDS_REVIEW";errors.push("Another photo is already proposed or approved for this student; choose the correct photo manually.");}
 }
 const {data:photo,error:ie}=await s.from("student_photos").insert({owner_id:uid,project_id:input.projectId,batch_id:input.batchId,student_id:studentId,serial_number:proposal.serialNumber,original_filename:displayPhotoFilename(input.originalFilename),original_serial_number:filenameMatch.status==="EXACT"?filenameMatch.originalSerial:filenameMatch.originalSerial,normalized_serial_number:proposal.normalizedSerial,storage_path:input.storagePath,mime_type:mime!,width_px:width,height_px:height,file_size_bytes:bytes.length,content_sha256:hash,matching_method:proposal.matchingMethod,match_status:status,validation_errors:errors,crop_settings:{},duplicate_of_id:duplicateRows[0]?.id??null}).select("id,match_status").single();
 if(ie) throw new Error(ie.message);
 const {data:hashRows,error:hre}=await s.from("student_photos").select("id,match_status,created_at").eq("project_id",input.projectId).eq("content_sha256",hash).order("created_at",{ascending:true}).order("id",{ascending:true}).limit(20);
 if(hre) throw new Error(hre.message);
 const validHashRows=(hashRows??[]).filter(r=>!["INVALID_FILE","UPLOAD_FAILED"].includes(r.match_status));
 if(validHashRows.length>1){const canonical=validHashRows[0];for(const duplicate of validHashRows.slice(1)){const {error:du}=await s.from("student_photos").update({student_id:null,serial_number:null,match_status:"DUPLICATE",duplicate_of_id:canonical.id,approved_at:null,approved_by:null,matching_method:"sha256",validation_errors:["Exact file content duplicates another uploaded photo."],updated_at:new Date().toISOString()}).eq("id",duplicate.id).eq("project_id",input.projectId);if(du)throw new Error(du.message);}}
 const {data:finalPhoto}=await s.from("student_photos").select("id,match_status").eq("id",photo.id).maybeSingle();
 return {photoId:photo.id,status:finalPhoto?.match_status??photo.match_status,idempotent:false};
}
export async function recordPhotoUploadFailure(input:{projectId:string;batchId:string;storagePath:string;filename:string;message:string;size:number}) {
 const {s,uid}=await auth(); await getOwnedProject(s,input.projectId,uid);
 if(!input.storagePath.startsWith(uid+"/"+input.projectId+"/")||input.storagePath.includes("..")) throw new Error("Invalid project storage path.");
 const {data:batch,error:be}=await s.from("batches").select("id").eq("id",input.batchId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();if(be)throw new Error(be.message);if(!batch)throw new Error("Upload batch not found.");
 const {data:existing}=await s.from("student_photos").select("id").eq("project_id",input.projectId).eq("storage_path",input.storagePath).maybeSingle();if(existing)return {photoId:existing.id};
 const {data:released}=await s.rpc("release_photo_upload",{p_batch_id:input.batchId,p_project_id:input.projectId,p_path:input.storagePath});if(!released){const {data:stored}=await s.storage.from(PHOTO_BUCKET).download(input.storagePath);await s.rpc("release_photo_batch_bytes",{p_batch_id:input.batchId,p_project_id:input.projectId,p_size:stored?.size??input.size});}await s.storage.from(PHOTO_BUCKET).remove([input.storagePath]);
 const {data,error}=await s.from("student_photos").insert({owner_id:uid,project_id:input.projectId,batch_id:input.batchId,student_id:null,serial_number:null,original_filename:safePhotoFilename(input.filename),storage_path:input.storagePath,mime_type:"application/octet-stream",match_status:"UPLOAD_FAILED",validation_errors:[input.message.slice(0,180)],crop_settings:{}}).select("id").single();
 if(error) throw new Error(error.message); return {photoId:data.id};
}
export async function finishPhotoBatch(input:{projectId:string;batchId:string;failedCount:number}) {
 const {s,uid}=await auth(); await getOwnedProject(s,input.projectId,uid);
 const {data:batch,error:be}=await s.from("batches").select("id,total_count").eq("id",input.batchId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();if(be)throw new Error(be.message);if(!batch)throw new Error("Upload batch not found.");
 const {data:photos,error}=await s.from("student_photos").select("id,match_status").eq("batch_id",input.batchId).eq("project_id",input.projectId);if(error)throw new Error(error.message);
 const list=photos??[],failed=list.filter(p=>p.match_status==="UPLOAD_FAILED"||p.match_status==="INVALID_FILE").length+Math.max(0,Math.min(input.failedCount,PHOTO_MAX_FILES)-list.filter(p=>p.match_status==="UPLOAD_FAILED").length);
 const review=list.filter(p=>["MATCHED","NEEDS_REVIEW","UNMATCHED","DUPLICATE","INVALID_FILE","UPLOAD_FAILED"].includes(p.match_status)).length;
 const status=failed?"completed_with_errors":"completed";
 const {error:ue}=await s.from("batches").update({status,completed_count:list.length,failed_count:failed,review_count:review,completed_at:new Date().toISOString()}).eq("id",input.batchId).eq("owner_id",uid);if(ue)throw new Error(ue.message);
 return {total:batch.total_count,registered:list.length,failed,review,status};
}
export async function loadPhotoWorkspace(projectId:string) {
 const {s,uid}=await auth();await getOwnedProject(s,projectId,uid);
 const students: {id:string;serial_number:number;data:Record<string,unknown>}[]=[];
 for(let from=0;from<15000;from+=1000){const {data,error}=await s.from("students").select("id,serial_number,data").eq("project_id",projectId).eq("owner_id",uid).order("serial_number").range(from,from+999);if(error)throw new Error(error.message);students.push(...((data??[]) as typeof students));if((data??[]).length<1000)break;}
 const {data:photos,error:pe}=await s.from("student_photos").select("id,student_id,serial_number,original_filename,original_serial_number,normalized_serial_number,storage_path,processed_storage_path,processing_status,processing_warnings,crop_coordinates,original_width_px,original_height_px,output_width_px,output_height_px,face_count,processing_error_code,mime_type,width_px,height_px,file_size_bytes,content_sha256,matching_method,match_status,validation_errors,duplicate_of_id,batch_id,approved_at,created_at").eq("project_id",projectId).eq("owner_id",uid).order("created_at",{ascending:false}).limit(1000);if(pe)throw new Error(pe.message);
 const rows=photos??[];
 const paths=rows.filter(p=>!["INVALID_FILE","UPLOAD_FAILED"].includes(p.match_status)).flatMap(p=>[p.storage_path,...(p.processed_storage_path?[p.processed_storage_path]:[])]);
 const urls=new Map<string,string>();
 for(let i=0;i<paths.length;i+=50){const chunk=paths.slice(i,i+50);const {data,error}=await s.storage.from(PHOTO_BUCKET).createSignedUrls(chunk,600);if(!error)for(const item of data??[])if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl);}
 const {data:batches,error:be}=await s.from("batches").select("id,name,status,total_count,completed_count,failed_count,review_count,created_at,completed_at").eq("project_id",projectId).eq("owner_id",uid).order("created_at",{ascending:false}).limit(10);if(be)throw new Error(be.message);
 const approved=new Set(rows.filter(p=>p.match_status==="APPROVED"&&p.student_id).map(p=>p.student_id));
 return {students,photos:rows.map(p=>({...p,previewUrl:urls.get(p.storage_path)??null,processedPreviewUrl:p.processed_storage_path?urls.get(p.processed_storage_path)??null:null})),batches:batches??[],summary:{totalStudents:students.length,approvedPhotos:approved.size,missingPhotos:Math.max(0,students.length-approved.size),unmatched:rows.filter(p=>p.match_status==="UNMATCHED").length,needsReview:rows.filter(p=>p.match_status==="NEEDS_REVIEW"||p.match_status==="MATCHED").length,duplicates:rows.filter(p=>p.match_status==="DUPLICATE").length,serialConflicts:(()=>{const g=new Map<string,Set<string>>();for(const p of rows)if(p.normalized_serial_number&&p.content_sha256){if(!g.has(p.normalized_serial_number))g.set(p.normalized_serial_number,new Set());g.get(p.normalized_serial_number)!.add(p.content_sha256);}return [...g.values()].filter(v=>v.size>1).length;})(),failed:rows.filter(p=>p.match_status==="UPLOAD_FAILED"||p.match_status==="INVALID_FILE").length}};
}
export async function setPhotoSerialPrefix(input:{projectId:string;prefix:string|null}) {
 const {s,uid}=await auth();await getOwnedProject(s,input.projectId,uid);
 const prefix=input.prefix?.trim().toUpperCase()||null;
 if(prefix&&!/^[A-Z][A-Z0-9_-]{0,15}$/.test(prefix))throw new Error("Prefix must start with a letter and contain only letters, digits, _ or - (maximum 16 characters).");
 const {error}=await s.from("school_projects").update({photo_serial_prefix:prefix,updated_at:new Date().toISOString()}).eq("id",input.projectId).eq("owner_id",uid);if(error)throw new Error(error.message);return {prefix};
}
export async function assignStudentPhoto(input:{projectId:string;photoId:string;studentId:string|null;replaceApproved?:boolean}) {
 const {s,uid}=await auth();await getOwnedProject(s,input.projectId,uid);
 const {data:photo,error:pe}=await s.from("student_photos").select("id,project_id,student_id,match_status,storage_path").eq("id",input.photoId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();if(pe)throw new Error(pe.message);if(!photo)throw new Error("Photo not found.");
 if(input.studentId===null){const {error}=await s.from("student_photos").update({student_id:null,serial_number:null,match_status:"UNMATCHED",approved_at:null,approved_by:null,matching_method:"manual_clear",updated_at:new Date().toISOString()}).eq("id",photo.id).eq("project_id",input.projectId);if(error)throw new Error(error.message);return {status:"UNMATCHED"};}
 const {data:student,error:se}=await s.from("students").select("id,project_id,serial_number").eq("id",input.studentId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();if(se)throw new Error(se.message);if(!student)throw new Error("Student does not belong to this school project.");assertPhotoAssignmentProject(input.projectId,photo.project_id,student.project_id);
 const {data:approved,error:ae}=await s.from("student_photos").select("id").eq("project_id",input.projectId).eq("student_id",student.id).eq("match_status","APPROVED").neq("id",photo.id).limit(1);if(ae)throw new Error(ae.message);
 if((approved??[]).length&&!input.replaceApproved)throw new Error("This student already has an approved photo. Confirm replacement to continue.");
 if((approved??[]).length&&input.replaceApproved){const {error}=await s.from("student_photos").update({student_id:null,serial_number:null,match_status:"NEEDS_REVIEW",approved_at:null,approved_by:null,validation_errors:["Previously approved photo replaced by user confirmation."],updated_at:new Date().toISOString()}).eq("id",approved![0].id).eq("project_id",input.projectId);if(error)throw new Error(error.message);}
 const status=input.replaceApproved?"APPROVED":"MATCHED";
 const {error}=await s.from("student_photos").update({student_id:student.id,serial_number:student.serial_number,normalized_serial_number:String(student.serial_number),match_status:status,matching_method:"manual",approved_at:status==="APPROVED"?new Date().toISOString():null,approved_by:status==="APPROVED"?uid:null,updated_at:new Date().toISOString()}).eq("id",photo.id).eq("project_id",input.projectId);if(error)throw new Error(error.message);return {status};
}
export async function approveStudentPhoto(input:{projectId:string;photoId:string;replaceApproved?:boolean}) {
 const {s,uid}=await auth();await getOwnedProject(s,input.projectId,uid);
 const {data:photo,error:pe}=await s.from("student_photos").select("id,student_id,match_status,storage_path").eq("id",input.photoId).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();if(pe)throw new Error(pe.message);if(!photo)throw new Error("Photo not found.");if(!photo.student_id)throw new Error("Assign this photo to a student before approving it.");if(["INVALID_FILE","UPLOAD_FAILED"].includes(photo.match_status))throw new Error("Invalid or failed uploads cannot be approved.");
 const {data:student,error:se}=await s.from("students").select("id").eq("id",photo.student_id).eq("project_id",input.projectId).eq("owner_id",uid).maybeSingle();if(se)throw new Error(se.message);if(!student)throw new Error("The assigned student no longer exists in this project.");
 const {data:other,error:oe}=await s.from("student_photos").select("id").eq("project_id",input.projectId).eq("student_id",photo.student_id).eq("match_status","APPROVED").neq("id",photo.id).limit(1);if(oe)throw new Error(oe.message);
 if((other??[]).length&&!input.replaceApproved)throw new Error("Another photo is already approved for this student. Confirm replacement to continue.");
 if((other??[]).length&&input.replaceApproved){const {error}=await s.from("student_photos").update({student_id:null,serial_number:null,match_status:"NEEDS_REVIEW",approved_at:null,approved_by:null,validation_errors:["Previously approved photo replaced by user confirmation."],updated_at:new Date().toISOString()}).eq("id",other![0].id).eq("project_id",input.projectId);if(error)throw new Error(error.message);}
 const {error}=await s.from("student_photos").update({match_status:"APPROVED",approved_at:new Date().toISOString(),approved_by:uid,updated_at:new Date().toISOString()}).eq("id",photo.id).eq("project_id",input.projectId);if(error)throw new Error(error.message);return {status:"APPROVED"};
}

export async function processPhotoMatches(projectId:string) {
 const {s,uid}=await auth();const project=await getOwnedProject(s,projectId,uid);
 const students:{id:string;serial_number:number}[]=[];
 for(let from=0;from<15000;from+=1000){const {data,error}=await s.from("students").select("id,serial_number").eq("project_id",projectId).eq("owner_id",uid).range(from,from+999);if(error)throw new Error(error.message);students.push(...(data??[]));if((data??[]).length<1000)break;}
 const {data:photos,error:pe}=await s.from("student_photos").select("id,student_id,serial_number,original_filename,normalized_serial_number,content_sha256,matching_method,match_status").eq("project_id",projectId).eq("owner_id",uid).in("match_status",["UPLOADED","NEEDS_REVIEW","UNMATCHED"]).order("created_at",{ascending:true}).limit(PHOTO_MAX_FILES);
 if(pe)throw new Error(pe.message);
 const {data:assigned,error:ae}=await s.from("student_photos").select("id,student_id,content_sha256,match_status").eq("project_id",projectId).eq("owner_id",uid).in("match_status",["MATCHED","APPROVED"]).limit(PHOTO_MAX_FILES);
 if(ae)throw new Error(ae.message);
 const eligible=(photos??[]).filter(p=>p.matching_method!=="manual");
 let matched=0,review=0,unmatched=0,duplicates=0,processed=0;
 const updates=eligible.map(p=>{
  const fm=parsePhotoFilename(p.original_filename,project.photo_serial_prefix);
  const duplicate=(assigned??[]).some(other=>other.id!==p.id&&p.content_sha256&&other.content_sha256===p.content_sha256);
  const proposal=proposePhotoMatch(fm,students,duplicate);
  let status=proposal.status,studentId=proposal.studentId;const errors=proposal.reason?[proposal.reason]:[];
  if(status==="MATCHED"&&studentId&&(assigned??[]).some(other=>other.id!==p.id&&other.student_id===studentId&&["MATCHED","APPROVED"].includes(other.match_status))){status="NEEDS_REVIEW";errors.push("Another photo is already proposed or approved for this student; choose the correct photo manually.");}
  if(status==="MATCHED")matched++;else if(status==="NEEDS_REVIEW")review++;else if(status==="UNMATCHED")unmatched++;else if(status==="DUPLICATE")duplicates++;
  return {id:p.id,student_id:studentId,serial_number:proposal.serialNumber,normalized_serial_number:proposal.normalizedSerial,matching_method:proposal.matchingMethod,match_status:status,validation_errors:errors};
 });
 for(let i=0;i<updates.length;i+=10){const results=await Promise.all(updates.slice(i,i+10).map(async u=>{const {error}=await s.from("student_photos").update({...u,updated_at:new Date().toISOString()}).eq("id",u.id).eq("project_id",projectId).eq("owner_id",uid);if(error)throw new Error(error.message);return 1;}));processed+=results.length;}
 return {processed,matched,needsReview:review,unmatched,duplicates};
}
