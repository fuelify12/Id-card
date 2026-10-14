# Phase 27 — Visual quality, print geometry, and release acceptance

## Decision

**Release status: NOT CERTIFIED FOR PRODUCTION.** Phase 27 adds automated image-level checks and a real-renderer 300-record synthetic workload test. These tests validate the rendering engine in CI; they do not substitute for authenticated application acceptance, a migrated isolated Supabase environment, live storage/RLS tests, or a physical print.

## Starting point and Phase 26 verification

- Starting branch: `phase-26-blocker-resolution`
- Starting commit: `6ba3c97c7f2a4999c511f1077fb365824be5c93b`
- Phase 26 report: `docs/phase26-blocker-resolution.md`
- Phase 26 was not treated as accepted merely because a report or historical test exists; this phase reran the current branch regression workflow.
- Production project `xdoenkusrakuyyxnnkff` was inspected read-only. Its public tables exist and RLS is enabled on the current application tables, and the PrintForge storage buckets inspected are private. This is schema/configuration evidence only—not an authenticated cross-tenant or download-denial test.
- The separate synthetic Supabase project `zzecjgauhkaxyptsurlw` is healthy but still has **zero public application tables and zero recorded migrations**. The repository tree does not include the historical `supabase/migrations/20261008173336_phase1_foundation.sql` baseline referenced in the production migration ledger; later SQL files depend on those baseline tables. The isolated schema was deliberately left untouched rather than guessing/reconstructing a missing foundational migration.
- A new non-production Vercel project, `printforge-phase27-acceptance`, is linked to the exact GitHub repository. Its Preview deployment for tested commit `f9a61c597ff89d6eb8c19b9c4355da69035078cc` reached READY: https://printforge-phase27-acceptance-fzhk6h564-yash-6966.vercel.app. Vercel SSO protection remains enabled; no SSO bypass or authenticated browser workflow was attempted. Because isolated Supabase is schema-empty and no authorized signed-in browser profile is available, this is a successful Preview build—not end-to-end application acceptance.
- Production was not used as a test database, no Production data/schema changes were made, and no Production deployment was completed. An initial Vercel API deployment request was unexpectedly tagged `production`; it was canceled while initializing before readiness. Subsequent successful deployments were Preview-targeted by omission of the target field, and their metadata shows `target: null`.

## Phase 27 implementation

- Latest passing full-regression push run for tested renderer code: https://github.com/fuelify12/Id-card/actions/runs/38592364713 (commit `f9a61c597ff89d6eb8c19b9c4355da69035078cc`). CI reported **19 test files / 115 tests passed**, TypeScript passed, lint passed with 0 errors and 8 existing `<img>` optimization warnings, production build passed, repository security check passed, the client-bundle secret scan passed, and the synthetic visual/print artifacts were uploaded. The matching PR-triggered workflow was still in progress at last inspection, so the completed push run is the authoritative completed result.
- The 300-card renderer test completed **300/300** at concurrency 4; latest measured elapsed time was **23.795 seconds**. This is bounded in-process renderer performance, not a database-backed batch, storage, ZIP-download, or production throughput guarantee.
- Inspecting the actual generated PNG exposed a defect not covered by the original tests: raster pixel dimensions were correct, but PNG print-density metadata read as 25.4 DPI instead of configured 300 DPI. The renderer now writes configured density metadata for both PNG and JPEG; new visual tests assert the configured DPI in both formats. Re-run evidence passed in CI above.
- Synthetic raster outputs measured 1011 × 638 px for the configured 85.6 × 54 mm card. PNG metadata reports approximately 299.9994 DPI due to PNG pixels-per-metre encoding; JPEG metadata reports 300 DPI. The PDF has one page with 242.646 × 153.071 pt geometry (85.6 × 54 mm). These are file/metadata checks, not a physical-printer test.
- The rendered artifact was visually inspected: Devanagari “आरव शर्मा” and the leading-zero ID “001” are legible and present. The fixture uses a blank synthetic background and no student photo, so this is a renderer fixture—not an approved school design, a photo-association acceptance, or an approved golden image.
- `tests/visual-print-acceptance.test.ts` checks configured raster geometry, deterministic output hashes, nonblank Devanagari/leading-zero rendering, bounded pixel difference against a blank same-template baseline, 300-DPI raster metadata, JPEG metadata, and one-page PDF physical dimensions.
- `tests/batch-render-300.test.ts` runs 300 synthetic student records through the real renderer using bounded concurrency of four and checks output dimensions, nonempty artifacts, zero renderer errors, and unique hashes. Separate Phase 14 synthetic integration coverage renders cards and verifies ZIP directory/manifest reconciliation in memory. Neither test runs the database-backed persisted worker/storage/authenticated-download workflow.
- `.github/workflows/phase25-batch-generation.yml` now publishes synthetic PNG/JPEG/PDF inspection outputs as a seven-day GitHub Actions artifact, alongside regression tests, typecheck, lint, production build, dependency audit, repository security check, and client-bundle secret scan.
- The high-severity-only production dependency audit gate passed, but **3 moderate `sprintf-js`/`argparse` advisories remain unresolved**; the gate does not mean a clean audit.
- The completed lint step still reports 8 existing `@next/next/no-img-element` warnings and no lint errors.

