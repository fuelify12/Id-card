import { z } from "zod";

export const aiFieldSchema = z.object({
  label: z.string().min(1).max(80),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60),
  fieldType: z.enum(["text","photo","school_name","student_name","class","section","roll_number","admission_number","dob","parent","address","session","other"]),
  confidence: z.number().min(0).max(1),
  box: z.tuple([z.number().min(0).max(1000),z.number().min(0).max(1000),z.number().min(0).max(1000),z.number().min(0).max(1000)]),
  detectedText: z.string().max(300).optional().default(""),
  required: z.boolean().default(false),
  suggestedSourceColumn: z.string().max(80).optional().default(""),
  alignment: z.enum(["left","center","right"]).default("left"),
  fontFamily: z.string().max(80).default("Arial"),
  fontSizeRatio: z.number().min(0.005).max(0.25).default(0.04),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"),
  fitMode: z.enum(["cover","contain","fill"]).default("cover")
});
export const templateAnalysisSchema=z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  detectedText: z.array(z.object({text:z.string().max(300),box:z.tuple([z.number(),z.number(),z.number(),z.number()])})).max(200),
  fields: z.array(aiFieldSchema).max(100),
  notes: z.array(z.string().max(300)).max(30)
});
export type TemplateAnalysis=z.infer<typeof templateAnalysisSchema>;

export function refineValueBoxes(raw:TemplateAnalysis):TemplateAnalysis{
 const norm=(s:string)=>s.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/['’`]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
 const detected=raw.detectedText.map(item=>({...item,box:item.box.map(v=>Math.max(0,Math.min(1000,v))) as [number,number,number,number]}));
 const fields=raw.fields.map(field=>{
  const label=norm(field.label),key=norm(field.key.replace(/_/g," "));
  const candidates=detected.filter(item=>{const text=norm(item.text.replace(/[:：]/g," "));return text===label||text===key||(label.length>=5&&text.replace(/\b(the|field)\b/g," ").trim()===label)});
  if(!candidates.length)return field;
  let box=[...field.box] as [number,number,number,number];
  for(const item of candidates){
   const [ly1,lx1,ly2,lx2]=item.box,[fy1,fx1,fy2,fx2]=box;
   const overlapY=Math.max(0,Math.min(ly2,fy2)-Math.max(ly1,fy1));
   const minHeight=Math.max(1,Math.min(ly2-ly1,fy2-fy1));
   const overlapX=Math.max(0,Math.min(lx2,fx2)-Math.max(lx1,fx1));
   if(overlapY/minHeight>=0.25&&overlapX>0&&fx1<lx2&&fx2>lx2+12){
    box=[fy1,Math.min(fx2-1,lx2+8),fy2,fx2];
    break;
   }
  }
  return {...field,box};
 });
 return {...raw,detectedText:detected,fields};
}

export function normalizeAnalysis(raw:TemplateAnalysis){
  const clamp=(value:number)=>Math.max(0,Math.min(1000,value));
  const fields=raw.fields.map((f,i)=>{
    const [rawY1,rawX1,rawY2,rawX2]=f.box;
    const x1=Math.min(clamp(rawX1),clamp(rawX2)),x2=Math.max(clamp(rawX1),clamp(rawX2));
    const y1=Math.min(clamp(rawY1),clamp(rawY2)),y2=Math.max(clamp(rawY1),clamp(rawY2));
    const x=Math.round(x1/1000*raw.width),y=Math.round(y1/1000*raw.height);
    const right=Math.round(x2/1000*raw.width),bottom=Math.round(y2/1000*raw.height);
    return {
      key:f.key,label:f.label,field_type:f.fieldType==="photo"?"photo":"text",required:f.required,render_options:{ai_field_type:f.fieldType},
      x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y),
      font_family:f.fontFamily,font_size:Math.max(8,Math.round(f.fontSizeRatio*raw.width)),
      font_weight:"400",color:f.color,alignment:f.alignment,fit_mode:f.fitMode,
      source_column:f.suggestedSourceColumn||null,confidence:f.confidence,sort_order:i
    };
  }).filter(f=>f.width>0&&f.height>0&&f.x<raw.width&&f.y<raw.height);
  return {fields};
}