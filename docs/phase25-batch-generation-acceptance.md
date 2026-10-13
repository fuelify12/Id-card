# Phase 25 — batch generation integrity and Phases 1–25 regression

## Scope and evidence rules

This change extends the existing batch pipeline; it does not replace the application. The batch endpoint already persists per-student work items, claims work through the database function claim_batch_generation_items, uses bounded worker concurrency, records retry state, and reconciles final outcomes. Phase 25 adds a strict persisted-artifact gate before a work item can become SUCCEEDED.

A successful build or unit suite does not prove authenticated browser acceptance, live tenant isolation, database migration compatibility, 300-card throughput, physical print fidelity, or operational recovery. Those require their own evidence and are tracked below.

## Phase 25 implementation

- lib/batch/recovery.ts: validatePersistedBatchArtifact checks exact canonical identifier equality (so 001 cannot silently equal 1), student association, generated status, safe relative storage path, SHA-256 formats, nonzero dimensions, selected template/version, and consistency of optional photo ID/version snapshots.
- app/api/projects/[id]/batch/route.ts: before recording success, the worker reads the persisted card including student/identifier/photo/template/output metadata. An integrity mismatch becomes NEEDS_REVIEW with an actionable integrity reason; it is never counted as a successful card or exportable success. Database read failures remain retryable errors.
- tests/batch-artifact-integrity.test.ts: covers valid output, leading-zero mismatch, wrong student, wrong template version, invalid hashes/dimensions, unsafe paths, inconsistent photo snapshot, and missing output row.
- Existing recovery logic and retry backoff remain in place; this change does not weaken claims, authorization, RLS, or export approval requirements.

## Requirement-to-test traceability

| Requirement | Implementation location | Automated evidence | Latest evidence / limitation |
|---|---|---|---|
| Canonical identifiers preserve leading zeros and support configured text IDs | lib/identifiers/student-identifier.ts; import, photo, render, batch, export paths | tests/student-identifier.test.ts, tests/student-identifier-flow.test.ts, tests/student-identifier-validation.test.ts, tests/student-spreadsheet.test.ts, tests/photo-matching.test.ts | Phase 24 CI passed on SHA 8692d4f; live schema migration not applied |
| Legacy identifier review and migration safety | Three Phase 24 SQL migrations; schema assertions | tests/student-identifier-migration.test.ts; supabase/tests/phase24_student_identifier_schema.sql | Static contract test ran in Phase 24 CI; live DB assertion blocked by lack of isolated database |
| Project/template preflight and required fields | Batch API and lib/validation/engine.ts | Phase 14 and Phase 16 workflow/acceptance suites; Phase 25 CI full test command | Database-backed project workflow not exercised in isolated environment |
| Exact approved photo and crop preflight | app/api/projects/[id]/batch/route.ts; photo matching/crop modules | tests/photo-matching.test.ts, tests/phase14-workflow.integration.test.ts, tests/phase16-acceptance.test.ts | Synthetic tests only; physical Android capture remains unverified |
| Persisted card identity/template/output verification | lib/batch/recovery.ts; batch API | tests/batch-artifact-integrity.test.ts | PASS: Phase 25 CI run 38429090694 on final SHA 21fb77a; live DB-backed artifact verification remains blocked |
| Retry backoff and no false completion | lib/batch/recovery.ts; database claim function | tests/batch-recovery.test.ts; Phase 18 recovery migration | Unit tests cover status reconciliation; live concurrent worker test requires isolated DB |
| Bounded work claiming and idempotency | Batch API and claim_batch_generation_items | Phase 18 migration contract and batch recovery suite | No measured real 300-card batch run in isolated environment |
| Export eligibility and ZIP integrity | lib/exports/archive.ts, lib/exports/integrity.ts, export API | tests/phase14-workflow.integration.test.ts, tests/phase16-acceptance.test.ts, manifest/integrity tests present in repository | ZIP checks are synthetic; private signed-download path requires authenticated preview and isolated storage |
| Authentication and owner/project checks | Server actions and API route authorization; Supabase RLS/storage policies | Existing security/migration tests and CI secret hygiene | Live cross-tenant denial remains blocked; do not infer from unit tests |
| Template rendering, Unicode and image output | lib/rendering/engine.ts, font dependencies | Phase 14 and Phase 16 synthetic rendering suites | No physical print calibration or live app visual review |
| Mobile camera workflow | Student photo workspace and capture APIs | Browser/unit coverage where available | Physical Android permission/capture/retake/reload workflow not run |
| Build, types, lint, regression | package scripts and CI workflows | npm test, npm run typecheck, npm run lint, npm run build | PASS: Phase 25 CI run 38429090694; 17 test files and 109 tests passed; TypeScript and production build passed; lint 0 errors / 8 image-element warnings; client-bundle check passed. Production dependency audit gate passes its high-severity threshold but reports three moderate transitive sprintf-js findings. |
| Deployment, backup, rollback and operational alerts | Vercel deployment history, Supabase migration history, phase docs | CI and provider inspection | No Phase 25 preview tied to this commit is accepted until it exists and authenticated workflow is tested; production release not authorized |

## Phase-by-phase status ledger

This ledger distinguishes implementation history from current acceptance evidence. It does not assert that each phase has been re-executed in full during Phase 25.

