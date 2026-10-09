# Phase 13 — Security, privacy and production hardening

## Verified environment

- Repository: `fuelify12/Id-card`, default branch `main`, Next.js 16 / React 19 / TypeScript / Vitest.
- Supabase project: `Id-card` (`xdoenkusrakuyyxnnkff`), Postgres 17, region `ap-south-1`.
- The initial database inspection found 14 public application tables with RLS; Phase 13 adds `security_rate_limits`, bringing the total to 15 public tables, all with RLS. No application rows were present during the initial inspection.
- Existing private buckets: `printforge-templates`, `printforge-student-photos`, `printforge-generated-cards`, `printforge-exports`; a separate `printforge-private` bucket has no application storage policy in the inspected policy list. The four named asset buckets were configured private.
- The repository contains `.env.example` with variable names and empty values; `.gitignore` excludes `.env* except `.env.example`. A committed `package-lock.json` is still absent.
- GitHub Actions now runs a production-only high-severity dependency gate, a full audit report artifact, Gitleaks full-history scanning, tracked-file secret hygiene, unit tests, TypeScript, lint, production build, and client-bundle secret checks. A committed `package-lock.json` remains absent.

## Findings and remediation

| Severity | Finding verified | Remediation |
|---|---|---|
| HIGH | Database grants gave both `anon` and `authenticated` unnecessary `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges across 14 public application tables. RLS does not constrain TRUNCATE. | Revoked all public-table grants from `anon`; revoked high-risk table privileges from `authenticated`; set safer default table privileges. |
| HIGH | Public application functions had inherited `PUBLIC EXECUTE` ACLs, and some RPCs also explicitly granted execution to `anon`. | Revoked function execution from `PUBLIC` and `anon` for public-schema functions; preserved explicit authenticated/service-role grants. |
| MEDIUM | Tenant policies on several child tables primarily checked `owner_id`; they did not consistently prove that linked project/template/student/batch/card rows belonged to the same owner. | Replaced policies with project- and parent-qualified checks for students, templates, template fields, batches, jobs, generated cards, batch items, validation results/findings, and exports; added composite foreign keys and validated all 12 security constraints. |
| MEDIUM | Application users could update or delete their own audit rows because the original audit policy used `FOR ALL`. | Replaced it with SELECT-only access for authenticated clients; database triggers record lifecycle metadata and direct client mutations are denied. |
| MEDIUM | Storage policies had an unqualified `name` reference inside a query that also referenced `school_projects.name`, so the predicate could bind to the project name instead of the object path. Other bucket policies did not consistently verify that the second path segment was an owned project. | Replaced application bucket policies with explicit `objects.name` path parsing and project-owner checks for SELECT/INSERT/UPDATE/DELETE. |
| HIGH | Public application tables/functions had excessive privileges, including TRUNCATE/TRIGGER/REFERENCES and PUBLIC/anonymous function execution. | RLS does not constrain TRUNCATE; catalog grants confirmed the privileges. | Revoked anon table access, removed high-risk table grants, revoked PUBLIC/anon function execution, and set safer defaults. | Live catalog assertions pass; no anonymous public-function execution remains. |
| HIGH | The initial shared rate-limit RPC accepted client-supplied quota/window values. | The SECURITY DEFINER RPC accepted `p_limit` and `p_window_seconds` from the caller. | Server-side quotas are fixed per action; mismatched values are rejected; CPU-intensive photo processing is limited to 10/minute. | Live function-definition assertion and rate-limit unit tests pass. |
| MEDIUM | Full dependency audit still reports transitive advisories. | Full audit reported 0 critical, 5 high in the ESLint/Next development toolchain, and 3 moderate involving TensorFlow.js/argparse/sprintf-js; npm's suggested forced fixes were breaking downgrades. | Block high-severity production advisories; publish the full audit report artifact and track compatible transitive upgrades. | Latest CI production-only audit gate passes; full audit findings remain open. |
| LOW | Dependency installs are not fully reproducible. | `package-lock.json` is absent from the default branch; CI publishes a generated lockfile artifact for review. | Commit a reviewed lockfile. | Owner follow-up. |

### Safe reproduction notes