### Visual test policy

The new pixel-difference test compares a generated text-bearing card to a same-template no-field baseline. Thresholds are explicit: changed pixels must exceed 0.02% and remain below 20% of the image. It additionally verifies PNG and JPEG print-density metadata. This detects blank output and unexpectedly broad pixel changes; it is **not** an approved golden-reference comparison and does not certify every glyph position, text overflow, or all visual placements. Approved golden images and human inspection are still required for stronger visual acceptance.

## Requirement-to-test traceability

| Requirement | Implementation / test | Evidence status | Remaining limitation |
|---|---|---|---|
| Exact text identifier policy, including leading zeros | `lib/identifiers/student-identifier.ts`; identifier/import/photo/batch tests | Automated regression exists; Phase 24 CI was reported green | Live DB migration and constraint behavior not executed in isolated app schema |
| Required field mapping and Unicode values | `lib/rendering/engine.ts`; `tests/rendering-engine.test.ts`; new visual fixture and mixed-script 300-card fixture | PASS in CI run 38588794003 after mixed-script font fallback fix | No OCR/human review of every glyph/placement |
| Physical raster dimensions and DPI metadata | `validatePhysicalSize`; `tests/visual-print-acceptance.test.ts` | PASS in CI run 38592364713; PNG ~299.9994 DPI, JPEG 300 DPI | Actual printer not available |
| PDF page geometry | `pdf-lib`; `tests/visual-print-acceptance.test.ts` | PASS in CI run 38592364713; one page, 85.6 × 54 mm | Font/output behavior on target print hardware not verified |
| Deterministic artifact and content changes | Renderer input/output hashes; existing renderer tests | Existing unit coverage plus new hash check | No approved image golden baseline yet |
| 300 synthetic cards | `tests/batch-render-300.test.ts` | PASS in CI run 38592364713; 300/300, 23.795 s, bounded concurrency 4 | In-memory rendering only, not persisted DB worker, storage, or authenticated ZIP download |
| Batch worker state/recovery | `lib/batch/recovery.ts`; `tests/batch-recovery.test.ts`; artifact integrity tests | Unit coverage exists | Live competing workers, process kill, retry/backoff, and storage outage not exercised |
| ZIP structure, manifest, hashes | `lib/exports/archive.ts`; archive/export tests | Automated tests exist | Private authenticated download bytes not checked in isolated live app |
| RLS and cross-tenant isolation | migrations and E2E tenant-isolation suite | BLOCKED / not live-verified | Isolated project has no app schema/migrations; authenticated session not available |
| Project/template/import/photo workflow | project, import, photo, matching and crop components/tests | Implementation/tests exist | End-to-end authenticated browser workflow remains unverified |
| Mobile camera | photo workflow and browser/device tests | PARTIAL | Physical Android capture/retake/reload not tested on a device |
| Security/dependencies | security script, npm audit CI step, RLS/storage tests | High-severity production audit gate exists | Phase 26 report identifies unresolved `sprintf-js` advisory with no patched release; dependency reachability still needs review |
| Preview deployment | Vercel deployment metadata | PASS WITH WARNINGS for Preview build on tested SHA; live app acceptance BLOCKED | READY non-production build; SSO remains enabled, schema-empty isolated DB, no authorized browser session |
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
| 27 | Visual/print acceptance | PARTIAL | CI passes 115 tests, PNG/JPEG 300-DPI metadata checks, PDF geometry and 300 renders; synthetic artifacts inspected; physical print and live workflow remain unverified |

## Required unblocking actions

1. Restore/commit the missing authoritative Phase 1 baseline migration and validate the complete migration chain in order; only then bootstrap the isolated synthetic Supabase project, seed tenants A/B, and execute positive/negative RLS, storage and authenticated-download tests. Do not reconstruct tables by guesswork or use Production as a substitute.
2. Obtain an authorized test account/browser profile for the READY SSO-protected Phase 27 Preview and verify the branch-scoped isolated Supabase settings; keep SSO protections enabled and do not create bypass links.
3. Run Playwright acceptance for import → exact photo match → crop → render → persisted batch → ZIP → authenticated download and cross-tenant denial.
4. Inspect the generated raster/PDF artifacts and approve golden references only after visual review.
5. Print a sample on the target physical printer and inspect dimensions, color, front/back alignment, and safe areas.
6. Resolve the `sprintf-js` advisory by proving the affected formatting functions are not reachable with untrusted format strings or by adopting a supported upstream fix when available; do not hide it with an ineffective override.
7. Run a backup/restore drill and document rollback steps before release.

## Safety

No PR merge, successful Production deployment, Production schema change, Production data mutation, SSO bypass, or physical-print claim is performed by this phase. One initial Vercel deployment request was canceled before readiness when its returned target was incorrectly marked Production.
