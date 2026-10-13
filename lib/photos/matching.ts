import { canonicalizeStudentIdentifier, DEFAULT_STUDENT_IDENTIFIER_POLICY, type StudentIdentifierPolicy } from "@/lib/identifiers/student-identifier";
export type FilenameMatch =
 | {status:"EXACT"; originalSerial:string; normalizedSerial:string; legacySerialNumber:number|null; method:"filename_numeric"|"filename_prefixed"|"filename_text"}
 | {status:"NEEDS_REVIEW"; originalSerial:string|null; normalizedSerial:null; legacySerialNumber:null; reason:string};
export type StudentSerial = {id:string; serial_number:number|null; student_identifier?:string|null};
export type MatchProposal = {status:"MATCHED"|"NEEDS_REVIEW"|"UNMATCHED"|"DUPLICATE"; studentId:string|null; serialNumber:number|null; studentIdentifier:string|null; normalizedSerial:string|null; matchingMethod:string|null; reason?:string};
export function normalizeCanonicalSerial(value:string|number|null|undefined):string|null {
 if(value===null||value===undefined) return null;
 const result=canonicalizeStudentIdentifier(String(value),DEFAULT_STUDENT_IDENTIFIER_POLICY);
 return result.ok?result.value:null;
}
export function parsePhotoFilename(filename:string, configuredPrefix:string|null=null, policy:StudentIdentifierPolicy=DEFAULT_STUDENT_IDENTIFIER_POLICY):FilenameMatch {
 const base=filename.split(/[\\/]/).pop()??filename;
 const dot=base.lastIndexOf(".");
 if(dot<=0) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Missing or unsupported file extension"};
 const stem=base.slice(0,dot);
 if(!stem) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Empty filename"};
 if(["photo","image","img","student","unknown","untitled"].includes(stem.toLocaleLowerCase("en-US"))) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Filename is generic and does not identify a student"};
 let candidate:string|null=null;
 let method:"filename_numeric"|"filename_prefixed"|"filename_text"="filename_text";
 if(configuredPrefix && /^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(configuredPrefix)) {
  const escaped=configuredPrefix.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const prefixMatch=stem.match(new RegExp("^("+escaped+"-\\d+)(?:_([A-Za-z][A-Za-z0-9 _-]*))?$","i"));
  if(prefixMatch){candidate=prefixMatch[1];method="filename_prefixed";}
 }
 if(!candidate && !configuredPrefix && /^[A-Za-z][A-Za-z0-9_]*-\d+(?:_.*)?$/.test(stem)) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Prefixed identifier requires an explicit project prefix configuration"};
 if(!candidate) {
  const numeric=stem.match(/^(\d+)(?:[_ -]([A-Za-z][A-Za-z0-9 _-]*))?$/);
  if(numeric){candidate=numeric[1];method="filename_numeric";}
 }
 if(!candidate) {
  const optionalSuffix=stem.match(/^([\p{L}\p{N}.-]+)_([A-Za-z][A-Za-z0-9 _-]*)$/u);
  if(optionalSuffix && /\d/.test(optionalSuffix[1])) {
   candidate=optionalSuffix[1];method=/^\d+$/.test(candidate)?"filename_numeric":"filename_text";
  } else {
   // A text identifier may contain underscores. If an underscore could instead begin a
   // descriptive suffix, do not guess unless the configured prefix/numeric rule disambiguates it.
   if(stem.includes("_") && !/^\d+_[A-Za-z][A-Za-z0-9 _-]*$/.test(stem)) {
    const groups=stem.match(/\d+/g)??[];
    if(groups.length>1) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Filename contains multiple possible identifier/serial groups"};
    if(groups.length===0 && /^([\p{L}\p{N}.-]+)_([A-Za-z][A-Za-z0-9 _-]*)$/u.test(stem)) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Underscore may separate an identifier from a descriptive name"};
    if(!/^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u.test(stem)) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,legacySerialNumber:null,reason:"Filename identifier is ambiguous or contains unsupported characters"};
   }
   candidate=stem;method=/^\d+$/.test(stem)?"filename_numeric":"filename_text";
  }
 }
 const result=canonicalizeStudentIdentifier(candidate,policy);
 if(!result.ok) return {status:"NEEDS_REVIEW",originalSerial:candidate,normalizedSerial:null,legacySerialNumber:null,reason:result.error};
 const digitGroups=stem.match(/\d+/g)??[];
 if(digitGroups.length>1 && !configuredPrefix) return {status:"NEEDS_REVIEW",originalSerial:candidate,normalizedSerial:null,legacySerialNumber:null,reason:"Filename contains multiple numeric groups; identifier cannot be determined safely"};
 return {status:"EXACT",originalSerial:candidate,normalizedSerial:result.value,legacySerialNumber:result.legacySerialNumber,method};
}
export function proposePhotoMatch(filenameMatch:FilenameMatch,students:StudentSerial[],duplicateHash=false):MatchProposal {
 if(duplicateHash) return {status:"DUPLICATE",studentId:null,serialNumber:filenameMatch.status==="EXACT"?filenameMatch.legacySerialNumber:null,studentIdentifier:filenameMatch.status==="EXACT"?filenameMatch.normalizedSerial:null,normalizedSerial:filenameMatch.status==="EXACT"?filenameMatch.normalizedSerial:null,matchingMethod:"sha256",reason:"Exact file content already exists in this project"};
 if(filenameMatch.status!=="EXACT") return {status:"NEEDS_REVIEW",studentId:null,serialNumber:null,studentIdentifier:null,normalizedSerial:null,matchingMethod:null,reason:filenameMatch.reason};
 const found=students.filter(s=>(s.student_identifier??(s.serial_number===null?null:String(s.serial_number)))===filenameMatch.normalizedSerial);
 if(found.length===0) return {status:"UNMATCHED",studentId:null,serialNumber:filenameMatch.legacySerialNumber,studentIdentifier:filenameMatch.normalizedSerial,normalizedSerial:filenameMatch.normalizedSerial,matchingMethod:filenameMatch.method,reason:"No student has this exact identifier in the current project"};
 if(found.length>1) return {status:"NEEDS_REVIEW",studentId:null,serialNumber:filenameMatch.legacySerialNumber,studentIdentifier:filenameMatch.normalizedSerial,normalizedSerial:filenameMatch.normalizedSerial,matchingMethod:filenameMatch.method,reason:"Multiple students have this exact identifier in the current project"};
 return {status:"MATCHED",studentId:found[0].id,serialNumber:found[0].serial_number,studentIdentifier:filenameMatch.normalizedSerial,normalizedSerial:filenameMatch.normalizedSerial,matchingMethod:filenameMatch.method};
}
export function isSafeZipEntryName(name:string):boolean {
 if(!name||name.length>240||name.includes("\0")||name.startsWith("/")||name.startsWith("\\")||/^[A-Za-z]:/.test(name)) return false;
 const parts=name.replace(/\\/g,"/").split("/");
 return parts.every(p=>p!== ".." && p!== "." && !p.includes(":"));
}
export function detectImageMime(bytes:Uint8Array):"image/jpeg"|"image/png"|"image/webp"|null {
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff) return "image/jpeg";
 if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10) return "image/png";
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP") return "image/webp";
 return null;
}

