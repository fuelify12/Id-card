# Phase 20 — Isolated acceptance environment and authenticated browser tests

## Goal

Establish a fail-closed path for authenticated end-to-end acceptance without ever pointing a mutating browser test at the production Supabase project. This phase does not deploy application code to Production and does not alter Production data.

## Implemented in this branch

- Added `scripts/e2e-safety-preflight.mjs`; the acceptance command runs it before Playwright. It refuses to run unless explicit mutation and synthetic-data confirmations are set, target Supabase project refs differ, the Supabase URL matches the declared non-production ref, the inspected Preview commit matches the expected commit, and the URL is an HTTPS Vercel Preview rather than the production alias.
- Hardened `tests/e2e/export-download.spec.ts` with the same core fail-closed checks, plus an optional Vercel Protection Bypass header on the first page navigation so the protected Preview can be reached without putting the bypass value into browser code or logs.
- Changed `npm run test:e2e:acceptance` to invoke the safety preflight and the real signed-URL download test serially.
- Reuses the existing synthetic 300-row workbook/photo/template fixture builder. It contains fictional records and intentionally invalid/missing/duplicate photo cases.

## Required operator environment

Set these only in a local, controlled test shell or a protected CI secret store. Never paste passwords, Supabase keys, or Vercel bypass values into a chat, issue, PR comment, or log.

| Variable | Purpose |
| --- | --- |
| `E2E_ISOLATED_ENV=true` | Explicitly confirms the target is isolated |
| `E2E_ALLOW_MUTATIONS=true` | Explicit opt-in for the acceptance suite's test login/export reads |
| `E2E_SYNTHETIC_DATA_CONFIRMED=true` | Confirms the target has synthetic-only test data |
| `E2E_PREVIEW_INSPECTED=true` | Confirms the exact Preview was inspected read-only first |
| `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` | Dedicated non-production test account |
| `E2E_EXPORT_PROJECT_ID`, `E2E_EXPORT_ID` | UUIDs of the seeded synthetic project and completed synthetic export |
| `E2E_SUPABASE_PROJECT_REF` | Isolated Supabase project ref |
| `E2E_PRODUCTION_SUPABASE_PROJECT_REF` | Production ref; must differ from the target |
| `E2E_SUPABASE_URL` | Isolated project URL; must match its ref |
| `PLAYWRIGHT_BASE_URL` | Exact inspected Vercel Preview URL |
| `E2E_PREVIEW_COMMIT_SHA`, `E2E_EXPECTED_COMMIT_SHA` | Must identify the same reviewed Preview commit |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Protected secret used only on the first Preview navigation |

The preflight validates configuration metadata; it cannot prove that a database actually contains only synthetic records. The operator must inspect the project and fixture records before setting the confirmation flags. Use a dedicated test user with no access to production. Do not reuse a production account.

## How to run after the environment is available

1. Create or designate a **separate, isolated Supabase project**. Do not use the production project, pause/delete the current project, or upgrade a plan as an implicit workaround.
2. Apply the reviewed Phase 19 migration to that isolated project only, then verify the RPC grants, ownership checks, and RLS/storage policies.
3. Seed the synthetic 300-row fixture and generate a completed synthetic export. Record the resulting project/export UUIDs.
4. Deploy the same reviewed commit to a Preview whose environment variables point only to the isolated project. Verify the commit SHA and inspect the Preview read-only.
5. Configure the variables above in a protected local shell/CI environment, then run `npm run test:e2e:acceptance`.
6. Preserve Playwright's test report and traces privately. Review any failed assertion before changing code or rerunning tests.

## Current blockers and honest status

- The Supabase account's Free-plan active-project limit prevented creation of the previously approved isolated project. No existing project was paused/deleted and no plan was upgraded.
- The currently available Preview is SSO-protected and was observed to redirect anonymous visits to Vercel login. The application was not rendered in that smoke test.
- No dedicated isolated test account, synthetic completed export, or Preview wired to an isolated Supabase project has been configured.
- Therefore the acceptance command has **not** been run against a real isolated environment. A passing repository build or preflight is not proof of tenant isolation, successful export download, or release readiness.

## Exit criteria

Phase 20 is not complete until all of the following are evidenced:

- [ ] Isolated Supabase project exists and its ref is distinct from production.
- [ ] Phase 19 migration applies successfully in isolation and database function privileges are reviewed.
- [ ] Synthetic-only 300-record fixture and completed export exist.
- [ ] Exact Preview commit and isolated Preview environment are verified; SSO access is handled without exposing secrets.
- [ ] Authenticated Playwright run downloads the real signed URL and verifies archive SHA-256, ZIP entries, and item hashes.
- [ ] Negative authorization tests demonstrate that a second test tenant cannot read another tenant's export/storage object.
- [ ] CI passes for the final Phase 20 head and the acceptance report is reviewed.

**Status: IN PROGRESS — infrastructure blocker remains.** No Production deploy, Phase 19 migration, or production data mutation is part of this phase.
