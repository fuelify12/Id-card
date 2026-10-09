# Phase 13 — Security, privacy and production hardening

## Scope and evidence

Repository reviewed on 2026-10-09: Next.js 16.4, React 19, Supabase SSR/JS, Sharp, pdf-lib, fflate, xlsx, Vitest, and GitHub Actions. The live Supabase project was inspected through read-only schema, policy, constraint, bucket, function, migration-history and security-advisor queries before the additive migration was prepared.

The current model is **single-account ownership per project**: the schema has owner_id rather than school-membership tables or explicit operator/reviewer roles. This phase does not invent a multi-user role system. Each signed-in account is scoped to its own projects.

## Prioritized findings

| Severity | Finding | Evidence / safe reproduction | Remediation | Verification |
|---|---|---|---|---|
| MEDIUM | Storage policies did not consistently bind object path segment 2 to the owned project. The photo-specific predicate inspected storage.foldername(p.name) instead of the requested object path. | Live pg_policies showed the predicate and projectObjectPath() confirms the path format is user UUID / project UUID / opaque filename. | Phase 13 migration replaces the overlapping storage policies with per-operation policies checking bucket, authenticated user folder, and owned project folder. | Verify policy definitions after migration; run two-account storage checks in an isolated Supabase test project before release. |
| MEDIUM | Audit rows were writable/deletable by their owner through an ALL policy. | Live policy inspection showed audit own rows with cmd=ALL. | Read-only owner policy; database trigger writes metadata-only lifecycle events; revoke client insert/update/delete/truncate privileges. | Verify policy/privileges and trigger list after migration. |
| HIGH | Public application tables and functions had unnecessarily broad grants, including TRUNCATE/TRIGGER/REFERENCES privileges and inherited PUBLIC/anonymous function execution. | Initial live catalog queries showed these privileges on the application schema; RLS does not protect TRUNCATE. | Revoked anonymous table grants, removed high-risk authenticated table privileges, revoked PUBLIC/anon execution, and set safer defaults. | SQL assertions report no anonymous function execution and no unnecessary table privileges. |
| HIGH | The first shared rate-limit RPC trusted caller-provided limits and window lengths, allowing an authenticated client to attempt to reset or raise its own quota. | Review of the SECURITY DEFINER function showed p_limit and p_window_seconds were client arguments. | Pin quotas server-side by action, reject mismatched limit/window values, and add a 10-per-minute quota for CPU-intensive photo processing. | Live function-definition assertion passes; rate-limit unit coverage added. |
| MEDIUM | Several rows had separate project and owner foreign keys, allowing inconsistent project-owner relationships to be represented if a write path passed RLS but supplied mismatched identifiers. | Live constraints showed independent owner/project FKs for students, templates, batches, processing jobs and generated cards. | Added composite project-owner/parent FKs, initially NOT VALID for a safe additive rollout, then validated them after checking existing records. | 12 tenant-integrity constraints validated; 0 remain unvalidated. |
| MEDIUM | Global browser security headers were not configured in next.config.ts. | Inspected config contained only powered-by, strict mode and tracing options. | Added nosniff, clickjacking, referrer, permissions, production HSTS, and a CSP Report-Only policy compatible with Supabase and camera workflows. | Header-policy unit tests pass in CI; deployed browser smoke tests remain required. |
| MEDIUM | Full dependency audit found unresolved transitive advisories after compatible dependency updates. | Full audit report: 0 critical, 5 high, 3 moderate. The high findings are in the Next.js ESLint development chain (braces / fast-glob / micromatch); the moderate findings include TensorFlow.js / argparse / sprintf-js. npm's suggested fixes require major downgrades, so they were not applied blindly. | CI blocks high-severity production dependency findings and publishes the complete audit report as a short-lived artifact; safely upgrade the remaining transitive chains when compatible fixes are available. | The production-only high-severity audit gate passes; full audit findings remain open. |
| LOW | No committed lockfile exists. | `package-lock.json` is absent from the default branch; CI generates a lockfile artifact for review but does not commit it. | Commit a reviewed lockfile so CI installs are reproducible and audit results are stable. | Still an owner follow-up. |