| Phase | Area | Current status | Evidence / limitation |
|---|---|---|---|
| 1 | Foundation and schema | IMPLEMENTED HISTORICALLY; regression not fully reverified | Migration history includes phase1_foundation; full historical acceptance evidence is incomplete |
| 2 | Authentication, ownership, storage isolation | PARTIALLY VERIFIED | Existing security tests and migrations; live tenant acceptance remains blocked |
| 3 | Template upload and versioning | IMPLEMENTED HISTORICALLY; browser acceptance blocked | Template/render modules; no authenticated upload workflow in this run |
| 4 | Project/student workflows | IMPLEMENTED HISTORICALLY; end-to-end not verified | Server actions and student/project modules; database-backed workflow needs isolated test |
| 5 | Spreadsheet mapping/import | AUTOMATED TEST COVERAGE | tests/student-spreadsheet.test.ts; authenticated import remains unverified |
| 6 | Photo matching and storage | AUTOMATED TEST COVERAGE | Photo matching tests and Phase 6 migrations; physical device not tested |
| 7 | Photo processing/crop | PARTIALLY VERIFIED | Image validation/processing code and synthetic workflow; physical capture/crop acceptance blocked |
| 8 | Card rendering | AUTOMATED SYNTHETIC COVERAGE | Rendering engine and Phase 14/16 synthetic suites; physical print fidelity unverified |
| 9 | Batch generation | IMPLEMENTED; new integrity gate added | Batch API, persisted work items, bounded claims; live 300-card run not verified |
| 10 | Validation and stale-output invalidation | AUTOMATED / SCHEMA PARTIAL | Validation modules and tests; current Production migration history does not include Phase 24 migrations |
| 11 | ZIP export and integrity | AUTOMATED SYNTHETIC COVERAGE | Archive, manifest, and integrity modules; signed download acceptance blocked |
| 12 | Mobile workflow | PARTIALLY VERIFIED | Responsive UI exists; Android camera device test not performed |
| 13 | Security hardening | PARTIALLY VERIFIED | Security migrations and CI hygiene; live RLS/cross-tenant tests blocked |
| 14 | Workflow regression | AUTOMATED SYNTHETIC COVERAGE | tests/phase14-workflow.integration.test.ts |
| 15 | Deployment/operations | NOT FULLY VERIFIED | Preview history exists but Phase 25 exact-commit preview/ops acceptance not complete |
| 16 | Final synthetic acceptance | AUTOMATED SYNTHETIC COVERAGE | tests/phase16-acceptance.test.ts; does not substitute for live acceptance |
| 17 | Browser acceptance | BLOCKED | Prior preview was SSO-protected; do not bypass |
| 18 | Worker recovery | CODE + UNIT COVERAGE; LIVE CONCURRENCY BLOCKED | Recovery helper and Supabase migration; production migration history includes Phase 18, but live fault-injection is not run |
| 19 | Export integrity/audit | IMPLEMENTED HISTORICALLY; live download not verified | Current archive/integrity and export APIs; no authenticated signed-download run |
| 20 | Isolated acceptance safety preflight | PARTIAL | CI and safety docs; isolated database remains unavailable |
| 21 | Completeness audit | HISTORICAL AUDIT; not a pass by itself | No independent proof that every earlier acceptance gate passed |
| 22 | Project/template/spreadsheet mapping | AUTOMATED + CODE REVIEW | Import/template components and spreadsheet tests; authenticated UI flow remains blocked |
| 23 | Photo upload/matching/camera | AUTOMATED MATCHING COVERAGE; DEVICE TEST BLOCKED | Photo matching tests; no physical Android test |
| 24 | Canonical student identifiers | CODE + CI PASS; LIVE MIGRATION BLOCKED | PR #8 and CI run 38400206296; production schema still numeric until a separately authorized migration |
| 25 | Batch artifact validation and full regression | IMPLEMENTED ON FEATURE BRANCH; AUTOMATED CI PASS; LIVE ACCEPTANCE BLOCKED | Phase 25 CI run 38429090694 passed on SHA 21fb77a; no exact-commit Preview, isolated DB, 300-card throughput, or live signed-download acceptance |

## Environment and release controls

- Production Supabase project xdoenkusrakuyyxnnkff remains read-only for this phase. Do not run the Phase 24 migration or destructive tests there.
- At inspection, only the Production project and its default main branch were available. Creating an isolated branch at the quoted $0.01344/hour was attempted but Supabase rejected it because branching requires Pro; no upgrade or paid plan change was made.
- The latest previously inspected Vercel preview was tied to a Phase 23 commit, not the Phase 24/25 commit. READY status alone is not application acceptance.
- Vercel SSO is not bypassed. A browser profile with an authorized signed-in session is required for authenticated acceptance.
- Production deployment, PR merge, paid infrastructure changes, and schema mutation are not authorized by this phase request.


## Dependency audit residual

The Phase 25 CI production dependency audit reports three **moderate** findings through the transitive dependency chain @tensorflow/tfjs → argparse → sprintf-js (GitHub advisory [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), CVE-2026-97058). The advisory lists every published sprintf-js version through 1.1.3 as affected and currently lists no patched version. Pinning 1.1.3 does not fix it, so the attempted override was removed. npm audit --omit=dev --audit-level=high passes because the reported severity is moderate, not because the dependency tree is vulnerability-free. npm audit fix --force proposes a breaking TensorFlow.js downgrade and was not applied.

Remediation: identify whether TensorFlow.js can be removed or replaced without breaking photo processing; otherwise monitor the upstream advisory and replace the vulnerable transitive dependency only after a compatible fixed release or verified patch is available. Until then, treat dependency security as a release risk rather than claiming a clean audit.
