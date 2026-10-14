# Phase 27 — Visual quality, print geometry, and release acceptance

## Decision

**Release status: NOT CERTIFIED FOR PRODUCTION.** Phase 27 adds automated image-level checks and a real-renderer 300-record synthetic workload test. These tests validate the rendering engine in CI; they do not substitute for authenticated application acceptance, a migrated isolated Supabase environment, live storage/RLS tests, or a physical print.

## Starting point and Phase 26 verification

- Starting branch: `phase-26-blocker-resolution`
- Starting commit: `6ba3c97c7f2a4999c511f1077fb365824be5c93b`
- Phase 26 report: `docs/phase26-blocker-resolution.md`
- Phase 25 CI run previously reported successful: https://github.com/fuelify12/Id-card/actions/runs/38428733778
- Latest listed READY Vercel deployment is built from Phase 23 commit `c384bf5899d19363abce8e5d644eedbe03daac68`; it is not the Phase 26/27 code.
- A separate synthetic Supabase project now exists (`zzecjgauhkaxyptsurlw`), but read-only inspection found no public tables and no recorded migrations. This is not yet an application-ready isolated environment. Production project `xdoenkusrakuyyxnnkff` has not been mutated.

## Phase 27 implementation

- `tests/visual-print-acceptance.test.ts` uses the real renderer and Sharp pixel data to verify 85.6 × 54 mm / 300 DPI geometry, deterministic output hashes, nonblank Devanagari/leading-zero rendering, bounded pixel difference against an empty synthetic template render, and one-page PDF physical dimensions.
- `tests/batch-render-300.test.ts` runs 300 synthetic student records through the real renderer using bounded concurrency of four, checks output dimensions, nonempty artifacts, zero renderer errors, and unique hashes, and logs actual elapsed time in CI. This is an in-process render workload—not the database-backed persisted worker/storage/download workflow.
- `.github/workflows/phase25-batch-generation.yml` now runs on the Phase 27 branch and includes the full existing suite, typecheck, lint, production build, dependency audit, repository security check, and client-bundle secret scan.
- Synthetic names include Devanagari, Latin text, and leading-zero identifiers. No real student data is used.

### Visual test policy

The new pixel-difference test compares a generated text-bearing card to a same-template no-field baseline. Thresholds are explicit: changed pixels must exceed 0.02% and remain below 20% of the image. This detects blank output and unexpectedly broad pixel changes; it is **not** an approved golden-reference comparison and does not certify text overflow or all visual placements. Approved golden images and human inspection are still required for stronger visual acceptance.

## Requirement-to-test traceability

| Requirement | Implementation / test | Evidence status | Remaining limitation |
|---|---|---|---|
| Exact text identifier policy, including leading zeros | `lib/identifiers/student-identifier.ts`; identifier/import/photo/batch tests | Automated regression exists; Phase 24 CI was reported green | Live DB migration and constraint behavior not executed in isolated app schema |
| Required field mapping and Unicode values | `lib/rendering/engine.ts`; `tests/rendering-engine.test.ts`; new visual fixture | Renderer tests + Phase 27 visual test | No OCR/human review of every glyph/placement |
| Physical raster dimensions at 300 DPI | `validatePhysicalSize`; `tests/visual-print-acceptance.test.ts` | CI pending on this commit | Actual printer not available |
| PDF page geometry | `pdf-lib`; `tests/visual-print-acceptance.test.ts` | CI pending on this commit | Font/output behavior on target print hardware not verified |
| Deterministic artifact and content changes | Renderer input/output hashes; existing renderer tests | Existing unit coverage plus new hash check | No approved image golden baseline yet |
| 300 synthetic cards | `tests/batch-render-300.test.ts` | CI pending; elapsed time will be captured in logs | In-memory rendering only, not persisted DB worker, storage, or ZIP |
| Batch worker state/recovery | `lib/batch/recovery.ts`; `tests/batch-recovery.test.ts`; artifact integrity tests | Unit coverage exists | Live competing workers, process kill, retry/backoff, and storage outage not exercised |
| ZIP structure, manifest, hashes | `lib/exports/archive.ts`; archive/export tests | Automated tests exist | Private authenticated download bytes not checked in isolated live app |
| RLS and cross-tenant isolation | migrations and E2E tenant-isolation suite | BLOCKED / not live-verified | Isolated project has no app schema/migrations; authenticated session not available |
| Project/template/import/photo workflow | project, import, photo, matching and crop components/tests | Implementation/tests exist | End-to-end authenticated browser workflow remains unverified |
| Mobile camera | photo workflow and browser/device tests | PARTIAL | Physical Android capture/retake/reload not tested on a device |
| Security/dependencies | security script, npm audit CI step, RLS/storage tests | High-severity production audit gate exists | Phase 26 report identifies unresolved `sprintf-js` advisory with no patched release; dependency reachability still needs review |
| Preview deployment | Vercel deployment metadata | BLOCKED for tested SHA | Latest READY deployment is stale Phase 23 code |
| Backups / disaster recovery / rollback | operational documentation and migrations | NOT VERIFIED | No restore drill, retention proof, or rollback execution evidence |