No finding is described as an exploited incident. The reproduction steps above are read-only inspections of confirmed configuration, not unauthorized cross-tenant access attempts.

## Database migration

The versioned files under `supabase/migrations/` mirror the applied Supabase history: `20261009095425_phase13_security_hardening.sql`, `20261009095538_phase13_function_privileges.sql`, `20261009095800_phase13_security_hardening_v2.sql`, `20261009095926_phase13_storage_path_policy_fix.sql`, `20261009095940_phase13_default_function_privileges.sql`, `20261009100225_phase13_audit_status_metadata.sql`, `20261009100320_phase13_rate_limits.sql`, `20261009100339_phase13_validate_tenant_constraints.sql`, `20261009100605_phase13_fixed_rate_limit_quotas.sql`, `20261009100837_phase13_rate_limit_deny_policy.sql`, `20261009101327_phase13_photo_processing_rate_limit.sql`, and `20261009101414_phase13_photo_processing_quota.sql`. The root `supabase/phase13_*.sql` files are consolidated reference scripts. These migrations are additive and do not drop application tables or user data. Together they:
- Adds unique supporting indexes and composite foreign keys for project/owner and related-record consistency; all 12 new security foreign keys have now been validated.
- Replaces the overlapping PrintForge Storage policies with explicit SELECT/INSERT/UPDATE/DELETE checks for the user's UUID and an owned project UUID in the object path.
- Makes audit logs read-only to authenticated clients and adds database-trigger lifecycle events with actor ID, operation, entity type/reference and source only. Student fields, photos, signed URLs, and raw row contents are not logged.
- Leaves the printforge-private bucket outside the user-facing policy set.
- Adds a shared, atomic database-backed per-account rate limiter for project creation, template uploads, student imports, photo upload tickets, CPU-intensive photo processing, batch creation/retry, and ZIP exports. Server-side quotas are pinned by action in the SECURITY DEFINER RPC; client-supplied limit/window values that do not match the trusted quota are denied. Limits fail closed if the RPC is unavailable.

All 12 composite tenant-integrity foreign keys have been validated against existing records. The SQL test suite also asserts that no security foreign keys remain unvalidated.

## Application and file-processing observations

- proxy.ts uses Supabase SSR getClaims() to protect dashboard navigation. API handlers inspected also verify claims and owner-scoped project access. RLS remains the database backstop.
- Existing export helpers already escape spreadsheet formula prefixes in CSV cells, sanitize archive names, and verify ZIP directory contents. Existing upload actions apply size/MIME checks, image signatures/dimensions, SVG sanitization, and single-page PDF validation; photo processing uses Sharp and bounded batch logic.
- Existing photo and export storage buckets are private with configured size/MIME limits. The migration tightens project binding; it does not publish files or create long-lived signed URLs.
- No service-role key is declared in .env.example; the application uses the publishable key with user sessions. The repository secret scanner is a guardrail, not a substitute for Git-history scanning or Vercel secret review.
- Account-level rate limits are backed by a shared Postgres RPC with server-owned quotas. A security-advisor warning remains for the authenticated SECURITY DEFINER rate-limit RPC; this is intentional because it must atomically write the private rate-limit table, and it validates auth.uid(), restricts actions/quotas, uses a fixed search_path, and grants no access to the underlying table. These per-account limits do not limit by IP or prevent distributed abuse across multiple accounts; configure Vercel WAF/shared edge limits as another layer.
- ZIP entry checks and expansion limits exist in the export/photo workflow, but adversarial fuzzing of malformed PDFs/SVGs/images and a dedicated sandbox for hostile documents were not run as part of this change.
- No automated test using two authenticated tenant accounts was run against the live project. Do not use real student data for this. Provision two synthetic test users in an isolated Supabase branch/project and run CRUD and storage denial tests before production release.

## Security tests and CI

