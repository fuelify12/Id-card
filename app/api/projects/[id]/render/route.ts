import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { renderCard, validateBindings, validatePhysicalSize, RENDERER_VERSION, type RenderField, type OutputFormat } from "@/lib/rendering/engine";
export const runtime = "nodejs";
export const maxDuration = 60;
const dbBucket = STORAGE_BUCKETS.generatedCards;
const hash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
const photoField = (f: any) => ["photo","student_photo","image"].includes(String(f.field_type).toLowerCase()) || String(f.key).toLowerCase() === "student_photo";
async function download(s: any, bucket: string, path: string) {
 const {data,error}=await s.storage.from(bucket).download(path);
 if(error||!data)throw new Error("A required private image could not be read.");
 return Buffer.from(await data.arrayBuffer());
}
async function ownedProject(s: any, id: string, uid: string) {
 const {data,error}=await s.from("school_projects").select("id,owner_id,school_name").eq("id",id).eq("owner_id",uid).maybeSingle();
 if(error)throw new Error(error.message);if(!data)throw new Error("Project not found or access denied.");return data;
}
async function loadFields(s:any,templateId:string,uid:string) {
 const {data,error}=await s.from("template_fields").select("id,key,label,field_type,required,x,y,width,height,font_family,font_size,font_weight,color,alignment,fit_mode,source_column,static_value,max_lines,overflow_policy,auto_shrink,min_font_size,line_height,vertical_alignment,rotation,visible,field_format").eq("template_id",templateId).eq("owner_id",uid).order("sort_order");
 if(error)throw new Error(error.message);return (data??[]) as RenderField[];
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id:projectId}=await params;const s=await createClient();const {data:claims}=await s.auth.getClaims();const uid=claims?.claims?.sub;
 if(!uid)return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({error:"Invalid JSON request."},{status:400})}
 const db=s as any;
 try {
  const project=await ownedProject(s,projectId,uid);
  const templateId=typeof body.templateId==="string"?body.templateId:"";
  if(!templateId)return NextResponse.json({error:"Select an ID-card template."},{status:400});
  const {data:template,error:te}=await s.from("templates").select("id,name,source_path,source_type,width_px,height_px,version_number,is_active").eq("id",templateId).eq("project_id",projectId).eq("owner_id",uid).maybeSingle();
  if(te)throw new Error(te.message);if(!template||!template.source_path)return NextResponse.json({error:"Template not found or access denied."},{status:404});
  if(!["image/png","image/jpeg"].includes(template.source_type))return NextResponse.json({error:"Only PNG and JPEG image templates are supported by this renderer."},{status:422});
  const fields=await loadFields(s,templateId,uid);
  if(!fields.length)return NextResponse.json({error:"Define at least one template field before rendering."},{status:422});
  if(fields.some(f=>f.required&&!photoField(f)&&!f.source_column&&!f.static_value&&f.key.toLowerCase()!=="school_name"))return NextResponse.json({error:"A required template field has no data mapping or static value.",fields:fields.filter(f=>f.required&&!photoField(f)&&!f.source_column&&!f.static_value&&f.key.toLowerCase()!=="school_name").map(f=>f.label)},{status:422});
  if(body.action==="preflight") {
   const widthMm=Number(body.widthMm),heightMm=Number(body.heightMm),dpi=Number(body.dpi);let dims:any=null,sizeError:string|null=null;
   try{dims=validatePhysicalSize(widthMm,heightMm,dpi);if(template.width_px&&template.height_px&&Math.abs((template.width_px/template.height_px)/(dims.outputWidth/dims.outputHeight)-1)>.015)sizeError="Physical dimensions do not match template aspect ratio."}catch(e){sizeError=e instanceof Error?e.message:"Invalid physical dimensions"}
   const students:any[]=[];for(let from=0;from<15000;from+=1000){const {data,error}=await s.from("students").select("id,serial_number,data").eq("project_id",projectId).eq("owner_id",uid).order("serial_number").range(from,from+999);if(error)throw new Error(error.message);students.push(...(data??[]));if((data??[]).length<1000)break}
   const {data:photos,error:pe}=await s.from("student_photos").select("student_id,match_status,processing_status,crop_approved_at").eq("project_id",projectId).eq("owner_id",uid).not("student_id","is",null);
   if(pe)throw new Error(pe.message);
   const approved=new Set((photos??[]).filter((p:any)=>p.match_status==="APPROVED"&&p.processing_status==="APPROVED"&&p.crop_approved_at&&p.student_id).map((p:any)=>p.student_id));
   const photoRequired=fields.some(photoField),issues=students.map((st:any)=>({serialNumber:st.serial_number,issues:[...validateBindings(fields,(st.data??{}) as Record<string,unknown>,project.school_name,approved.has(st.id)),...(photoRequired&&!approved.has(st.id)&&!fields.some(f=>photoField(f)&&f.required)?["Photo is not approved; card cannot use an unapproved image."]:[])]})).filter((x:any)=>x.issues.length);
   const eligible=students.length-issues.length;
   return NextResponse.json({totalStudents:students.length,eligibleStudents:eligible,blockedStudents:issues.length,issues:issues.slice(0,100),dimensions:dims,format:body.format==="jpeg"?"jpeg":"png",dpi,template:{name:template.name,version:template.version_number,width:template.width_px,height:template.height_px},configurationErrors:[...(!fields.length?["No fields configured."]:[]),...(sizeError?[sizeError]:[])]});
  }
  if(body.action!=="render")return NextResponse.json({error:"Unsupported action."},{status:400});
  const studentId=typeof body.studentId==="string"?body.studentId:"";
  const widthMm=Number(body.widthMm),heightMm=Number(body.heightMm),dpi=Number(body.dpi);
  const format:OutputFormat=body.format==="jpeg"?"jpeg":"png";
  const {outputWidth,outputHeight}=validatePhysicalSize(widthMm,heightMm,dpi);
  const {data:student,error:se}=await s.from("students").select("id,serial_number,data").eq("id",studentId).eq("project_id",projectId).eq("owner_id",uid).maybeSingle();
  if(se)throw new Error(se.message);if(!student)return NextResponse.json({error:"Student not found in this project."},{status:404});
  const templateBuffer=await download(s,STORAGE_BUCKETS.templates,template.source_path);
  const meta=await sharp(templateBuffer,{limitInputPixels:40_000_000}).metadata();
  if(meta.width!==template.width_px||meta.height!==template.height_px)return NextResponse.json({error:"Uploaded template dimensions do not match its stored metadata."},{status:422});
  let photoBuffer:Buffer|null=null,photoPath:string|null=null;
  if(fields.some(photoField)){
   const {data:photo,error:pe}=await s.from("student_photos").select("id,student_id,processed_storage_path,match_status,processing_status,crop_approved_at,content_sha256,processing_version").eq("student_id",student.id).eq("project_id",projectId).eq("owner_id",uid).eq("match_status","APPROVED").eq("processing_status","APPROVED").not("crop_approved_at","is",null).maybeSingle();
   if(pe)throw new Error(pe.message);if(!photo?.processed_storage_path)return NextResponse.json({error:"This student does not have an approved processed photograph. Approve the photo and crop in Phase 7 first."},{status:422});
   photoPath=photo.processed_storage_path;photoBuffer=await download(s,STORAGE_BUCKETS.studentPhotos,photoPath);
   if(photo.content_sha256==null){} // The processed image is validated by Sharp below; original identity is not inferred.
  }
  const data=(student.data??{}) as Record<string,unknown>;
  const inputHash=hash(JSON.stringify({renderer:RENDERER_VERSION,template:hash(templateBuffer),templateId,templateVersion:template.version_number,fields,studentId:student.id,serial:student.serial_number,data,schoolName:project.school_name,photoPath,photo:photoBuffer?hash(photoBuffer):null,widthMm,heightMm,dpi,format}));
  const {data:old}=await db.from("generated_cards").select("*").eq("project_id",projectId).eq("owner_id",uid).eq("student_id",student.id).eq("template_id",templateId).eq("input_hash",inputHash).eq("output_format",format).maybeSingle();
  if(old?.status==="generated"&&old.storage_path){const {data:signed}=await s.storage.from(dbBucket).createSignedUrl(old.storage_path,600);if(signed?.signedUrl)return NextResponse.json({success:true,reused:true,cardId:old.id,previewUrl:signed.signedUrl,width:old.output_width_px,height:old.output_height_px,dpi:old.output_dpi,warnings:old.render_warnings??[]})}
  let card=old;
  if(!card){
   const {data:batch,error:be}=await s.from("batches").insert({owner_id:uid,project_id:projectId,name:"Phase 8 card "+student.serial_number,status:"processing",total_count:1,completed_count:0,failed_count:0,review_count:0,started_at:new Date().toISOString()}).select("id").single();
   if(be)throw new Error(be.message);
   const {data:created,error:ce}=await db.from("generated_cards").insert({batch_id:batch.id,owner_id:uid,project_id:projectId,student_id:student.id,serial_number:student.serial_number,filename:"student-"+student.serial_number+"."+format,status:"pending",validation_status:"pending",template_id:templateId,template_version:template.version_number,renderer_version:RENDERER_VERSION,input_hash:inputHash,output_format:format,output_width_px:outputWidth,output_height_px:outputHeight,output_dpi:dpi}).select("*").single();
   if(ce)throw new Error(ce.message);card=created;
  } else {await db.from("generated_cards").update({status:"pending",validation_status:"pending",render_errors:[],render_warnings:[]}).eq("id",card.id).eq("owner_id",uid)}
  const result=await renderCard({template:templateBuffer,templateWidth:template.width_px,templateHeight:template.height_px,outputWidth,outputHeight,dpi,format,fields,student:data,schoolName:project.school_name,photo:photoBuffer});
  if(result.errors.length){await db.from("generated_cards").update({status:"needs_review",validation_status:"failed",render_errors:result.errors,render_warnings:result.warnings}).eq("id",card.id).eq("owner_id",uid);return NextResponse.json({error:"Card blocked by required-field or layout validation.",issues:result.errors,warnings:result.warnings},{status:422})}
  const outputHash=hash(result.buffer),path=uid+"/"+projectId+"/rendered/"+student.id+"/"+inputHash+"."+format;
  const {error:up}=await s.storage.from(dbBucket).upload(path,result.buffer,{contentType:format==="png"?"image/png":"image/jpeg",upsert:true});
  if(up){await db.from("generated_cards").update({status:"failed",validation_status:"failed",render_errors:["Private output storage upload failed."]}).eq("id",card.id).eq("owner_id",uid);return NextResponse.json({error:"Rendered image could not be saved to private storage. Retry the card."},{status:500})}
  const {error:save}=await db.from("generated_cards").update({status:"generated",validation_status:result.warnings.length?"warning":"passed",storage_path:path,output_hash:outputHash,render_warnings:result.warnings,render_errors:[],rendered_at:new Date().toISOString()}).eq("id",card.id).eq("owner_id",uid);
  if(save){await s.storage.from(dbBucket).remove([path]);throw new Error("Card output was rendered but its database record could not be saved.");}
  await s.from("audit_logs").insert({owner_id:uid,project_id:projectId,action:"id_card_rendered",entity_type:"generated_card",entity_id:card.id,metadata:{templateVersion:template.version_number,rendererVersion:RENDERER_VERSION,format,width:outputWidth,height:outputHeight,dpi,warningCount:result.warnings.length}});
  const {data:signed,error:sig}=await s.storage.from(dbBucket).createSignedUrl(path,600);if(sig||!signed?.signedUrl)throw new Error("Card was saved, but its private preview link could not be created.");
  return NextResponse.json({success:true,reused:false,cardId:card.id,previewUrl:signed.signedUrl,width:outputWidth,height:outputHeight,dpi,format,warnings:result.warnings,outputHash});
 } catch(e) {return NextResponse.json({error:e instanceof Error?e.message:"Card rendering failed."},{status:500})}
}