## Phases 1–27 phase-by-phase status

Status below is a release-evidence assessment, not a claim that historical implementation is absent. “PARTIAL” means code/tests are present or historically described but the complete acceptance gate was not proven in this phase.

| Phase | Scope | Assessment | Evidence / remaining gap |
|---:|---|---|---|
| 1 | Application foundation | PARTIAL | Existing app/repository; full historical acceptance not rerun separately |
| 2 | Authentication and access | PARTIAL | Code and tests exist; authenticated live session acceptance unavailable |
| 3 | School projects and isolation | PARTIAL | Workflow implementation exists; live two-tenant RLS not verified |
| 4 | Template upload/configuration | PARTIAL | Rendering/template tests exist; authenticated upload workflow not verified |
| 5 | Student spreadsheet import | PARTIAL | Import/parser tests exist; complete browser import/mapping not verified |
| 6 | Student validation and field mapping | PARTIAL | Required mapping tests exist; all template types not visually reviewed |
| 7 | Photo upload/matching/crop | PARTIAL | Exact matching/crop tests exist; live storage and Android camera not verified |
| 8 | Rendering engine | PARTIAL | `tests/rendering-engine.test.ts` plus Phase 27 visual/PDF tests; physical print not verified |
| 9 | Batch generation | PARTIAL | Real-renderer 300-item test added; DB-backed 300-card batch remains unverified |
| 10 | Validation/quality control | PARTIAL | Artifact and preflight tests exist; complete live report workflow not verified |
| 11 | ZIP export | PARTIAL | Archive tests exist; live private download not verified |
| 12 | Mobile/camera workflow | PARTIAL | Responsive code/tests; physical Android device test missing |
| 13 | Security hardening | PARTIAL | Security script and unit coverage; live RLS/storage negative tests missing |
| 14 | QA/regression | PARTIAL | CI test suite exists; complete browser and device regression not run |
| 15 | Deployment/monitoring/DR | NOT VERIFIED | Current deployment is stale; alerts/restore/retention not evidenced |
| 16 | Final acceptance | BLOCKED | External acceptance gates remain |
| 17 | Browser E2E acceptance | BLOCKED | SSO/authenticated Preview access not available |
| 18 | Worker recovery | PARTIAL | Recovery unit tests; real process interruption/concurrency not verified |
| 19 | Export integrity/audit | PARTIAL | Manifest/hash tests; authenticated download/audit live path not verified |
| 20 | Isolated acceptance gates | PARTIAL | Synthetic Supabase project exists but has no app tables/migrations yet |
| 21 | Completeness audit | PARTIAL | Known blockers tracked; no full release certification |
| 22 | School import/template mapping | PARTIAL | Code and parser/render tests; live workflow not verified |
| 23 | Photo workflow | PARTIAL | Matching/crop tests; physical camera and private-storage acceptance missing |
| 24 | Canonical identifiers | PARTIAL | Text identifier policy/migrations implemented on branch; migrations not yet validated/applied to isolated app schema |
| 25 | Batch artifact integrity | PARTIAL | Persisted-artifact gate and automated CI reported green; live worker/storage acceptance missing |
| 26 | Blocker resolution | PARTIAL | Empty-batch reconciliation fix; report explicitly retains external blockers |
| 27 | Visual/print acceptance | IN PROGRESS | New image-diff, PDF geometry, and 300-render tests await this branch's CI result; physical print and live workflow still unverified |

## Required unblocking actions

1. Populate the separate synthetic Supabase project by applying the repository's complete migrations in order, then run migration assertions, seed synthetic tenant A/B data, and execute positive and negative RLS/storage/download tests. Do not use Production as a substitute.
2. Configure a Vercel Preview from the exact Phase 27 commit with only the isolated test project's credentials and a permitted authenticated browser session; retain SSO protections.
3. Run Playwright acceptance for import → exact photo match → crop → render → persisted batch → ZIP → authenticated download and cross-tenant denial.
4. Inspect the generated raster/PDF artifacts and approve golden references only after visual review.
5. Print a sample on the target physical printer and inspect dimensions, color, front/back alignment, and safe areas.
6. Resolve the `sprintf-js` advisory by proving the affected formatting functions are not reachable with untrusted format strings or by adopting a supported upstream fix when available; do not hide it with an ineffective override.
7. Run a backup/restore drill and document rollback steps before release.

## Safety

No PR merge, Production deployment, Production schema change, Production data mutation, SSO bypass, or physical-print claim is performed by this phase.