- lib/security/headers.test.ts covers the CSP, framing, content-type, permissions, HSTS, and Supabase realtime directives.
- lib/security/rate-limit.test.ts covers allow, exhausted quota, and fail-closed RPC failure behavior; lib/env.test.ts covers missing/invalid Supabase environment configuration.
- lib/security/exports-security.test.ts covers formula prefixes, path traversal names, and unexpected ZIP entries.
- Existing lib/exports/archive.test.ts covers CSV formula escaping, path sanitization, and ZIP directory validation.
- `.github/workflows/ci.yml` runs a production-only `npm audit --omit=dev --audit-level=high` blocking gate, a full `npm audit --audit-level=high` report step, Gitleaks secret scanning, Vitest, TypeScript, ESLint, and the production build. The full audit step is report-only because the verified high findings were in a transitive development-tool chain and `npm audit fix --force` proposed breaking upgrades; the production-only gate remains blocking.
- The Supabase SQL assertions were executed successfully against the connected project: RLS on all public application tables, private buckets, qualified storage object paths, read-only client audit policy, audit triggers, 12 validated tenant constraints, no anonymous public-function execution, no direct client grants on the rate-limit table, and fixed rate-limit quotas. A synthetic two-tenant integration script is at `supabase/tests/phase13_tenant_isolation.integration.sql`; it is intentionally not run against the connected project and must be run only on an isolated Supabase branch.
- The Supabase security advisor now reports only the intentional authenticated SECURITY DEFINER rate-limit RPC warning; the RLS-enabled/no-policy informational finding was addressed with an explicit deny-all policy on the private rate-limit table.
- Latest GitHub Actions run for the Phase 13 commit [37917077003](https://github.com/fuelify12/Id-card/actions/runs/37917077003) completed successfully. All steps passed: production dependency audit gate, full-history Gitleaks scan, tracked-file secret hygiene, client-bundle secret scan, unit tests, TypeScript, ESLint, and production build. The preceding detailed test run [37916870032](https://github.com/fuelify12/Id-card/actions/runs/37916870032) passed 103 unit tests across 14 files. CI uses non-production placeholder Supabase public values only for its build step. No deployment was performed by this phase.

## Deployment configuration reviewed

The connected Vercel project is named printforge-id-card-studio and reports Node 24.x. Its latest deployment metadata was READY for the production target, while the project itself was marked not live; SSO protection is enabled for deployment URLs except custom domains and password protection is disabled. The only listed project environment variables were NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, shared across development, preview, and production; no hidden production environment variables were reported. These are public client settings, not a service-role key, but separate Supabase projects per environment are recommended. This phase did not create a deployment or change traffic.

## Privacy and operations

- Continue to use private buckets, short-lived signed URLs, project-scoped access, and the existing explicit photo approval gate. Do not put child names, serial numbers, photographs, signed URLs or spreadsheet rows in routine logs.
- Define a school/customer-approved retention schedule for original photos, crops, templates, generated cards, exports, and backups; automate deletion only after retention rules and recovery requirements are approved.
- Before launch in India, obtain owner/legal review of the Digital Personal Data Protection Act, 2023 and the applicable rules/commencement notifications, child-data obligations, school/customer controller/processor responsibilities, consent/notice, breach handling, retention, and cross-border processor terms. This engineering work is not a legal-compliance certification.
- Keep separate Vercel environment variables for development, preview and production. Validate Supabase URL/publishable key, Gemini key (if that feature is enabled), domain redirects, HTTPS, backup retention, and restore procedures in the actual Vercel/Supabase consoles.
- Do not rewrite Git history or rotate production credentials automatically. If any credential is found in source or history, revoke/rotate it promptly and coordinate history cleanup with repository collaborators.

## Rollout checklist

1. Review the versioned Phase 13 migrations in timestamp order and apply them to a Supabase branch first.
2. Run schema/policy assertions and synthetic two-user RLS + Storage CRUD tests on that isolated branch.
3. Review full dependency audit output, remediate the remaining transitive advisories, and commit a lockfile.
4. Configure shared rate limits, backups and retention/deletion jobs; verify restore from a backup.
5. Deploy a preview and test login, project CRUD, imports, approved photo matching, rendering, validation, batch retries, ZIP export/download and mobile camera behavior.
6. Apply the migration to production only after branch tests and a backup are confirmed; then verify response headers and download expiry on the deployed host.
