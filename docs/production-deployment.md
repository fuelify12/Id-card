# Production deployment

## Current gate

The latest Phase 14 evidence explicitly leaves production release blocked: no live browser E2E, two-tenant Supabase/Storage test, persisted worker recovery test, backup restore drill, or production deployment was verified. Phase 15 does not authorize production traffic changes. A green CI job is necessary but insufficient.

## Architecture and prerequisites

- Next.js App Router application; existing CI is GitHub Actions; intended hosting is Vercel; backend and private object storage use Supabase.
- Node.js 22 is used by the current CI workflow.
- An authorized owner must confirm the Vercel project/repository link, branch production settings, preview protection, domain, environment scopes, Supabase project references, storage privacy, and backup capabilities. Those account settings are not visible from this repository inspection.
- Keep Development, Preview, and Production Supabase credentials separate. Use synthetic data in previews.
- Confirm a reviewed lockfile is committed before switching CI to `npm ci`. At the inspected baseline, CI used `npm install` and no committed package lock was present.

## Release workflow

1. Open a pull request to `main`; review application changes and all Supabase migrations.
2. Require GitHub Actions CI to pass: dependency install/audit, secret scanning, tests, TypeScript, lint, production build, and client bundle secret check.
3. Review the full dependency audit artifact, not only the production high-severity gate. Phase 14 reported three moderate transitive advisories in the TensorFlow.js/argparse/sprintf-js chain.
4. Validate migrations on a disposable Supabase environment. Review schema changes and RLS/storage policies. Never use `supabase db reset` against production and do not apply destructive migrations without explicit owner approval and verified recovery.
5. Deploy a preview with isolated credentials and access protection. Run browser E2E tests with synthetic data, cross-tenant denial tests, storage tests, export verification, and persisted batch recovery.
6. Verify `GET /api/health` returns HTTP 200 on the candidate deployment. This checks required public configuration syntax only; it is not a database/storage probe.
7. Verify the dashboard, login, project creation, template upload, synthetic import, photo review, card render, validation, batch retry/recovery, ZIP extraction and download authorization.
8. Obtain owner sign-off for backup/restore evidence, monitoring/alert ownership, data retention, and legal/privacy obligations for children's data.
9. Promote only through the configured Vercel production workflow after gates pass. Do not use this document as authorization to deploy or change traffic.

## Rollback

- Application-only rollback: use Vercel's deployment history to promote the last known-good deployment after verifying compatibility with the current schema. Record deployment URL, commit SHA, time and operator.
- Database rollback: do not assume application rollback reverses a migration. Prefer forward-fix for additive/expand changes. For destructive or data-transforming changes, stop and use the approved recovery plan with an isolated restore rehearsal and owner authorization.
- After rollback, verify login, tenant boundaries, rendering, batch status and exports; monitor errors before declaring recovery complete.

## Stop-release conditions

Any unresolved P0/P1 defect; failed tenant isolation; public student-photo/export storage; unreviewed destructive migration; missing verified backup/recovery path; broken login/core workflow; incorrect student-photo association; corrupt ZIP; secret exposure; or unavailable critical monitoring/incident ownership blocks release.
