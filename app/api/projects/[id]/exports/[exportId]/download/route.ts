import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { sha256, verifyZipDirectory } from "@/lib/exports/archive";
import { isExpectedExportStoragePath, verifyArchiveIntegrity } from "@/lib/exports/integrity";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;exportId:string}>}){
 const {id,exportId}=await params;const db=await createClient();const {data:claims}=await db.auth.getClaims();const uid=claims?.claims?.sub as string|undefined;if(!uid)return fail("Unauthorized",401);
 const {data:project,error:pe}=await db.from("school_projects").select("id,owner_id").eq("id",id).eq("owner_id",uid).maybeSingle();if(pe)return fail("Could not verify project access.",500);if(!project)return fail("Project not found or access denied.",404);
 const {data:job,error}=await db.from("exports").select("id,project_id,owner_id,status,storage_path,filename,archive_sha256,archive_bytes,manifest,expires_at").eq("id",exportId).eq("project_id",id).eq("owner_id",uid).maybeSingle();
 if(error||!job)return fail("Export not found or access denied.",404);
 if(job.status!=="completed"&&job.status!=="completed_with_errors")return fail("This export is not ready to download.",409);
 if(!job.expires_at||Date.parse(job.expires_at)<=Date.now()){
  if(job.storage_path)await db.storage.from(STORAGE_BUCKETS.exports).remove([job.storage_path]);
  await db.from("exports").update({status:"expired",storage_path:null,updated_at:new Date().toISOString()}).eq("id",exportId).eq("project_id",id).eq("owner_id",uid);
  return fail("This archive has expired and was removed. Create a new export.",410);
 }
 if(!isExpectedExportStoragePath(job.storage_path,uid,id,exportId))return fail("Export storage reference is invalid.",403);
 const folder=job.storage_path.slice(0,job.storage_path.lastIndexOf("/"));
 const {data:objects,error:oe}=await db.storage.from(STORAGE_BUCKETS.exports).list(folder,{search:"archive.zip",limit:10});
 if(oe)return fail("Could not verify private archive storage.",500);
 if(!(objects??[]).some((o:any)=>o.name==="archive.zip"))return fail("Archive is no longer available.",410);
 const {data:archiveBlob,error:archiveError}=await db.storage.from(STORAGE_BUCKETS.exports).download(job.storage_path);
 if(archiveError||!archiveBlob)return fail("Archive is no longer available.",410);
 const archiveBytes=Buffer.from(await archiveBlob.arrayBuffer());
 if(!job.archive_sha256||sha256(archiveBytes)!==String(job.archive_sha256).toLowerCase())return fail("Stored archive integrity verification failed. Create a fresh export.",422);
 if(job.archive_bytes!=null&&Number.isFinite(Number(job.archive_bytes))&&Number(job.archive_bytes)!==archiveBytes.length)return fail("Stored archive size differs from its verified metadata.",422);
 const expectedNames=job.manifest?.expected_names;
 if(!Array.isArray(expectedNames)||expectedNames.length===0||!expectedNames.every((name:any)=>typeof name==="string"))return fail("Export integrity metadata is missing. Create a fresh export.",422);
 const expectedItems=job.manifest?.items;
 const verification=Array.isArray(expectedItems)
   ? verifyArchiveIntegrity(archiveBytes,expectedNames,expectedItems)
   : verifyZipDirectory(archiveBytes,expectedNames);
 if(!verification.ok)return fail("Stored archive contents failed integrity verification. Create a fresh export.",422);
 const {data,error:se}=await db.storage.from(STORAGE_BUCKETS.exports).createSignedUrl(job.storage_path,60,{download:job.filename});
 if(se||!data?.signedUrl)return fail("Could not create a secure download link.",500);
 const {error:ae}=await db.rpc("record_export_download_link_issued",{p_project_id:id,p_export_id:exportId});
 if(ae)return fail("Could not record download audit event.",500);
 return NextResponse.json({url:data.signedUrl,expiresInSeconds:60,filename:job.filename});
}