- Privilege finding: query `information_schema.role_table_grants` for `anon` / `authenticated` and the `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges. Before remediation, each role had those grants across the 14 public application tables.
- Audit finding: inspect `pg_policies` for `public.audit_logs`; the prior `audit own rows` policy was `ALL` with both `USING` and `WITH CHECK`.
- Storage finding: inspect `pg_policies` on `storage.objects`; the old predicates included `storage.foldername(p.name)` and did not reliably qualify the object path.
- The initial project inspection found no student/project records, and no second test account was provisioned. Cross-tenant runtime denial was **not** claimed as tested; use two synthetic test accounts in a non-production Supabase project to verify SELECT/INSERT/UPDATE/DELETE, Storage CRUD, and signed URL expiry.

## Operational controls

- All four production asset buckets remain private. The `printforge-private` bucket remains without application user policies; do not use it for direct client uploads until a specific access contract is added.
- The app uses Supabase SSR cookies and `auth.getClaims()` in the proxy and project APIs; each resource endpoint must still authorize its project/resource server-side. RLS is defense in depth, not a substitute for API checks.
- The rate-limit SECURITY DEFINER RPC has a single intentional Supabase advisor warning; it validates `auth.uid()`, pins a safe search_path, restricts actions/quotas, and does not grant access to the private rate-limit table.
- Avoid logging student names, photos, spreadsheet contents, raw signed URLs, or tokens. Return generic errors to clients and keep diagnostic detail in redacted server-side logs.
- Temporary export retention is implemented by the existing export workflow; verify cleanup scheduling and backup restore in the actual Vercel/Supabase environment before launch.
- Do not enable public storage URLs for child photos, crops, templates, generated cards, or ZIPs. Use short-lived signed URLs after a fresh ownership check.
- A Vercel production-target deployment was created automatically by pushes to `main` and was observed in `READY` state for commit `2b2358895043859581657f3b95ef30f76bf2d585`. I did not manually deploy, change aliases, roll back, or run a production smoke test; project metadata indicated the project was not marked live, so a public traffic change was not confirmed. Further pushes to `main` should be reviewed because Vercel auto-deploys this branch.

## Indian privacy/legal review required

The platform handles children's personal data and photographs. Owner/legal review should determine applicability and implementation requirements under India's Digital Personal Data Protection Act, 2023 and the rules/commencement notifications in force for the intended launch date, plus school/contractual requirements. Confirm the data fiduciary/processor roles, parent/guardian notice and consent/other lawful basis, school instructions, purpose limitation, retention/deletion schedules, data-subject request handling, breach response, processor contracts, and cross-border/vendor data flows. This technical phase is not a legal-compliance certification.

## Remaining risks / owner actions

- **HIGH:** No isolated two-tenant integration test has been run yet; provision two synthetic accounts in a staging project and verify tenant denial across DB, storage, signed URLs, API endpoints, and background workers.
- **HIGH (development toolchain):** The full npm audit report has 0 critical, 5 high, and 3 moderate advisories. The high findings are in the eslint-config-next / @next/eslint-plugin-next / fast-glob / micromatch / braces development chain; npm's suggested fix downgrades eslint-config-next to 14.2.35, a major downgrade from Next.js 16, so it was not applied. Upgrade this chain when compatible patched releases are available.
- **MEDIUM (runtime dependency):** The full audit reports 3 moderate advisories involving @tensorflow/tfjs, argparse, and sprintf-js. npm's suggested fix downgrades TensorFlow.js to 2.1.0, a major downgrade, so it was not applied. Review exploitability and update the model dependency chain safely.
- **MEDIUM:** A committed package-lock.json is still absent. CI generated one and published it with the full audit JSON as a short-lived artifact; commit a reviewed lockfile to make dependency resolution reproducible.
- **PASS (history scan):** Gitleaks full-history scanning and the tracked-file secret hygiene check passed with no leaks reported in the scanned history/tree. This is not a guarantee that external Vercel/Supabase settings contain no secrets.
- **MEDIUM:** Per-account database-backed limits now cover project/template/student/photo upload, photo processing, batch create/retry, and ZIP export. They do not provide IP-level or Storage API-wide quotas. Review direct Storage upload volume, remaining raw exception paths, request-size ceilings, and CSRF/origin protections.
- **MEDIUM:** Vercel project inspection showed Node 24.x, an existing deployment marked READY for the production target, but the project was not marked live. SSO protection is enabled for deployment URLs except custom domains; password protection is disabled. Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY were listed, shared across development, preview, and production. Use separate Supabase projects/keys per environment and verify deployment protection before launch.
- **MEDIUM:** No production restore drill, export expiry cleanup schedule check, or real mobile/browser security test was performed.
- **MEDIUM:** CSP is initially report-only to avoid breaking Next.js hydration, Supabase auth, private image previews, and camera workflows. Review browser reports and move to enforced CSP with a nonce-based Next.js setup when validated.
- **LOW:** Keep the separate `printforge-private` bucket unused by end-user flows until its intended role is documented and policies are designed.

## Verification

Run the read-only database catalog assertions with an isolated test database after applying the migrations. The same catalog assertions have been executed against the connected project and passed; the two-tenant CRUD integration script is separate and has not been run because no isolated branch/test accounts were provisioned:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase13_security.sql
```

The catalog test does not substitute for two-account integration tests. Report dependency audit, CI, build, deployment, and live browser results only from actual runs.
