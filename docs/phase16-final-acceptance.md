# Phase 16 — Final production acceptance record

**Assessment date:** 2026-10-09  
**Repository:** `fuelify12/Id-card`, branch `main`  
**Decision:** **NOT READY FOR LAUNCH**

This record distinguishes repository/CI evidence from live service verification. No production deployment, production data mutation, production load test, real school order, physical print, or backup restore was performed in this phase.

## Baseline inspected

- Next.js App Router frontend and server APIs; Supabase SSR authentication and owner-scoped project queries.
- Supabase schema/migration history includes project/template/student/photo/render/batch/validation/export/audit models, tenant-integrity constraints, RLS, private storage policies, and rate-limiting functions.
- Renderer: `lib/rendering/engine.ts`; spreadsheet import: `lib/imports/student-spreadsheet.ts`; photo matching/cropping: `lib/photos/`; batch worker: `app/api/projects/[id]/batch/route.ts`; ZIP export: `app/api/projects/[id]/exports/route.ts`; download authorization: `app/api/projects/[id]/exports/[exportId]/download/route.ts`.
- CI installs with `npm install --no-audit --no-fund`; a committed `package-lock.json` is absent. A reproducible `npm ci` install is therefore not available yet.
- GitHub Actions run `37923706715` on prior head `41b540de5b7663b6330df00142a5bec5ddf73e95` failed TypeScript because `tests/health-route.test.ts` assigned to readonly `process.env.NODE_ENV`. The test has been corrected by removing those assignments; the new head's CI must be checked before treating this fix as verified.
- Existing documented limitations remain: batch work is request-driven (no independent scheduled abandoned-lease recovery worker); no verified browser E2E or two-tenant live RLS/Storage acceptance; no backup restore drill or production deployment confirmation; no physical device/camera/print verification.

## Synthetic acceptance dataset

Added `tests/phase16-acceptance.test.ts`, which generates 300 fictional spreadsheet records at test time. It includes Devanagari and Latin names, long names, optional cells, varied classes/sections, a duplicate canonical serial (`042` / `42`), a missing serial and a missing required name. It also creates generated valid, duplicate-content, low-resolution and corrupt image buffers; no real children's data or photographs are included.

The fixture exercises parser and matcher logic and the deterministic metadata/hash audit. It does **not** upload to Supabase or claim a live 300-student production batch. The pre-existing `tests/phase14-workflow.integration.test.ts` independently renders 300 synthetic PNG cards at bounded concurrency 3 and builds/verifies an in-memory ZIP. That test uses a synthetic template and simple text field, not 300 persisted batch-worker jobs or an approved-photo end-to-end school order.

## Integrity audit implementation

Added `lib/acceptance/integrity-audit.ts`. The audit compares stable student IDs, source/display serials, canonical serial uniqueness, matched and approved photo identifiers/hashes, rendered student/serial, template version, output filename/hash, archive-file hash, and one-to-one manifest entries. It flags duplicate IDs/serials/output names, missing archive files, hash mismatches, orphan/unmanifested entries, stale template versions, and failed/review records presented as exported successes.

The audit returns a separate `humanReviewRequired` list for successful records. Hashes and metadata establish consistency between recorded artifacts; they do not prove that the pixels depict the correct child. An operator must visually approve student/photo identity and inspect representative final output. The helper must be wired into the actual export acceptance path before treating it as a production enforcement gate.

## Acceptance checklist

