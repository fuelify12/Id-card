import {createHash} from "node:crypto";
import sharp from "sharp";
import {detectImageMime} from "@/lib/photos/matching";
export type VerifiedPhoto={mime:"image/jpeg"|"image/png"|"image/webp"|null;width:number|null;height:number|null;sha256:string;errors:string[]};
export async function inspectPhotoBuffer(bytes:Buffer):Promise<VerifiedPhoto>{
 const errors:string[]=[];const mime=detectImageMime(new Uint8Array(bytes.subarray(0,16)));
 let width:number|null=null,height:number|null=null;
 const sha256=createHash("sha256").update(bytes).digest("hex");
 if(!bytes.length)errors.push("Empty image file.");
 if(!mime)errors.push("Unsupported or unrecognized image contents.");
 if(mime){
  try{
   const metadata=await sharp(bytes,{limitInputPixels:40_000_000,failOn:"error"}).metadata();
   if(!metadata.width||!metadata.height)errors.push("Image dimensions could not be read.");
   else{width=metadata.width;height=metadata.height;if(width<64||height<64)errors.push("Image resolution must be at least 64×64 pixels.");if(width>12000||height>12000||width*height>40_000_000)errors.push("Image dimensions exceed the 40-megapixel safety limit.");}
   if(!errors.length)await sharp(bytes,{limitInputPixels:40_000_000,failOn:"error"}).rotate().toBuffer();
  }catch{errors.push("Image is corrupt or cannot be decoded.");}
 }
 return {mime,width,height,sha256,errors:[...new Set(errors)]};
}
