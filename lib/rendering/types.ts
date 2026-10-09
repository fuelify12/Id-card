export type OutputFormat = "png" | "jpeg" | "pdf";
export type RenderField = { id:string; key:string; label:string; field_type:string; required:boolean; x:number; y:number; width:number; height:number; font_family:string|null; font_size:number|null; font_weight:string|null; color:string|null; alignment:string|null; fit_mode:string|null; source_column:string|null; render_options?:Record<string,unknown>|null };
export type RenderStudent = { id:string; serial_number:number; data:Record<string,unknown>|null };
export type RenderOptions = { widthMm:number; heightMm:number; dpi:number; format:OutputFormat; side?:"front"|"back"; jpegQuality?:number; rendererVersion?:string };
export type RenderIssue = { code:string; message:string; fieldId?:string; severity:"warning"|"error" };
export type RenderResult = { bytes:Buffer; mimeType:string; widthPx:number; heightPx:number; widthMm:number; heightMm:number; dpi:number; inputHash:string; outputHash:string; warnings:RenderIssue[]; errors:RenderIssue[]; rendererVersion:string };