export function hasDuplicateContentHash(existingHashes:string[],candidateHash:string){return !!candidateHash&&existingHashes.includes(candidateHash);}
export function withinPhotoBatchLimits(sizes:number[],maxFiles=500,maxFileBytes=10*1024*1024,maxBatchBytes=500*1024*1024){return sizes.length>0&&sizes.length<=maxFiles&&sizes.every(n=>Number.isFinite(n)&&n>0&&n<=maxFileBytes)&&sizes.reduce((a,b)=>a+b,0)<=maxBatchBytes;}
export function assertPhotoAssignmentProject(requestedProjectId:string,photoProjectId:string,studentProjectId:string){if(!requestedProjectId||requestedProjectId!==photoProjectId||requestedProjectId!==studentProjectId)throw new Error("Photo and student must belong to the same school project.");}
export function approvedPhotoConflict(existingApproved:boolean,replaceConfirmed:boolean){return existingApproved&&!replaceConfirmed;}
export function assertDuplicatePhotoAssignment(matchStatus:string,duplicateOfId:string|null|undefined,confirmed:boolean){if((matchStatus==="DUPLICATE"||!!duplicateOfId)&&!confirmed)throw new Error("This photo has identical file content to another upload. Review the duplicate warning and explicitly confirm use of this image before assigning it.");}
