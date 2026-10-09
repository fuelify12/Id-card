import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { sha256 } from "@/lib/exports/archive";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;cardId:string}>}){
 const {id,cardId}=await params;const db=await createClient();const {data:claims}=await db.auth.getClaims();const uid=claims?.claims?.sub as string|undefined;if(!uid)return fail("Unauthorized",401);
 const {data:project,error:pe}=await db.from("school_projects").select("id,owner_id,validation_settings").eq("id",id).eq("owner_id",uid).maybeSingle();if(pe)return fail("Could not verify project access.",500);if(!project)return fail("Project not found or access denied.",404);
 const {data:card,error}=await db.from("generated_cards").select("id,project_id,owner_id,student_id,batch_id,serial_number,filename,status,storage_path,output_sha256,output_format,output_width_px,output_height_px,template_id,template_version,photo_id,photo_version,generated_at,created_at,validation_status,approval_status").eq("id",cardId).eq("project_id",id).eq("owner_id",uid).maybeSingle();
 if(error||!card)return fail("Card not found or access denied.",404);
 if(card.status!=="generated"||card.approval_status!=="approved"||!card.storage_path||!card.output_sha256||!["passed",...(project.validation_settings?.allow_warnings_for_approval===true?["warning"]:[])].includes(card.validation_status))return fail("Only complete, currently validated, explicitly approved cards can be downloaded.",422);
 const {data:template,error:te}=await db.from("templates").select("id,version_number").eq("id",card.template_id).eq("project_id",id).eq("owner_id",uid).maybeSingle();if(te||!template||Number(template.version_number)!==Number(card.template_version))return fail("Template changed after rendering. Regenerate and revalidate this card.",422);
 const {data:student,error:se}=await db.from("students").select("id,updated_at").eq("id",card.student_id).eq("project_id",id).eq("owner_id",uid).maybeSingle();if(se||!student)return fail("Student record could not be verified.",422);
 if(student.updated_at&&(card.generated_at??card.created_at)&&Date.parse(student.updated_at)>Date.parse(card.generated_at??card.created_at))return fail("Student data changed after rendering. Regenerate and revalidate this card.",422);
 if(card.photo_id){const {data:photo,error:pe2}=await db.from("student_photos").select("id,project_id,owner_id,student_id,image_version,match_status,processing_status,crop_approved_at,processed_storage_path").eq("id",card.photo_id).eq("project_id",id).eq("owner_id",uid).maybeSingle();if(pe2||!photo||photo.student_id!==card.student_id||photo.match_status!=="APPROVED"||photo.processing_status!=="APPROVED"||!photo.crop_approved_at||!photo.processed_storage_path||Number(photo.image_version)!==Number(card.photo_version))return fail("Approved photo assignment is stale or invalid.",422);}
 const {data:findings,error:fe}=await db.from("card_validation_findings").select("severity,status").eq("project_id",id).eq("owner_id",uid).eq("generated_card_id",card.id).in("status",["OPEN","IN_REVIEW"]);if(fe)return fail("Could not verify current validation findings.",500);
 if((findings??[]).some((f:any)=>["CRITICAL","ERROR"].includes(f.severity)))return fail("Unresolved critical/error findings block download.",422);
 if((findings??[]).some((f:any)=>f.severity==="WARNING")&&project.validation_settings?.allow_warnings_for_approval!==true)return fail("Unresolved warnings block download under this project's policy.",422);
 if(!card.storage_path.startsWith(uid+"/"+id+"/")||card.storage_path.includes("..")||card.storage_path.startsWith("/"))return fail("Stored card path is invalid.",403);
 const {data:blob,error:be}=await db.storage.from(STORAGE_BUCKETS.generatedCards).download(card.storage_path);if(be||!blob)return fail("Stored card output is missing.",410);
 const bytes=Buffer.from(await blob.arrayBuffer());if(sha256(bytes)!==card.output_sha256)return fail("Stored card integrity verification failed.",422);
 try{if(card.output_format==="pdf")await PDFDocument.load(bytes,{throwOnInvalidObject:true});else{const m=await sharp(bytes,{limitInputPixels:100_000_000,failOn:"error"}).metadata();if(!m.width||!m.height)return fail("Stored image is not readable.",422);if(card.output_width_px&&m.width!==card.output_width_px||card.output_height_px&&m.height!==card.output_height_px)return fail("Stored image dimensions do not match the approved output.",422)}}catch{return fail("Stored output could not be decoded.",422);}
 const filename=String(card.filename??("card-"+card.serial_number+"."+card.output_format)).replace(/[\\/\u0000-\u001f\u007f]/g,"-").slice(0,120);
 const {data:signed,error:signError}=await db.storage.from(STORAGE_BUCKETS.generatedCards).createSignedUrl(card.storage_path,60,{download:filename});if(signError||!signed?.signedUrl)return fail("Could not create a secure card download link.",500);
 const {error:ae}=await db.from("audit_logs").insert({owner_id:uid,project_id:id,action:"individual_card_download_link_issued",entity_type:"generated_card",entity_id:card.id,metadata:{batch_id:card.batch_id,format:card.output_format}});if(ae)return fail("Could not record download audit event.",500);
 return NextResponse.json({url:signed.signedUrl,expiresInSeconds:60,filename});
}