| Gate | Status | Evidence / limitation |
|---|---|---|
| Repository baseline and prior phase docs inspected | PASSED | Main branch, current tree, CI workflow, Phase 10–14 docs and core import/matching/render/batch/export code inspected |
| Health-test TypeScript defect | FIX APPLIED; CI PENDING | Prior CI showed readonly `NODE_ENV` errors; assignments removed; awaiting a successful run on the final head |
| Synthetic 300-row import fixture | ADDED; CI PENDING | Automated test includes malformed and Unicode cases; not yet run on the final head |
| 300 real renderer outputs | EXISTING TEST; CURRENT CI PENDING | Prior CI passed 300 synthetic renderer outputs in about 3 seconds; that measurement is historical and not a current-head result |
| Deterministic student-to-card audit | ADDED; CI PENDING | Unit-level metadata/hash integrity checks; not a live storage/manifest integration |
| Real 300-item persisted batch | NOT TESTED | Requires isolated Supabase project and authenticated synthetic tenant |
| ZIP creation/extraction/hash correspondence | PARTIAL | Existing in-memory ZIP verifier tests; actual private Storage archive/download not exercised |
| RLS and Storage two-tenant isolation | BLOCKED | No disposable Supabase test environment credentials/authorization evidenced in this run |
| Authentication and browser end-to-end workflow | NOT TESTED | No preview browser test was executed |
| Mobile viewports and camera permission handling | NOT TESTED | Unit tests exist; no browser or physical device used in this phase |
| Rendering metadata and Devanagari font coverage | PARTIAL | Existing synthetic render/unit tests; no golden-image visual comparison or print examination |
| Dependency audit | PARTIAL | Existing CI production gate passed on previous commit; full audit previously reported 3 moderate TensorFlow.js dependency-chain advisories |
| Lockfile installation | BLOCKED | No committed lockfile; CI uses npm install |
| Production build/lint/typecheck on final head | PENDING | Must check the final CI result |
| Live monitoring/alerts and backup restore | NOT TESTED | Phase 15 runbook is documentation, not proof of configured alerts or a successful restore |
| Production deployment / smoke test | NOT TESTED | No deployment or traffic change was authorized |

## Commands and evidence

The GitHub Actions workflow `.github/workflows/ci.yml` defines these commands on Node.js 22:

```sh
npm install --no-audit --no-fund
npm audit --json
npm audit --omit=dev --audit-level=high
node scripts/security-check.mjs
npm test
npm run typecheck
npm run lint
npm run build
node scripts/client-bundle-security-check.mjs
```

The previous Phase 14 CI run documented 15 test files / 107 tests, plus the 300-render synthetic test, but that result predates Phase 16 changes and is not evidence that the current head passes. The first Phase 16 CI run passed install, audit gate, secret scanning, repository hygiene, and unit tests, then failed TypeScript on the health test. The test has been fixed; do not report the final run as passed until its result is available.

## Remaining launch blockers and owner actions

1. Confirm CI passes on the final commit, including tests, typecheck, lint, build and client bundle secret scan.
2. Generate, review and commit a lockfile before using `npm ci`; review the complete dependency audit and remediate/accept the three moderate TensorFlow.js dependency-chain advisories.
3. Provision an isolated Supabase test project/branch with two synthetic users, apply migrations in order, and run the SQL tenant-isolation/security assertions plus CRUD checks for database and private storage.
4. Run browser E2E against an isolated preview through sign-in, project, import, template, photos, crop approval, render, validation, persisted batch, ZIP, download, reload and session expiry.
5. Execute the approximately 300-record batch through the actual persisted worker, including interruption, retry, pause/resume, cancellation, idempotency and final state reconciliation.
6. Wire the integrity audit into export verification, then test actual archived file hashes and manifest entries in private storage; test unauthorized download and signed URL expiry.
7. Perform visual review of final-rendered outputs (including Devanagari, overflow and crop alignment) and a physical printer calibration/print examination on representative hardware.
8. Test responsive viewports and camera permission denial/capture on supported browsers and a physical Android device.
9. Verify configured monitoring and alert delivery, separate deployment environments, backup retention and a successful restore drill. Confirm deployment plan supports the export route's 300-second budget.
10. Obtain owner/legal approval for children's-data notices/consent, retention and processor obligations.

No production traffic, production data, live secrets or backups were changed by this phase.

**Launch decision: NOT READY FOR LAUNCH.** The current automated and synthetic coverage is useful but does not establish real-world tenant isolation, persisted batch recovery, secure download behavior, final visual correctness or operational recovery.
