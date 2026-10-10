import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { validateStudents, validateTemplateConfiguration } from "@/lib/validation/engine";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { reconcileBatchItemStatuses, retryDelayMs } from "@/lib/batch/recovery";

export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (error: string, status = 400) => NextResponse.json({ error }, { status });
const TERMINAL = new Set(["completed", "completed_with_errors", "failed", "cancelled"]);
const MAX_BATCH = 500;
const WORKER_CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.ID_CARD_BATCH_CONCURRENCY ?? 3) || 3));

async function authProject(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) return { error: "Unauthorized", status: 401 as const };
  const db = supabase as any;
  const { data: project, error } = await db.from("school_projects").select("id,owner_id,school_name,name,validation_settings").eq("id", projectId).eq("owner_id", uid).maybeSingle();
  if (error) return { error: "Could not verify project access.", status: 500 as const };
  if (!project) return { error: "Project not found or access denied.", status: 404 as const };
  return { db, uid, project };
}
async function refreshCounts(db: any, batchId: string, projectId: string) {
  const [{ data: items, error }, { data: currentBatch, error: batchError }] = await Promise.all([
    db.from("batch_generation_items").select("status").eq("batch_id", batchId).eq("project_id", projectId),
    db.from("batches").select("status,eligible_count,started_at,completed_at").eq("id", batchId).eq("project_id", projectId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (batchError) throw new Error(batchError.message);
  if (!currentBatch) throw new Error("Batch no longer exists.");

  const counts = reconcileBatchItemStatuses(
    (items ?? []).map((item: { status: string }) => item.status),
    currentBatch.status,
  );
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { ...counts, heartbeat_at: now };
  if (TERMINAL.has(String(counts.status).toLowerCase()) && !currentBatch.completed_at) update.completed_at = now;
  if (!TERMINAL.has(String(counts.status).toLowerCase())) update.completed_at = null;

  // Compare-and-set prevents a stale status read from undoing a concurrent pause/cancel.
  const { data: updated, error: updateError } = await db
    .from("batches")
    .update(update)
    .eq("id", batchId)
    .eq("project_id", projectId)
    .eq("status", currentBatch.status)
    .select("status")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (updated?.status) return { ...counts, status: updated.status };

  const { data: latest, error: latestError } = await db
    .from("batches")
    .select("status")
    .eq("id", batchId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  return { ...counts, status: latest?.status ?? counts.status };
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  if (typeof projectId !== "string" || !/^[0-9a-f-]{36}$/i.test(projectId)) return reply("Invalid project ID.");
  const auth = await authProject(projectId);
  if ("error" in auth) return reply(String(auth.error ?? "Project access denied."), Number(auth.status ?? 500));
  const { db, uid, project } = auth;
  let body: any;
  try { body = await request.json(); } catch { return reply("Request body must be valid JSON."); }
  const action = String(body?.action ?? "");
  if (!["preflight", "create", "latest", "status", "pause", "resume", "cancel", "retry", "process"].includes(action)) return reply("Unsupported batch action.");
  if (action === "create" || action === "retry") {
    const decision = await consumeRateLimit(db, "batch_generate", 5, 60);
    if (!decision.allowed) {
      return reply(
        decision.unavailable ? "Batch processing is temporarily unavailable. Try again shortly." : "Too many batch requests. Wait before retrying.",
        decision.unavailable ? 503 : 429,
      );
    }
  }

  try {
    if (action === "preflight" || action === "create") {
      const { data: templates, error: templateError } = await db.from("templates").select("id,name,version_number,is_active,render_config,width_px,height_px,source_type").eq("project_id", projectId).eq("is_active", true).limit(1);
      if (templateError) throw new Error(templateError.message);
      const template = templates?.[0];
      if (!template) return NextResponse.json({ ok: false, configIssues: ["Upload and activate an ID card template first."], totalStudents: 0, eligible: 0, blocked: 0 }, { status: 422 });
      const { data: fields, error: fieldError } = await db.from("template_fields").select("id,key,label,field_type,required,source_column,static_value,visible,x,y,width,height,font_size,color,render_options").eq("template_id", template.id).order("sort_order");
      if (fieldError) throw new Error(fieldError.message);
      const students: any[] = [];
      for (let from = 0; from < 15000; from += 1000) {
        const { data, error } = await db.from("students").select("id,serial_number,data").eq("project_id", projectId).eq("owner_id", uid).order("serial_number").range(from, from + 999);
        if (error) throw new Error(error.message);
        students.push(...(data ?? [])); if ((data ?? []).length < 1000) break;
      }
      if (students.length > MAX_BATCH) return reply("A batch is limited to 500 students. Split this project into smaller batches.", 413);
      const { data: photos, error: photoError } = await db.from("student_photos").select("student_id").eq("project_id", projectId).eq("owner_id", uid).eq("match_status", "APPROVED").eq("processing_status", "APPROVED").not("processed_storage_path", "is", null).not("crop_approved_at", "is", null);
      if (photoError) throw new Error(photoError.message);
      const approvedPhotos = new Set((photos ?? []).map((p: any) => p.student_id));
      const needsPhoto = (fields ?? []).some((f: any) => f.required && (["photo","image","student_photo","student-photo"].includes(String(f.field_type).toLowerCase()) || f.key === "student_photo"));
      const config = template.render_config ?? {};
      const configIssues: string[] = [];
      const templateFindings = validateTemplateConfiguration(template, fields ?? []);
      configIssues.push(...templateFindings.filter(f => f.severity === "CRITICAL" || f.severity === "ERROR").map(f => f.message));
      const settings = project.validation_settings ?? {};
      const mappedRequired = (fields ?? []).filter((f: any) => f.required && !["photo","image","student_photo","student-photo"].includes(String(f.field_type).toLowerCase()) && String(f.source_column ?? "").trim()).map((f: any) => String(f.source_column));
      const configuredRequired = Array.isArray(settings.required_fields) ? settings.required_fields.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : [];
      const studentFindings = validateStudents(students, Array.from(new Set([...configuredRequired, ...mappedRequired])), { admissionNumberUnique: settings.admission_number_unique !== false });
      if (!(Number(config.widthMm) > 0 && Number(config.heightMm) > 0)) configIssues.push("Save card width and height in the rendering settings.");
      if (!(Number.isInteger(Number(config.dpi)) && Number(config.dpi) >= 72 && Number(config.dpi) <= 1200)) configIssues.push("Save a valid output DPI.");
      const rows = students.map((student: any) => {
        const data = student.data && typeof student.data === "object" ? student.data : {};
        const missing = (fields ?? []).filter((f: any) => f.required && !(String(data[f.source_column || f.key] ?? "").trim()) && !(["photo","image","student_photo","student-photo"].includes(String(f.field_type).toLowerCase()) || f.key === "student_photo")).map((f: any) => f.label || f.key);
        const photoMissing = needsPhoto && !approvedPhotos.has(student.id);
        const identityIssues = studentFindings.filter(f => f.studentId === student.id && (f.severity === "CRITICAL" || f.severity === "ERROR"));
        return { studentId: student.id, serialNumber: student.serial_number, studentName: String(data.name ?? data.student_name ?? data.full_name ?? ""), eligible: !missing.length && !photoMissing && !identityIssues.length && !configIssues.length, missingFields: missing, photoMissing, identityIssues: identityIssues.map(f => f.message) };
      });
      const report = { ok: configIssues.length === 0, configWarnings: templateFindings.filter(f => f.severity === "WARNING" || f.severity === "INFO").map(f => f.message), project: { id: project.id, name: project.name }, template: { id: template.id, name: template.name, version: template.version_number, format: config.format ?? "png", widthMm: config.widthMm, heightMm: config.heightMm, dpi: config.dpi }, configIssues, totalStudents: rows.length, eligible: rows.filter(r => r.eligible).length, blocked: rows.filter(r => !r.eligible).length, students: rows.map(r => ({ ...r, reason: [...r.missingFields, ...(r.photoMissing ? ["Missing approved processed photo"] : []), ...(r.identityIssues ?? []), ...configIssues] })) };
      if (action === "preflight") return NextResponse.json(report);
      if (configIssues.length) return NextResponse.json({ error: "Resolve critical template/render configuration errors before starting production.", preflight: report }, { status: 422 });
      if (!report.eligible) return NextResponse.json({ error: "No eligible students are available for this batch.", preflight: report }, { status: 422 });
      const key = String(body.idempotencyKey ?? "").slice(0, 128) || randomUUID();
      const { data: prior } = await db.from("batches").select("id,status").eq("owner_id", uid).eq("idempotency_key", key).maybeSingle();
      if (prior) return NextResponse.json({ batchId: prior.id, status: prior.status, reusedRequest: true });
      const eligibleRows = rows.filter(r => r.eligible);
      const skippedRows = rows.filter(r => !r.eligible);
      const { data: batch, error: batchError } = await db.from("batches").insert({ project_id: projectId, owner_id: uid, requested_by: uid, name: "ID card batch " + new Date().toISOString(), status: "queued", total_count: rows.length, eligible_count: eligibleRows.length, skipped_count: skippedRows.length, template_id: template.id, template_version: template.version_number, idempotency_key: key, config_snapshot: { templateId: template.id, templateVersion: template.version_number, renderConfig: config } }).select("id,status").single();
      if (batchError) {
        if (batchError.code === "23505") { const { data: duplicate } = await db.from("batches").select("id,status").eq("owner_id", uid).eq("idempotency_key", key).single(); if (duplicate) return NextResponse.json({ batchId: duplicate.id, status: duplicate.status, reusedRequest: true }); }
        throw new Error(batchError.message);
      }
      const items = [...eligibleRows.map(r => ({ batch_id: batch.id, project_id: projectId, owner_id: uid, student_id: r.studentId, serial_number: r.serialNumber, student_name: r.studentName, status: "PENDING" })), ...skippedRows.map(r => ({ batch_id: batch.id, project_id: projectId, owner_id: uid, student_id: r.studentId, serial_number: r.serialNumber, student_name: r.studentName, status: "SKIPPED", error_category: "validation", error_summary: [...r.missingFields, ...(r.photoMissing ? ["Missing approved processed photo"] : [])].join(", ") || "Blocked by template configuration" }))];
      const { error: itemsError } = await db.from("batch_generation_items").insert(items);
      if (itemsError) { await db.from("batches").update({ status: "failed", last_error: "Could not persist batch work items." }).eq("id", batch.id); throw new Error("Batch was created but its work items could not be saved; inspect the batch before retrying."); }
      return NextResponse.json({ batchId: batch.id, status: batch.status, preflight: report }, { status: 201 });
    }

    if (action === "latest") {
      const { data: activeBatch, error: activeError } = await db.from("batches")
        .select("id,status,created_at")
        .eq("project_id", projectId).eq("owner_id", uid)
        .in("status", ["queued", "running", "paused", "pausing"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (activeError) throw new Error(activeError.message);
      if (activeBatch) return NextResponse.json({ batchId: activeBatch.id, status: activeBatch.status });
      const { data: latestBatch, error: latestError } = await db.from("batches")
        .select("id,status,created_at")
        .eq("project_id", projectId).eq("owner_id", uid)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw new Error(latestError.message);
      return NextResponse.json({ batchId: latestBatch?.id ?? null, status: latestBatch?.status ?? null });
    }

    const batchId = String(body.batchId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) return reply("A valid batch ID is required.");
    const { data: batch, error: batchError } = await db.from("batches").select("*").eq("id", batchId).eq("project_id", projectId).eq("owner_id", uid).maybeSingle();
    if (batchError) throw new Error(batchError.message);
    if (!batch) return reply("Batch not found or access denied.", 404);

    if (action === "status") {
      const [{ data: items, error: itemError }, counts] = await Promise.all([
        db.from("batch_generation_items").select("id,student_id,serial_number,student_name,status,attempts,error_category,error_summary,output_card_id,completed_at").eq("batch_id", batchId).eq("project_id", projectId).order("serial_number"),
        refreshCounts(db, batchId, projectId)
      ]);
      if (itemError) throw new Error(itemError.message);
      return NextResponse.json({ batch: { ...batch, ...counts }, items: items ?? [], progress: counts.total_count ? Math.round((counts.completed_count + counts.failed_count + counts.skipped_count + counts.review_count) / counts.total_count * 100) : 100, updatedAt: new Date().toISOString() });
    }
    if (action === "pause") {
      const current = String(batch.status).toLowerCase();
      if (current === "paused") return NextResponse.json({ ok: true, status: "paused", idempotent: true });
      if (!["queued", "running"].includes(current)) return reply("Only queued or running batches can be paused.", 409);
      const { data: changed, error } = await db.from("batches")
        .update({ status: "paused", paused_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
        .eq("id", batchId).eq("project_id", projectId).eq("owner_id", uid).eq("status", batch.status)
        .select("status").maybeSingle();
      if (error) throw new Error(error.message);
      if (!changed) return reply("Batch state changed concurrently; refresh its status before retrying.", 409);
      return NextResponse.json({ ok: true, status: changed.status });
    }
    if (action === "resume") {
      const current = String(batch.status).toLowerCase();
      if (current === "queued") return NextResponse.json({ ok: true, status: "queued", idempotent: true });
      if (current !== "paused") return reply("Only a paused batch can be resumed.", 409);
      const { data: changed, error } = await db.from("batches")
        .update({ status: "queued", paused_at: null, heartbeat_at: new Date().toISOString() })
        .eq("id", batchId).eq("project_id", projectId).eq("owner_id", uid).eq("status", batch.status)
        .select("status").maybeSingle();
      if (error) throw new Error(error.message);
      if (!changed) return reply("Batch state changed concurrently; refresh its status before retrying.", 409);
      return NextResponse.json({ ok: true, status: changed.status });
    }
    if (action === "cancel") {
      const current = String(batch.status).toLowerCase();
      if (current === "cancelled") return NextResponse.json({ ok: true, status: "cancelled", idempotent: true });
      if (TERMINAL.has(current)) return reply("A completed batch cannot be cancelled.", 409);
      const { data: changed, error } = await db.from("batches")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
        .eq("id", batchId).eq("project_id", projectId).eq("owner_id", uid).eq("status", batch.status)
        .select("status").maybeSingle();
      if (error) throw new Error(error.message);
      if (!changed) return reply("Batch state changed concurrently; refresh its status before retrying.", 409);
      // Already-claimed work may finish; no new claims are permitted after cancellation.
      const { error: skipError } = await db.from("batch_generation_items")
        .update({ status: "SKIPPED", error_summary: "Cancelled by user", completed_at: new Date().toISOString(), claimed_by: null, claimed_at: null })
        .eq("batch_id", batchId).eq("project_id", projectId).eq("owner_id", uid).eq("status", "PENDING");
      if (skipError) throw new Error(skipError.message);
      return NextResponse.json({ ok: true, status: "cancelled" });
    }
    if (action === "retry") {
      const current = String(batch.status).toLowerCase();
      if (!["failed", "completed_with_errors"].includes(current)) {
        return reply("Only failed batches or batches completed with errors can be retried.", 409);
      }
      let itemIds: string[] | null = null;
      if (Array.isArray(body.itemIds)) {
        itemIds = body.itemIds.filter((value: unknown): value is string =>
          typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
        ).slice(0, MAX_BATCH);
        if (body.itemIds.length && !(itemIds?.length)) return reply("No valid item IDs were supplied.", 400);
      }
      const { data: retried, error } = await db.rpc("retry_failed_batch_items", {
        p_batch_id: batchId,
        p_item_ids: itemIds,
      });
      if (error) {
        if (String(error.message).includes("no failed items")) return reply("There are no eligible failed items to retry.", 409);
        if (String(error.message).includes("not eligible")) return reply("Batch state changed; refresh before retrying.", 409);
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, status: "queued", retriedCount: Number(retried ?? 0) });
    }
    if (action === "process") {
      const current = String(batch.status).toLowerCase();
      if (!["queued", "running"].includes(current)) return reply("Batch is not claimable in its current state.", 409);
      const { data: started, error: startError } = await db.from("batches")
        .update({ status: "running", started_at: batch.started_at ?? new Date().toISOString(), heartbeat_at: new Date().toISOString() })
        .eq("id", batchId).eq("project_id", projectId).eq("owner_id", uid).eq("status", batch.status)
        .select("id,status").maybeSingle();
      if (startError) throw new Error(startError.message);
      if (!started) return reply("Batch state changed concurrently; no work was claimed.", 409);
      const { data: claimed, error: claimError } = await db.rpc("claim_batch_generation_items", { p_batch_id: batchId, p_worker_id: randomUUID(), p_limit: WORKER_CONCURRENCY });
      if (claimError) throw new Error(claimError.message);
      const cookie = request.headers.get("cookie") ?? "";
      await Promise.all((claimed ?? []).map(async (item: any) => {
        try {
          const renderResponse = await fetch(new URL("/api/projects/" + projectId + "/render", request.url), { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ action: "render", studentId: item.student_id, batchId, templateId: batch.template_id, templateVersion: batch.template_version }) });
          const result = await renderResponse.json().catch(() => ({}));
          if (!renderResponse.ok || !result.ok || !result.cardId || !result.previewUrl) {
            const permanent = renderResponse.status === 400 || renderResponse.status === 403 || renderResponse.status === 404 || renderResponse.status === 422;
            const retry = !permanent && Number(item.attempts) < Number(item.max_attempts);
            await db.from("batch_generation_items").update({ status: retry ? "PENDING" : permanent ? "NEEDS_REVIEW" : "FAILED", available_at: new Date(Date.now() + retryDelayMs(Number(item.attempts))).toISOString(), error_category: permanent ? "validation" : renderResponse.status === 413 ? "resource_limit" : "rendering", error_summary: String(result.error ?? "Card renderer returned an invalid result.").slice(0, 500), claimed_by: null, claimed_at: null, heartbeat_at: new Date().toISOString(), ...(retry ? {} : { completed_at: new Date().toISOString() }) }).eq("id", item.id).eq("status", "PROCESSING");
          } else {
            const { data: card } = await db.from("generated_cards").select("storage_path,render_input_hash,status,validation_status,output_sha256,output_width_px,output_height_px,template_id,template_version,photo_id,photo_version").eq("id", result.cardId).eq("project_id", projectId).eq("student_id", item.student_id).maybeSingle();
            if (!card?.storage_path || !card.render_input_hash || !card.output_sha256 || card.status !== "generated" || card.template_id !== batch.template_id || Number(card.template_version) !== Number(batch.template_version)) throw new Error("Renderer output record failed persisted-output validation.");
            if (card.validation_status === "failed") {
              await db.from("batch_generation_items").update({ status: "FAILED", output_card_id: result.cardId, output_storage_path: card.storage_path, input_fingerprint: card.render_input_hash, error_category: "validation", error_summary: "Critical or error-level validation findings block production.", completed_at: new Date().toISOString(), claimed_by: null, claimed_at: null, heartbeat_at: new Date().toISOString() }).eq("id", item.id).eq("status", "PROCESSING");
              return;
            }
            if (card.validation_status === "warning" || card.validation_status === "pending") {
              await db.from("batch_generation_items").update({ status: "NEEDS_REVIEW", output_card_id: result.cardId, output_storage_path: card.storage_path, input_fingerprint: card.render_input_hash, error_category: "validation", error_summary: "Rendered card has unresolved validation warnings or checks.", completed_at: new Date().toISOString(), claimed_by: null, claimed_at: null, heartbeat_at: new Date().toISOString() }).eq("id", item.id).eq("status", "PROCESSING");
              return;
            }
            await db.from("batch_generation_items").update({ status: "SUCCEEDED", output_card_id: result.cardId, output_storage_path: card.storage_path, input_fingerprint: card.render_input_hash, error_category: null, error_summary: null, completed_at: new Date().toISOString(), claimed_by: null, heartbeat_at: new Date().toISOString() }).eq("id", item.id).eq("status", "PROCESSING");
          }
        } catch (error) {
          await db.from("batch_generation_items").update({ status: Number(item.attempts) < Number(item.max_attempts) ? "PENDING" : "FAILED", error_category: "unknown", error_summary: String((error as Error).message ?? "Worker error").slice(0, 500), claimed_by: null, claimed_at: null, available_at: new Date(Date.now() + 2000).toISOString() }).eq("id", item.id).eq("status", "PROCESSING");
        }
      }));
      const counts = await refreshCounts(db, batchId, projectId);
      return NextResponse.json({ ok: true, claimed: (claimed ?? []).length, counts, status: counts.status });
    }
    return reply("Unsupported action.");
  } catch (error) {
    console.error("[id-card-batch]", { action, projectId, code: typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code.slice(0, 40) : "BATCH_OPERATION_FAILED" });
    return reply("Batch operation failed. Check the batch status and retry safely.", 500);
  }
}
