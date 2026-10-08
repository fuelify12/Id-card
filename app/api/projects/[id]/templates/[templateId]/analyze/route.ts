import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { templateAnalysisSchema, normalizeAnalysis } from "@/lib/ai/template-schema";

const MODEL=process.env.GEMINI_TEMPLATE_MODEL||"gemini-3.8-flash";
const PROMPT=`Analyze this school ID-card template image. You are an assistant only. Detect visible text and likely variable fields, including school name, student name, class, section, roll number, admission number, DOB, parent information, address, academic session, photo placeholder, and other data regions. Return ONLY JSON matching the supplied schema. Coordinates must be [ymin,xmin,ymax,xmax] normalized 0-1000. Never invent a field when there is no visual evidence. A photo region should be fieldType photo and confidence should reflect visual certainty. Confidence is your uncertainty estimate, not authority. Keep static decorative text in detectedText and do not turn it into a variable field unless evidence suggests it is data-driven.`;
const responseSchema={type:"object",properties:{width:{type:"integer"},height:{type:"integer"},detectedText:{type:"array",items:{type:"object",properties:{text:{type:"string"},box:{type:"array",items:{type:"number"},minItems:4,maxItems:4}},required:["text","box"]}},fields:{type:"array",items:{type:"object",properties:{label:{type:"string"},key:{type:"string"},fieldType:{type:"string",enum:["text","photo","school_name","student_name","class","section","roll_number","admission_number","dob","parent","address","session","other"]},confidence:{type:"number"},box:{type:"array",items:{type:"number"},minItems:4,maxItems:4},detectedText:{type:"string"},required:{type:"boolean"},suggestedSourceColumn:{type:"string"},alignment:{type:"string",enum:["left","center","right"]},fontFamily:{type:"string"},fontSizeRatio:{type:"number"},color:{type:"string"},fitMode:{type:"string",enum:["cover","contain","fill"]}},required:["label","key","fieldType","confidence","box","required","alignment","fontFamily","fontSizeRatio","color","fitMode"]}},notes:{type:"array",items:{type:"string"}}},required:["width","height","detectedText","fields","notes"]};

export async function POST(req:Request,{params}:{params:Promise<{id:string;templateId:string}>}){
 const {id,templateId}=await params; const s=await createClient(); const {data:claims}=await s.auth.getClaims(); const uid=claims?.claims?.sub;
 if(!uid)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!process.env.GEMINI_API_KEY)return NextResponse.json({error:"GEMINI_API_KEY is not configured on the server."},{status:503});
 const {data:t,error}=await s.from("templates").select("id,project_id,owner_id,source_path,source_type,width_px,height_px").eq("id",templateId).eq("project_id",id).maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500}); if(!t)return NextResponse.json({error:"Template not found."},{status:404});
 const {data:file,error:fe}=await s.storage.from("printforge-templates").download(t.source_path); if(fe)return NextResponse.json({error:fe.message},{status:500});
 const bytes=Buffer.from(await file.arrayBuffer()); if(bytes.length>20*1024*1024)return NextResponse.json({error:"Template is too large for analysis."},{status:413});
 const mime=t.source_type==="image/png"?"image/png":"image/jpeg";
 const body={model:MODEL,input:[{type:"text",text:PROMPT},{type:"image",data:bytes.toString("base64"),mime_type:mime}],response_format:{type:"text",mime_type:"application/json",schema:responseSchema}};
 const gr=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 if(!gr.ok)return NextResponse.json({error:"Gemini analysis failed.",details:await gr.text()},{status:502});
 const gj=await gr.json(); const text=gj.output_text??gj.output?.text; if(typeof text!=="string")return NextResponse.json({error:"Gemini returned no structured output."},{status:502});
 let raw:unknown; try{raw=JSON.parse(text)}catch{return NextResponse.json({error:"Gemini returned invalid JSON."},{status:502})}
 const parsed=templateAnalysisSchema.safeParse(raw); if(!parsed.success)return NextResponse.json({error:"Gemini output failed schema validation.",issues:parsed.error.issues},{status:502});
 const normalized=normalizeAnalysis(parsed.data);
 const {error:del}=await s.from("template_fields").delete().eq("template_id",templateId); if(del)return NextResponse.json({error:del.message},{status:500});
 const rows=normalized.fields.map(f=>({...f,template_id:templateId,owner_id:uid}));
 if(rows.length){const {error:ie}=await s.from("template_fields").insert(rows);if(ie)return NextResponse.json({error:ie.message},{status:500})}
 const analysis={engine:"gemini",model:MODEL,version:1,analyzed_at:new Date().toISOString(),raw:parsed.data,normalized_count:normalized.fields.length};
 const {error:ue}=await s.from("templates").update({analysis_status:"ready",analysis,updated_at:new Date().toISOString()}).eq("id",templateId).eq("project_id",id);
 if(ue)return NextResponse.json({error:ue.message},{status:500});
 return NextResponse.json({analysis:parsed.data,fields:normalized.fields});
}