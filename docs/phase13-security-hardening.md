# Phase 13 — Security, privacy and production hardening

## Scope and evidence

Repository reviewed on 2026-10-09: Next.js 16.4, React 19, Supabase SSR/JS, Sharp, pdf-lib, fflate, xlsx, Vitest, and GitHub Actions. The live Supabase project was inspected through read-only schema, policy, constraint, bucket, function, migration-history and security-advisor queries before the additive migration was prepared.

The current model is **single-account ownership per project**: the schema has owner_id rather than school-membership tables or explicit operator/reviewer roles. This phase does not invent a multi-user role system. Each signed-in account is scoped to its own projects.

## Prioritized findings

| Severity | Finding | Evidence / safe reproduction | Remediation | Verification |
|---|---|---|---|---|
| HIGH | Storage policies did not consistently bind object path segment 2 to the owned project. The photo-specific predicate inspected storage.foldername(p.name) instead of the requested object path. | Live pg_policies showed the predicate and projectObjectPath() confirms the path format is user UUID / project UUID / opaque filename. | Phase 13 migration replaces the overlapping storage policies with per-operation policies checking bucket, authenticated user folder, and owned project folder. | Verify policy definitions after migration; run two-account storage checks in an isolated Supabase test project before release. |
| MEDIUM | Audit rows were writable/deletable by their owner through an ALL policy. | Live policy inspection showed audit own rows with cmd=ALL. | Read-only owner policy; database trigger writes metadata-only lifecycle events; revoke client insert/update/delete/truncate privileges. | Verify policy/privileges and trigger list after migration. |
| MEDIUM | Several rows had separate project and owner foreign keys, allowing inconsistent project-owner relationships to be represented if a write path passed RLS but supplied mismatched identifiers. | Live constraints showed independent owner/project FKs for students, templates, batches, processing jobs and generated cards. | Added composite project-owner/parent FKs, initially NOT VALID for a safe additive rollout, then validated them after checking existing records. | 12 tenant-integrity constraints validated; 0 remain unvalidated. |
| MEDIUM | Global browser security headers were not configured in next.config.ts. | Inspected config contained only powered-by, strict mode and tracing options. | Add CSP, nosniff, clickjacking, referrer, permissions and production HSTS headers; keep Supabase HTTPS/realtime and same-origin camera access available. | Unit tests cover the header policy; deployment smoke tests are still required. |
| MEDIUM | CI installed without a committed lockfile and skipped dependency auditing. | package-lock.json was not found on the repository's default branch; CI used npm install --no-audit. | Add a production dependency audit gate and repository secret-hygiene check. | CI reports actual audit results; add and review a committed lockfile as an owner follow-up. |
| MEDIUM | Full dependency audit found unresolved transitive advisories after compatible dependency updates. | CI run for commit `14de87b` reported 8 findings: 3 moderate and 5 high; the high-severity path was `braces` through Next ESLint tooling, and the moderate path included `sprintf-js` through TensorFlow. `npm audit fix --force` proposed breaking dependency changes. | Keep a blocking production-only high-severity audit gate and a visible full-audit report; remediate the remaining transitive findings with compatible upgrades/overrides. | Full audit step failed as expected before the workflow was split into production gate + report-only full audit; verify the latest run before release. |
| LOW | No committed lockfile exists. | `package-lock.json` is absent from the default branch. | Commit a reviewed lockfile so CI installs are reproducible and audit results are stable. | Still an owner follow-up.

No finding is described as an exploited incident. The reproduction steps above are read-only inspections of confirmed configuration, not unauthorized cross-tenant access attempts.

## Database migration

supabase/phase13_security_hardening.sql is additive and repeatable. supabase/phase13_storage_path_policy_fix.sql follows it to explicitly qualify the outer storage.objects.name reference (PostgreSQL policy deparsing canonicalizes this to objects.name). supabase/phase13_rate_limits.sql adds shared account-level request quotas. None of these migrations drop application tables or user data. Together they:
- Adds unique supporting indexes and composite foreign keys for project/owner and related-record consistency; all 12 new security foreign keys have now been validated.
- Replaces the overlapping PrintForge Storage policies with explicit SELECT/INSERT/UPDATE/DELETE checks for the user's UUID and an owned project UUID in the object path.
- Makes audit logs read-only to authenticated clients and adds database-trigger lifecycle events with actor ID, operation, entity type/reference and source only. Student fields, photos, signed URLs, and raw row contents are not logged.
- Leaves the printforge-private bucket outside the user-facing policy set.
- Adds a shared, atomic database-backed per-account rate limiter for project creation, template uploads, student imports, photo upload tickets, batch creation/retry, and ZIP exports. Server-side quotas are pinned by action in the SECURITY DEFINER RPC; client-supplied limit/window values that do not match the trusted quota are denied. Limits fail closed if the RPC is unavailable.

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
- The Supabase SQL assertions were executed successfully against the connected project: RLS on all public application tables, private buckets, qualified storage object paths, read-only client audit policy, audit triggers, validated tenant constraints, no anonymous public-function execution, no direct client grants on the rate-limit table, and fixed rate-limit quotas.
- The Supabase security advisor now reports only the intentional authenticated SECURITY DEFINER rate-limit RPC warning; the RLS-enabled/no-policy informational finding was addressed with an explicit deny-all policy on the private rate-limit table.
- The latest CI run after the dependency/audit workflow changes must be checked before release; do not treat the earlier failed full-audit run as a passing build.

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
