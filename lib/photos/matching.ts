export type FilenameMatch =
 | {status:"EXACT"; originalSerial:string; normalizedSerial:string; method:"filename_numeric"|"filename_prefixed"}
 | {status:"NEEDS_REVIEW"; originalSerial:string|null; normalizedSerial:null; reason:string};
export type StudentSerial = {id:string; serial_number:number};
export type MatchProposal = {status:"MATCHED"|"NEEDS_REVIEW"|"UNMATCHED"|"DUPLICATE"; studentId:string|null; serialNumber:number|null; normalizedSerial:string|null; matchingMethod:string|null; reason?:string};
export function normalizeCanonicalSerial(value:string|number|null|undefined):string|null {
 if(value===null||value===undefined) return null;
 const s=String(value).trim();
 if(!/^\d+$/.test(s)) return null;
 try { const n=BigInt(s); if(n>2147483647n) return null; return n.toString(); } catch { return null; }
}
export function parsePhotoFilename(filename:string, configuredPrefix:string|null=null):FilenameMatch {
 const base=filename.split(/[\\/]/).pop()??filename;
 const dot=base.lastIndexOf(".");
 if(dot<=0) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,reason:"Missing or unsupported file extension"};
 const stem=base.slice(0,dot).trim();
 if(!stem) return {status:"NEEDS_REVIEW",originalSerial:null,normalizedSerial:null,reason:"Empty filename"};
 let m:RegExpMatchArray|null=null;
 let method:"filename_numeric"|"filename_prefixed"="filename_numeric";
 if(configuredPrefix && /^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(configuredPrefix)) {
  const escaped=configuredPrefix.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  m=stem.match(new RegExp("^"+escaped+"[-_ ](\\d+)(?:[_ -][A-Za-z][A-Za-z0-9 _-]*)?$","i"));
  if(m) method="filename_prefixed";
 }
 if(!m) m=stem.match(/^(\d+)(?:[_ -][A-Za-z][A-Za-z0-9 _-]*)?$/);
 if(!m) {
  const digits=stem.match(/\d+/g)??[];
  return {status:"NEEDS_REVIEW",originalSerial:digits.length===1?digits[0]:null,normalizedSerial:null,reason:digits.length>1?"Filename contains multiple possible serial numbers":"Filename does not match a supported serial pattern"};
 }
 const originalSerial=m[1];
 const normalizedSerial=normalizeCanonicalSerial(originalSerial);
 if(normalizedSerial===null) return {status:"NEEDS_REVIEW",originalSerial,normalizedSerial:null,reason:"Serial number is outside the supported numeric range"};
 const allDigitGroups=stem.match(/\d+/g)??[];
 if(allDigitGroups.length>1) return {status:"NEEDS_REVIEW",originalSerial,normalizedSerial:null,reason:"Filename contains conflicting or multiple serial-like number groups"};
 return {status:"EXACT",originalSerial,normalizedSerial,method};
}
export function proposePhotoMatch(filenameMatch:FilenameMatch,students:StudentSerial[],duplicateHash=false):MatchProposal {
 if(duplicateHash) return {status:"DUPLICATE",studentId:null,serialNumber:null,normalizedSerial:filenameMatch.status==="EXACT"?filenameMatch.normalizedSerial:null,matchingMethod:"sha256",reason:"Exact file content already exists in this project"};
 if(filenameMatch.status!=="EXACT") return {status:"NEEDS_REVIEW",studentId:null,serialNumber:null,normalizedSerial:null,matchingMethod:null,reason:filenameMatch.reason};
 const found=students.filter(s=>normalizeCanonicalSerial(s.serial_number)===filenameMatch.normalizedSerial);
 if(found.length===0) return {status:"UNMATCHED",studentId:null,serialNumber:Number(filenameMatch.normalizedSerial),normalizedSerial:filenameMatch.normalizedSerial,matchingMethod:filenameMatch.method,reason:"No student has this serial number in the current project"};
 if(found.length>1) return {status:"NEEDS_REVIEW",studentId:null,serialNumber:Number(filenameMatch.normalizedSerial),normalizedSerial:filenameMatch.normalizedSerial,matchingMethod:filenameMatch.method,reason:"Multiple students have the same canonical serial number"};
 return {status:"MATCHED",studentId:found[0].id,serialNumber:found[0].serial_number,normalizedSerial:filenameMatch.normalizedSerial,matchingMethod:filenameMatch.method};
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
