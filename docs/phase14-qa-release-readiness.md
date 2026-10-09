# Phase 14 — QA, regression testing and release readiness

**Assessment date:** 2026-10-09  
**Repository:** `fuelify12/Id-card`  
**Branch:** `main`  
**Release decision:** **NOT READY FOR RELEASE** until the blocked environment-dependent gates below are completed. A green GitHub Actions run proves the committed automated checks passed; it does not prove the live multi-tenant product works end to end.

## Verified defect and remediation

- **P1 — Import/matching ambiguity risk:** `validateStudentRows` used a regular expression that matched a literal backslash-plus-`d` rather than decimal digits, so ordinary numeric serials could be marked invalid during remapping. Import duplicate detection also compared raw strings, so `001` and `1` were not flagged as duplicates even though the photo matcher canonicalizes them to the same numeric student ID.
- **Fix:** numeric serial validation now uses a digit-only expression; duplicate detection uses a canonical numeric key while preserving the source/display serial string. Added regressions for leading-zero collisions, remapped columns, and nonnumeric serials.
- **Verification:** the targeted spreadsheet tests are part of `npm test` and the CI workflow. Record the current run's actual result in the release report; do not infer success while the run is queued or in progress.

## Test inventory

| Area | Automated coverage in repository | Evidence / limit |
|---|---|---|
| Spreadsheet import | Header detection, duplicate/missing serials, mapping revalidation, 10,000-row synthetic parse, padded-serial regression | Unit tests; no live authenticated import transaction in this phase |
| Photo matching | Filename patterns, configured prefixes, ambiguous/duplicate/unmatched IDs, cross-project assignment helper, content hash, file-size limits | Synthetic fixtures; no actual storage upload across two test accounts |
| Image/crop | Content sniffing, Sharp decode, corrupt payload, EXIF orientation, crop bounds/aspect, face-review flags, concurrency limits | Unit tests and mocks/synthetic images; no physical camera session |
| Rendering | Physical dimensions/DPI limits, SVG sanitization, real PNG card render, output dimensions/hash, Devanagari fixture | Synthetic renderer tests; not a visual golden-image comparison against a real school template |
| ZIP/export | Safe filenames, CSV formula escaping, eligibility, side selection, exact archive entries, corrupt/mismatched archive checks | In-memory synthetic archives; no signed URL expiry test against an isolated live Storage tenant |
| Validation | Missing/duplicate data, photo approval/association, stale template/output, hashes/dimensions, critical approval/waiver gates | Unit tests; not a complete live workflow validation pass |
| Batch | 300-card synthetic render workload with concurrency capped at 3, output reconciliation and ZIP entry verification | Exercises the actual renderer and archive verifier, **not** the persisted serverless batch worker, pause/resume, cancellation or worker-restart recovery |
| Security | Security headers, rate-limit behavior/fail-closed handling, environment validation, secret hygiene and client-bundle scans | Automated checks; two-account RLS/Storage integration requires an isolated Supabase test project |
| API/authentication | Protected route code has project-owner checks | No browser-driven unauthenticated/cross-tenant API test run against a disposable deployment |
| Responsive/mobile | Existing responsive CSS and camera component tests | No Playwright/browser viewport run or physical Android/iOS device test |
| Accessibility | Focus/semantic assertions and UI labels where covered by unit tests | No full axe/assistive-technology audit |
| Operations/recovery | Migrations and retention/recovery guidance documented | No backup restoration drill, production load test or live deployment verification |

## Reproducible commands

CI runs these commands on GitHub-hosted Ubuntu with Node.js 22:

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

The workflow's full dependency audit JSON and generated package lock are published as a short-lived CI artifact for review. A reviewed `package-lock.json` is not committed yet, so dependency installation is not yet fully reproducible from a committed lockfile. Do not replace `npm install` with `npm ci` until the lockfile has been generated, reviewed and committed.

## Actual CI verification (2026-10-09)

Latest successful workflow on the Phase 14 changes: https://github.com/fuelify12/Id-card/actions/runs/37922278963 (commit `680422a3f7f54eb4d869d052ec16bdbd1ec11e1e`).

- **PASSED:** 15 test files, 107 tests; no skipped tests reported by Vitest.
- **PASSED:** `npm run typecheck`, `npm run lint`, production `npm run build`, production dependency gate `npm audit --omit=dev --audit-level=high`, Gitleaks, full-history secret scan, tracked-file secret hygiene, and generated-client-bundle secret check (18 static files scanned).
- **PASSED, synthetic workload only:** 300 actual card renders with concurrency capped at 3, archive creation, expected-entry verification and missing-entry rejection; renderer loop measured approximately 3.0–3.2 seconds on the GitHub-hosted CI runner. This is not the persistent serverless batch worker benchmark.
- **FOUND, non-blocking for the configured production gate:** full-tree `npm audit` reports 3 moderate advisories in the TensorFlow.js → argparse → sprintf-js dependency chain. The suggested automatic fix is a breaking TensorFlow.js downgrade and was not applied.
- **NOT TESTED:** live browser E2E, real Supabase two-tenant/Storage integration, persisted 300-card worker recovery, physical mobile/camera, backup restore, and production deployment. These remain release blockers as stated above.
- The CI job uses `npm install` because the repository still has no committed lockfile; a generated lockfile and audit JSON are retained only as a short-lived artifact.

## Environment-dependent gates still required

1. Provision a **disposable Supabase test project/branch** with synthetic users for at least two tenants. Apply all migrations in order and run `supabase/tests/phase13_security.sql`, `supabase/tests/phase13_security_assertions.sql`, and `supabase/tests/phase13_tenant_isolation.integration.sql` only against that isolated test database. Verify SELECT/INSERT/UPDATE/DELETE and Storage CRUD from both identities. Do not run destructive fixtures against production.
2. Run a browser E2E suite against a preview with test-only credentials: create project, template upload, import, photo upload/matching, crop approval, render, validation, batch, export, download and reload persistence. Verify unauthenticated and cross-tenant denials.
3. Run actual persisted batch tests at 1, small and approximately 300 cards, including interruption/retry/cancel and two concurrent synthetic tenants. Reconcile persisted terminal item states; the current 300-render test is not a substitute.
4. Test responsive layouts at representative viewports and camera permission denial/switch/retake in supported browsers; perform a physical-device smoke test before release.
5. Review the current full dependency audit artifact. Phase 13's threat-model notes document remaining moderate development/runtime transitive advisories and the absent committed lockfile; the CI production-dependency high-severity gate passing does not mean the entire dependency tree is vulnerability-free.
6. Configure and verify distinct development/preview/production secrets, deployment protection, retention, backups and a restore drill in Vercel/Supabase. No production deployment or traffic change is authorized by this phase.
7. Obtain owner/legal review of Indian DPDP and children's-data obligations, customer/school roles, notices/consent, retention and processor terms. Technical tests are not a legal compliance certification.

## Release gate

**NOT READY FOR RELEASE** until the environment-dependent authentication/tenant-isolation, persisted batch recovery, live download authorization, preview browser workflow and backup/recovery checks above are evidenced. A CI pass alone cannot satisfy these release gates. Any new P0/P1 defect blocks release.

## Change safety

The import fix is incremental and does not modify schema or delete data. The added integration tests use generated synthetic student names, in-memory image buffers, in-memory ZIPs and temporary IDs only. No real children's records, production deletion, live credential rotation, or production deployment is part of this phase.
