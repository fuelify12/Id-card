# Phase 13 — Security, privacy and production hardening

## Verified environment

- Repository: `fuelify12/Id-card`, default branch `main`, Next.js 16 / React 19 / TypeScript / Vitest.
- Supabase project: `Id-card` (`xdoenkusrakuyyxnnkff`), Postgres 17, region `ap-south-1`.
- Existing database contained 14 public application tables; the initial catalog query found RLS enabled on all 14. No application rows were present during this inspection.
- Existing private buckets: `printforge-templates`, `printforge-student-photos`, `printforge-generated-cards`, `printforge-exports`; a separate `printforge-private` bucket has no application storage policy in the inspected policy list. The four named asset buckets were configured private.
- The repository contains `.env.example` with variable names and empty values; `.gitignore` excludes `.env* except `.env.example`.
- The existing GitHub Actions workflow runs tests, TypeScript, lint, and production build. The repo did not contain a `package-lock.json` when inspected, so installs were not reproducible via `npm ci`.

## Findings and remediation

| Severity | Finding verified | Remediation |
|---|---|---|
| HIGH | Database grants gave both `anon` and `authenticated` unnecessary `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges across 14 public application tables. RLS does not constrain TRUNCATE. | Revoked all public-table grants from `anon`; revoked high-risk table privileges from `authenticated`; set safer default table privileges. |
| HIGH | Public application functions had inherited `PUBLIC EXECUTE` ACLs, and some RPCs also explicitly granted execution to `anon`. | Revoked function execution from `PUBLIC` and `anon` for public-schema functions; preserved explicit authenticated/service-role grants. |
| MEDIUM | Tenant policies on several child tables primarily checked `owner_id`; they did not consistently prove that linked project/template/student/batch/card rows belonged to the same owner. | Replaced policies with project- and parent-qualified checks for students, templates, template fields, batches, jobs, generated cards, batch items, validation results/findings, and exports. |
| MEDIUM | Application users could update or delete their own audit rows because the original audit policy used `FOR ALL`. | Replaced it with SELECT and INSERT policies only, and restricted inserts to the actor's own project. |
| MEDIUM | Storage policies had an unqualified `name` reference inside a query that also referenced `school_projects.name`, so the predicate could bind to the project name instead of the object path. Other bucket policies did not consistently verify that the second path segment was an owned project. | Replaced application bucket policies with explicit `objects.name` path parsing and project-owner checks for SELECT/INSERT/UPDATE/DELETE. |
| LOW | CI did not run a dependency audit or secret scan. The repository lacked a lockfile. | Security CI checks and lockfile follow-up are documented; do not treat a scanner that was not run as a clean result. |

### Safe reproduction notes

- Privilege finding: query `information_schema.role_table_grants` for `anon` / `authenticated` and the `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges. Before remediation, each role had those grants across the 14 public application tables.
- Audit finding: inspect `pg_policies` for `public.audit_logs`; the prior `audit own rows` policy was `ALL` with both `USING` and `WITH CHECK`.
- Storage finding: inspect `pg_policies` on `storage.objects`; the old predicates included `storage.foldername(p.name)` and did not reliably qualify the object path.
- The project had no student/project records during inspection, and no second test account was provisioned. Cross-tenant runtime denial was **not** claimed as tested; use two synthetic test accounts in a non-production Supabase project to verify SELECT/INSERT/UPDATE/DELETE and signed URL behavior.

## Operational controls

- All four production asset buckets remain private. The `printforge-private` bucket remains without application user policies; do not use it for direct client uploads until a specific access contract is added.
- The app uses Supabase SSR cookies and `auth.getClaims()` in the proxy and project APIs; each resource endpoint must still authorize its project/resource server-side. RLS is defense in depth, not a substitute for API checks.
- Avoid logging student names, photos, spreadsheet contents, raw signed URLs, or tokens. Return generic errors to clients and keep diagnostic detail in redacted server-side logs.
- Temporary export retention is implemented by the existing export workflow; verify cleanup scheduling and backup restore in the actual Vercel/Supabase environment before launch.
- Do not enable public storage URLs for child photos, crops, templates, generated cards, or ZIPs. Use short-lived signed URLs after a fresh ownership check.
- No production deployment, credential rotation, database reset, or destructive cleanup was performed by this phase.

## Indian privacy/legal review required

The platform handles children's personal data and photographs. Owner/legal review should determine applicability and implementation requirements under India's Digital Personal Data Protection Act, 2023 and the rules/commencement notifications in force for the intended launch date, plus school/contractual requirements. Confirm the data fiduciary/processor roles, parent/guardian notice and consent/other lawful basis, school instructions, purpose limitation, retention/deletion schedules, data-subject request handling, breach response, processor contracts, and cross-border/vendor data flows. This technical phase is not a legal-compliance certification.

## Remaining risks / owner actions

- **HIGH:** No isolated two-tenant integration test has been run yet; provision two synthetic accounts in a staging project and verify tenant denial across DB, storage, signed URLs, API endpoints, and background workers.
- **HIGH:** Dependency vulnerability audit and secret-history scan results are not yet available. Run them in CI and address all exploitable critical/high findings; rotate any real credential if the history scan identifies one.
- **MEDIUM:** Review all API route handlers for raw exception messages, request-size limits, rate limits, CSRF protections, and resource ceilings; verify actual Vercel deployment headers and authentication settings.
- **MEDIUM:** No production restore drill, export expiry cleanup schedule check, or real mobile/browser security test was performed.
- **LOW:** CSP is initially report-only to avoid breaking Next.js hydration, Supabase auth, private image previews, and camera workflows. Review browser reports and move to enforced CSP with a nonce-based Next.js setup when validated.
- **LOW:** Keep the separate `printforge-private` bucket unused by end-user flows until its intended role is documented and policies are designed.

## Verification

Run the read-only database catalog assertions with an isolated test database after applying the migrations:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase13_security.sql
```

The catalog test does not substitute for two-account integration tests. Report dependency audit, CI, build, deployment, and live browser results only from actual runs.
