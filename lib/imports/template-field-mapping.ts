export type Field={id:string;key:string;label:string;field_type:string;required:boolean;x:number;y:number;width:number;height:number;font_family:string|null;font_size:number|null;font_weight:string|null;color:string|null;alignment:string|null;fit_mode:string|null;source_column:string|null;confidence:number|null;render_options?:Record<string,unknown>|null};

function normalizeMappingName(value:string){return value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/['’`]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ")}
function fieldAliases(field:Field):string[]{
 const identity=normalizeMappingName([field.key,field.label].join(" "));
 const aliases:Record<string,string[]>={
  student_name:["student name","name","student full name","name of student","विद्यार्थी का नाम","छात्र का नाम","विद्यार्थी का पूरा नाम"],
  student_photo:["student photo","photo","photo filename","photo file name","student photo filename","student image","image filename","picture filename","विद्यार्थी का फोटो"],
  father_name:["father name","fathers name","father's name","father","father name of student","पिता का नाम","पिता का नाम"],
  mother_name:["mother name","mothers name","mother's name","mother","माता का नाम"],
  guardian_name:["guardian name","guardian","अभिभावक का नाम"],
  class:["class","class name","grade","कक्षा"],
  section:["section","सेक्शन","वर्ग"],
  class_sec:["class & sec","class sec","class & section","class section","class and section","class-section","grade and section","कक्षा एवं सेक्शन","कक्षा और सेक्शन"],
  class_section:["class & sec","class sec","class & section","class section","class and section","class-section","grade and section","कक्षा एवं सेक्शन","कक्षा और सेक्शन"],
  roll_number:["roll no","roll number","rollno","रोल नंबर","अनुक्रमांक"],
  admission_number:["admission no","admission number","admissionno","admission id","enrollment no","enrollment number","प्रवेश संख्या","प्रवेशांक"],
  admission_no:["admission no","admission number","admissionno","admission id","enrollment no","enrollment number","प्रवेश संख्या","प्रवेशांक"],
  admissionno:["admission no","admission number","admissionno","admission id","enrollment no","enrollment number","प्रवेश संख्या","प्रवेशांक"],
  date_of_birth:["date of birth","dob","birth date","date of birth (dob)","जन्म तिथि","जन्मतिथि"],
  dob:["date of birth","dob","birth date","जन्म तिथि","जन्मतिथि"],
  address:["address","पता"],
  address_line_1:["address line 1","address line one","address 1","address1","पहला पता","पता पंक्ति 1"],
  address_line_2:["address line 2","address line two","address 2","address2","second address line","दूसरा पता","पता पंक्ति 2"],
  blood_group:["blood group","blood type","रक्त समूह"],
  phone:["phone","mobile","mobile number","contact number","मोबाइल नंबर","फोन नंबर"],
  session:["session","academic session","school session","academic year","session year","शैक्षिक सत्र","शैक्षणिक सत्र"],
  session_start:["session start","start session","session from","from year","start year","academic year start","academic session start","session year start","सत्र प्रारंभ"],
  session_end:["session end","end session","session to","to year","end year","academic year end","academic session end","session year end","सत्र समाप्ति"],
  session_year_start:["session start","start session","session from","from year","start year","academic year start","सत्र प्रारंभ"],
  session_year_end:["session end","end session","session to","to year","end year","academic year end","सत्र समाप्ति"],
  academic_session_start:["session start","start session","session from","from year","start year","academic year start","सत्र प्रारंभ"],
  academic_session_end:["session end","end session","session to","to year","end year","academic year end","सत्र समाप्ति"],
  academic_session:["session","academic session","school session","academic year","session year","शैक्षिक सत्र","शैक्षणिक सत्र"],
  school_session:["session","academic session","school session","academic year","session year","शैक्षिक सत्र","शैक्षणिक सत्र"],
  gender:["gender","sex","लिंग"],
  student_id:["student id","student code","विद्यार्थी आईडी"],
  serial_number:["serial number","serial no","s no","sno","क्रमांक","अनुक्रमांक"]
 };
 const key=normalizeMappingName(field.key).replace(/ /g,"_");
 const labelKey=normalizeMappingName(field.label).replace(/ /g,"_");
 const aliasKey=Object.keys(aliases).find(k=>aliases[k].some(a=>normalizeMappingName(a)===labelKey));
 return [...new Set([field.source_column??"",field.key,field.label,...(aliases[key]??[]),...(aliases[labelKey.replace(/ /g,"_")]??[]),...(aliases[labelKey]??[]),...(aliasKey?aliases[aliasKey]:[]),...(aliases[identity.replace(/ /g,"_")]??[])].map(normalizeMappingName).filter(Boolean))];
}
export function autoMapFields(fields:Field[],headers:string[]):Field[]{
 const normalized=headers.map(raw=>({raw,n:normalizeMappingName(raw)}));
 const used=new Set<string>();
 const startNames=["session start","start session","session from","from year","start year","academic year start","academic session start","session year start","session start year","academic session from","session year from"];
 const endNames=["session end","end session","session to","to year","end year","academic year end","academic session end","session year end","session end year","academic session to","session year to"];
 const sessionStart=normalized.find(h=>startNames.includes(h.n));
 const sessionEnd=normalized.find(h=>endNames.includes(h.n));
 const combinedSession=normalized.find(h=>["session","academic session","school session","academic year","session year","session period","academic year period","शैक्षिक सत्र","शैक्षणिक सत्र"].includes(h.n));
 const combinedClass=normalized.find(h=>["class & sec","class sec","class & section","class section","class and section","class-section","grade and section","कक्षा एवं सेक्शन","कक्षा और सेक्शन"].includes(h.n));
 const classColumn=normalized.find(h=>["class","class name","grade","कक्षा"].includes(h.n));
 const sectionColumn=normalized.find(h=>["section","sec","सेक्शन","वर्ग"].includes(h.n));
 const addressColumn=normalized.find(h=>["address","full address","complete address","residential address","पता"].includes(h.n));
 const address1Column=normalized.find(h=>["address line 1","address line one","address 1","address1","पहला पता","पता पंक्ति 1"].includes(h.n));
 const address2Column=normalized.find(h=>["address line 2","address line two","address 2","address2","second address line","दूसरा पता","पता पंक्ति 2"].includes(h.n));
 const sessionFields=fields.filter(f=>normalizeMappingName(f.label)==="session").slice().sort((a,b)=>a.x-b.x);
 const sessionIndex=new Map(sessionFields.map((f,i)=>[f.id,i]));
 const keyNameRole=(value:string)=>{const tokens=value.split(" ");if(tokens.some(t=>t==="father"||t==="fathers"))return "father";if(tokens.some(t=>t==="mother"||t==="mothers"))return "mother";if(tokens.includes("guardian"))return "guardian";if(tokens.includes("parent"))return "parent";if(tokens.includes("student"))return "student";return null;};
 const fieldNameRole=(field:Field)=>keyNameRole(normalizeMappingName(field.key+" "+field.label));
 const tokenScore=(alias:string,header:string)=>{
  if(alias===header)return 1;
  const roleTokens=["student","father","father s","mother","guardian","parent"];
  const aliasRoles=roleTokens.filter(t=>alias.split(" ").includes(t));
  const headerRoles=roleTokens.filter(t=>header.split(" ").includes(t));
  if(aliasRoles.length&&headerRoles.length&& !aliasRoles.some(t=>headerRoles.includes(t)))return 0;
  if((keyNameRole(alias)!==keyNameRole(header))&&(keyNameRole(alias)||keyNameRole(header)))return 0;
  const a=alias.split(" ").filter(Boolean),h=header.split(" ").filter(Boolean);
  if(a.length>=2&&a.every(t=>h.includes(t)))return .9;
  if(h.length>=2&&h.every(t=>a.includes(t)))return .86;
  const intersection=a.filter(t=>h.includes(t)).length;
  return intersection/Math.max(a.length,h.length);
 };
 return fields.map(field=>{
  const key=normalizeMappingName(field.key).replace(/ /g,"_");
  const label=normalizeMappingName(field.label);
  let chosen:null|{raw:string;n:string}=null;
  let valueTransform:string|undefined;
  let valueTransformSecondaryColumn:string|undefined;
  const addressLine1=key.includes("line_1")||key.includes("address_1")||label==="address line 1"||label==="address line one";
  const addressLine2=key.includes("line_2")||key.includes("address_2")||label==="address line 2"||label==="address line two";
  if((key==="class_sec"||key==="class_section"||label==="class sec"||label==="class and sec")&&!combinedClass&&classColumn&&sectionColumn){chosen=classColumn;valueTransform="class_section";valueTransformSecondaryColumn=sectionColumn.raw;}
  else if(key.includes("address")&&addressLine1&&!address1Column&&addressColumn){chosen=addressColumn;valueTransform="address_line_1";}
  else if(key.includes("address")&&addressLine2&&!address2Column&&addressColumn){chosen=addressColumn;valueTransform="address_line_2";}
  else if(label==="session"&&(key.includes("start")||key.includes("from"))){if(sessionStart)chosen=sessionStart;else if(combinedSession){chosen=combinedSession;valueTransform="session_start";}}
  else if(label==="session"&&(key.includes("end")||key.includes("to"))){if(sessionEnd)chosen=sessionEnd;else if(combinedSession){chosen=combinedSession;valueTransform="session_end";}}
  else if(label==="session"&&sessionFields.length>=2){
   const idx=sessionIndex.get(field.id);
   if(idx===0&&sessionStart)chosen=sessionStart;
   else if(idx===sessionFields.length-1&&sessionEnd)chosen=sessionEnd;
   else if(!sessionStart&&!sessionEnd&&combinedSession){chosen=combinedSession;valueTransform=idx===0?"session_start":idx===sessionFields.length-1?"session_end":undefined;}
  }
  if(!chosen){
   const aliases=[...new Set(fieldAliases(field))];
   const exact=normalized.filter(h=>aliases.includes(h.n));
   const availableExact=exact.filter(h=>!used.has(h.n));
   if(exact.length===1&&availableExact.length===1)chosen=availableExact[0];
   else if(exact.length===0){
    const role=fieldNameRole(field); const candidates=normalized.filter(h=>!used.has(h.n)&&(!role||!keyNameRole(h.n)||role===keyNameRole(h.n))).map(h=>({h,score:Math.max(0,...aliases.map(a=>tokenScore(a,h.n)))})).filter(x=>x.score>=.8).sort((a,b)=>b.score-a.score);
    if(candidates.length&&(!candidates[1]||candidates[0].score-candidates[1].score>=.12))chosen=candidates[0].h;
   }
  }
  if(chosen&&!(valueTransform&&["session_start","session_end","address_line_1","address_line_2","class_section"].includes(valueTransform)))used.add(chosen.n);
  return {...field,source_column:chosen?.raw??null,render_options:valueTransform?{...(field.render_options??{}),valueTransform,...(valueTransformSecondaryColumn?{valueTransformSecondaryColumn}:{})}:field.render_options??null};
 });
}
