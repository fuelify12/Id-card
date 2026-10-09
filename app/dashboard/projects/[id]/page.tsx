import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {ProjectSettingsForm} from "@/components/projects/project-settings-form";
import {TemplateWorkspace} from "@/components/projects/template-workspace";
import {TemplateAnalysisEditor} from "@/components/projects/template-analysis-editor";
import {StudentImportWorkspace} from "@/components/projects/student-import-workspace";
import {StudentPhotoWorkspace} from "@/components/projects/student-photo-workspace";
import {PhotoProcessingSettings} from "@/components/projects/photo-processing-settings";
import {PhotoCropReviewWorkspace} from "@/components/projects/photo-crop-review-workspace";
import {CardRenderingWorkspace} from "@/components/projects/card-rendering-workspace";

export default async function ProjectPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const s=await createClient();const {data:claims}=await s.auth.getClaims();const uid=claims?.claims?.sub;
 if(!uid)notFound();
 const {data:project,error}=await s.from("school_projects").select("id,name,school_name,school_address,academic_session,status,created_at,photo_serial_prefix,photo_processing_settings").eq("id",id).eq("owner_id",uid).maybeSingle();
 if(error)throw new Error(error.message);if(!project)notFound();
 const {data:templates,error:te}=await s.from("templates").select("id,name,source_path,source_type,width_px,height_px,analysis_status,version_number,is_active,created_at").eq("project_id",id).eq("owner_id",uid).order("version_number",{ascending:false});
 if(te)throw new Error(te.message);
 const active=templates?.find(t=>t.is_active)??templates?.[0];let fields:any[]=[];
 if(active){const {data,error:fe}=await (s as any).from("template_fields").select("id,key,label,field_type,required,x,y,width,height,font_family,font_size,font_weight,color,alignment,fit_mode,source_column,confidence,static_value,max_lines,overflow_policy,auto_shrink,min_font_size,line_height,vertical_alignment,rotation,visible,field_format").eq("template_id",active.id).eq("owner_id",uid).order("sort_order");if(fe)throw new Error(fe.message);fields=data??[]}
 const {data:studentRows,error:studentsError}=await s.from("students").select("id,serial_number,data").eq("project_id",id).eq("owner_id",uid).order("serial_number").limit(1000);
 if(studentsError)throw new Error(studentsError.message);
 const sampleStudents=(studentRows??[]).map(st=>({id:st.id,serial_number:st.serial_number,data:(st.data??{}) as Record<string,unknown>}));
 return <section>
  <Link href="/dashboard" className="text-sm text-blue-300">← All projects</Link>
  <div className="mt-4 flex flex-col gap-2"><p className="text-sm text-blue-300">SCHOOL PROJECT</p><h1 className="text-3xl font-bold">{project.name}</h1><p className="pf-muted">{project.school_name} · {project.academic_session||"Session not set"} · {project.status}</p></div>
  <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]"><ProjectSettingsForm project={project}/><TemplateWorkspace projectId={project.id} templates={templates??[]}/></div>
  {active&&<div className="mt-5"><TemplateAnalysisEditor projectId={project.id} templateId={active.id} width={active.width_px??600} height={active.height_px??900} sourcePath={active.source_path??""} fields={fields}/></div>}
  <StudentImportWorkspace projectId={project.id} templateId={active?.id??null} fields={fields}/>
  <StudentPhotoWorkspace projectId={project.id} initialPrefix={project.photo_serial_prefix}/>
  <PhotoProcessingSettings projectId={project.id} initial={{target_width_px:600,target_height_px:800,dpi:300,top_padding_ratio:.1,face_vertical_position:.38,min_source_width_px:600,min_source_height_px:800,output_format:"jpeg",output_quality:92,background_policy:"preserve",confirmed_by_user:false,...((project.photo_processing_settings??{}) as any)}}/>
  <PhotoCropReviewWorkspace projectId={project.id} settings={{target_width_px:((project.photo_processing_settings as any)?.target_width_px??600),target_height_px:((project.photo_processing_settings as any)?.target_height_px??800)}}/>
  <CardRenderingWorkspace projectId={project.id} template={active?{id:active.id,name:active.name,version_number:active.version_number,width_px:active.width_px,height_px:active.height_px}:null} fields={fields} students={sampleStudents}/>
  <div className="pf-panel mt-5 p-5"><h3 className="font-bold">Template format support</h3><p className="pf-muted mt-2 text-sm">This renderer preserves the uploaded PNG/JPEG artwork as its background. PDF and SVG template uploads remain unsupported by the existing uploader and are not silently rasterized or redrawn.</p></div>
 </section>
}
