# Phase 10 — Validation and quality control

Adds deterministic, versioned checks and a project-scoped findings dashboard. Original imported values are preserved; suspicious values are reported rather than silently repaired.

Checks include missing names/serials/required fields, duplicate serial/admission keys, formula-like content, control characters, whitespace, oversized values, template source/version/dimensions, missing mappings, field bounds/overlaps, photo project/student/approval/crop state, multiple approved photos, missing/corrupt/hash-mismatched outputs, stale template/photo versions, renderer warnings/errors, and server-side human approval gates.

API: GET /api/projects/:id/validation; POST {action:"validate"}; POST {action:"resolve",findingId,note}; POST {action:"approve",cardId}. Critical findings cannot be waived or directly resolved. Approval rejects open critical/error/warning findings. Findings are keyed by project, target, rule and input fingerprint to avoid duplicates for unchanged conditions.

Apply supabase/phase10_validation.sql before enabling the dashboard. Storage stays private and preview URLs are short-lived. No facial recognition is used to identify children. Automated checks cannot prove photo-to-person identity; visual review remains required. School-specific required fields and warning policy need deliberate configuration.


Template-field edits now increment the template version, and processing a new photo derivative increments its image version. These changes make stale renders detectable without changing original student values.


Project owners can configure required fields, admission-number uniqueness, minimum photo dimensions, and whether open warnings may be approved. Critical findings and errors always block approval. Warning exceptions default to off and are audited.
