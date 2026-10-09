import sharp from "sharp";

export const RENDERER_VERSION = "1.0.0";
export type OutputFormat = "png" | "jpeg";
export type RenderField = {
  id:string; key:string; label:string; field_type:string; required:boolean;
  x:number; y:number; width:number; height:number; font_family:string|null;
  font_size:number|null; font_weight:string|null; color:string|null; alignment:string|null;
  fit_mode:string|null; source_column:string|null; static_value?:string|null;
  max_lines?:number|null; overflow_policy?:string|null; auto_shrink?:boolean|null;
  min_font_size?:number|null; line_height?:number|null; vertical_alignment?:string|null;
  rotation?:number|null; visible?:boolean|null; field_format?:string|null;
};
export type RenderWarning = {code:string;field?:string;message:string};
export type RenderInput = {template:Buffer;templateWidth:number;templateHeight:number;outputWidth:number;outputHeight:number;dpi:number;format:OutputFormat;fields:RenderField[];student:Record<string,unknown>;schoolName:string;photo?:Buffer|null};
export type RenderResult = {buffer:Buffer;width:number;height:number;format:OutputFormat;warnings:RenderWarning[];errors:string[]};
const MAX_PIXELS=40_000_000;
const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const round=(n:number)=>Number(n.toFixed(3));
const photoField=(f:RenderField)=>["photo","student_photo","image"].includes(f.field_type.toLowerCase())||f.key.toLowerCase()==="student_photo";
function valueOf(f:RenderField,data:Record<string,unknown>,school:string){
 if(f.static_value!=null)return String(f.static_value);
 const k=(f.source_column||f.key||"").trim();
 if(k==="$school_name"||f.key.toLowerCase()==="school_name")return school;
 const v=data[k];if(v==null||typeof v==="object")return "";
 if(f.field_format==="date"&&String(v)){const d=new Date(String(v));if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(d)}
 return String(v);
}
function wrap(s:string,max:number){const out:string[]=[];for(const para of s.split("\n")){let line="";for(const word of para.split(/\s+/).filter(Boolean)){if(!line)line=word;else if((line+" "+word).length<=max)line+=" "+word;else{out.push(line);line=word}}out.push(line)}return out}
export function validatePhysicalSize(widthMm:number,heightMm:number,dpi:number){
 if(![widthMm,heightMm,dpi].every(Number.isFinite)||widthMm<=0||heightMm<=0||widthMm>500||heightMm>500)throw new Error("Card dimensions must be positive and no greater than 500 mm.");
 if(!Number.isInteger(dpi)||dpi<72||dpi>1200)throw new Error("DPI must be a whole number from 72 to 1200.");
 const outputWidth=Math.round(widthMm/25.4*dpi),outputHeight=Math.round(heightMm/25.4*dpi);
 if(outputWidth<32||outputHeight<32||outputWidth*outputHeight>MAX_PIXELS)throw new Error("Output exceeds the 40-megapixel rendering safety limit.");
 return {outputWidth,outputHeight};
}
export function validateBindings(fields:RenderField[],data:Record<string,unknown>,school:string,hasPhoto:boolean){
 const errors:string[]=[];
 for(const f of fields){if(f.visible===false)continue;if(photoField(f)){if(f.required&&!hasPhoto)errors.push("Approved processed student photo is missing.");continue}if(f.required&&!valueOf(f,data,school).trim())errors.push("Required field is missing: "+(f.label||f.key))}
 return errors;
}
export async function renderCard(input:RenderInput):Promise<RenderResult>{
 const {template,templateWidth,templateHeight,outputWidth,outputHeight,dpi,format,fields,student,schoolName}=input;
 if(![templateWidth,templateHeight,outputWidth,outputHeight].every(n=>Number.isInteger(n)&&n>0))throw new Error("Template and output dimensions must be positive whole pixels.");
 if(outputWidth*outputHeight>MAX_PIXELS)throw new Error("Output exceeds the 40-megapixel rendering safety limit.");
 if(!Number.isInteger(dpi)||dpi<72||dpi>1200)throw new Error("DPI must be a whole number from 72 to 1200.");
 const meta=await sharp(template,{limitInputPixels:MAX_PIXELS}).metadata();
 if(!["png","jpeg"].includes(meta.format||""))throw new Error("Only PNG and JPEG raster templates are supported.");
 if(meta.width!==templateWidth||meta.height!==templateHeight)throw new Error("Template dimensions do not match the uploaded source.");
 const a=templateWidth/templateHeight,b=outputWidth/outputHeight;
 if(Math.abs(a-b)/a>.015)throw new Error("Configured physical card size does not match the template aspect ratio. Confirm dimensions before rendering.");
 const warnings:RenderWarning[]=[],errors=validateBindings(fields,student,schoolName,!!input.photo);
 if(errors.length)return {buffer:Buffer.alloc(0),width:outputWidth,height:outputHeight,format,warnings,errors};
 const overlays:sharp.OverlayOptions[]=[];
 for(const f of fields){
  if(f.visible===false)continue;
  const x=Math.round(f.x/templateWidth*outputWidth),y=Math.round(f.y/templateHeight*outputHeight),w=Math.round(f.width/templateWidth*outputWidth),h=Math.round(f.height/templateHeight*outputHeight);
  if(x<0||y<0||w<1||h<1||x+w>outputWidth||y+h>outputHeight){errors.push("Field region is outside the card: "+(f.label||f.key));continue}
  if(photoField(f)){
   if(!input.photo)continue;
   try{const fit=f.fit_mode==="cover"?"cover":"contain";const photo=await sharp(input.photo,{limitInputPixels:MAX_PIXELS}).rotate().resize(w,h,{fit,position:"centre",background:{r:255,g:255,b:255,alpha:0}}).png().toBuffer();overlays.push({input:photo,left:x,top:y})}catch{errors.push("Approved photo could not be decoded.")}
   continue;
  }
  const text=valueOf(f,student,schoolName);if(!text)continue;
  let size=Math.max(1,(f.font_size||24)*outputWidth/templateWidth);
  const min=Math.max(6,(f.min_font_size??8)*outputWidth/templateWidth),maxLines=Math.max(1,Math.min(12,f.max_lines??1)),lh=Math.max(.8,Math.min(2.5,f.line_height??1.15));
  const family=(f.font_family||"Arial, Noto Sans, sans-serif").replace(/[^a-zA-Z0-9 ,_-]/g,"");
  const weight=["bold","700"].includes(f.font_weight||"")?"700":f.font_weight==="600"?"600":"400";
  const align=["left","center","right"].includes(f.alignment||"")?f.alignment!:"left",anchor=align==="center"?"middle":align==="right"?"end":"start";
  let lines=wrap(text,Math.max(1,Math.floor(w/(size*.56))));
  while(f.auto_shrink!==false&&size>min&&(lines.length>maxLines||lines.length*size*lh>h)){size=Math.max(min,size-1);lines=wrap(text,Math.max(1,Math.floor(w/(size*.56))))}
  if(lines.length>maxLines||lines.length*size*lh>h){warnings.push({code:"TEXT_OVERFLOW",field:f.key,message:"Text does not fit the configured field."});if(f.overflow_policy==="block"){errors.push("Text overflow in required layout field: "+f.label);continue}lines=lines.slice(0,maxLines)}
  if(/[^\u0000-\u024f]/u.test(text))warnings.push({code:"GLYPH_REVIEW",field:f.key,message:"Verify non-Latin shaping and glyph coverage in the sample card."});
  const gap=size*lh,total=lines.length*gap,va=f.vertical_alignment||"middle",first=va==="top"?size:va==="bottom"?h-total+size:(h-total)/2+size,tx=align==="left"?0:align==="center"?w/2:w;
  const spans=lines.map((line,i)=>'<tspan x="'+tx+'" y="'+round(first+i*gap)+'">'+esc(line)+'</tspan>').join("");
  const rot=Number.isFinite(f.rotation)?Number(f.rotation):0,transform=rot?' transform="rotate('+round(rot)+' '+round(w/2)+' '+round(h/2)+')"':"";
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><text'+transform+' font-family="'+esc(family)+'" font-size="'+round(size)+'" font-weight="'+weight+'" fill="'+esc(f.color||"#111111")+'" text-anchor="'+anchor+'">'+spans+'</text></svg>');
  overlays.push({input:svg,left:x,top:y});
 }
 if(errors.length)return {buffer:Buffer.alloc(0),width:outputWidth,height:outputHeight,format,warnings,errors};
 let pipe=sharp(template,{limitInputPixels:MAX_PIXELS}).rotate().resize(outputWidth,outputHeight,{fit:"fill"}).composite(overlays).withMetadata({density:dpi});
 const buffer=format==="png"?await pipe.png({compressionLevel:9,adaptiveFiltering:false,palette:false}).toBuffer():await pipe.flatten({background:"#ffffff"}).jpeg({quality:95,chromaSubsampling:"4:4:4"}).toBuffer();
 const out=await sharp(buffer).metadata();if(out.width!==outputWidth||out.height!==outputHeight||out.format!==format)throw new Error("Rendered output failed post-render validation.");
 return {buffer,width:outputWidth,height:outputHeight,format,warnings,errors:[]};
}
