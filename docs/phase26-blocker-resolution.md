# Phase 26 — Blocker resolution and release acceptance

## Scope and decision

This phase performs the safe code-level reliability fixes and rechecks current CI, Supabase, Vercel, and browser-automation access. It does not merge a PR, change Production, weaken SSO/RLS, or create paid infrastructure.

**Current release decision: NOT APPROVED FOR PRODUCTION.** The remaining live acceptance gates require an isolated database/storage environment and authenticated Preview session; the connected Supabase account currently exposes only Production project `xdoenkusrakuyyxnnkff` and its default `main` branch. The Vercel deployment list does not contain a Preview built from the Phase 25/26 head SHA. Production is not a safe substitute.

## Phase 26 code changes

- `lib/batch/recovery.ts`: reconciliation now fails closed for an empty item set. It cannot infer that a zero-item/corrupt batch completed successfully. A terminal/operator-controlled existing state is preserved.
- `tests/batch-recovery.test.ts`: regression test covers empty batches while running and preserves an already-terminal status.
- `package.json`: removed the ineffective `sprintf-js@^1.1.3` override. The current advisory affects versions through 1.1.3 and has no upstream patched release, so the override did not remediate the finding and was misleading. No breaking transitive downgrade was forced.
- `.github/workflows/phase25-batch-generation.yml`: include the Phase 26 branch and Phase 25 PR target so this same full verification job runs on this work.

## Current infrastructure evidence

### Supabase

Read-only integration calls at Phase 26 start returned one project: `Id-card`, ref `xdoenkusrakuyyxnnkff`, status `ACTIVE_HEALTHY`. `list_branches` returned only the default `main` branch. The production migration ledger was inspected read-only. Phase 24 migrations have not been applied to Production and must not be applied as an acceptance shortcut.

Required unblocking action: provision/authorize a separate test Supabase project or a development branch on a plan that supports branching, using synthetic fixtures only. No plan upgrade or paid resource was created in this phase. Apply migrations in that isolated target, run `supabase/tests/phase24_student_identifier_schema.sql`, seed two synthetic tenants, and execute the real batch/export and negative authorization tests there.

### Vercel and browser

The most recent listed READY deployment was built from Phase 23 commit `c384bf5899d19363abce8e5d644eedbe03daac68`, not the Phase 25/26 head. This is not evidence that the new code is deployed. TinyFish profile inspection found no saved signed-in sites, so an authenticated browser run cannot be safely started without a user-created/saved sign-in session. No SSO bypass or secret exposure was attempted.

Required unblocking action: configure a Preview deployment from the exact Phase 26 PR commit with a compatible isolated Supabase URL/keys; if deployment protection is enabled, configure the authorized Vercel automation bypass only in a protected secret store. Sign into Vercel/Preview in the selected browser profile through its setup flow (never share credentials in chat), then run the E2E acceptance suite.

### 300-record and fault-injection acceptance

The existing unit suite includes 300-item status-count reconciliation and synthetic artifact integrity cases. These are not a measured live 300-card render run and do not simulate real database concurrency/storage failures. The actual renderer, storage, DB claims, signed-download flow, and two-tenant RLS must be exercised in the isolated environment before those gates can pass.

## Dependency advisory review

GitHub Advisory Database entry [GHSA-hp3w-g68c-fv3c / CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), updated 2026-10-05, reports `sprintf-js` versions `<=1.1.3` affected by unbounded precision specifiers; **no patched npm version is currently listed**. The issue is a potential denial-of-service via an uncaught RangeError when untrusted format strings reach the affected formatting functions. The Phase 25 dependency gate checks high severity only and therefore does not establish absence of moderate findings. The Phase 26 change removes a no-op pin rather than pretending to fix the advisory. Remaining action: inspect the resolved dependency paths with `npm ls sprintf-js`, verify whether untrusted strings can reach format-string arguments, replace/upgrade the upstream dependency when a real fix is available, and keep the exposure under review. Do not use a breaking TensorFlow.js downgrade solely to silence audit.

## Verification commands and evidence

Repository CI workflow commands (actual CI, not claimed local executions):

```sh
npm install --legacy-peer-deps --no-audit --no-fund
npm audit --omit=dev --audit-level=high
node scripts/security-check.mjs
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-client-bundle.mjs
```

The latest prior completed full CI before Phase 26 code changes was [run 38429090694](https://github.com/fuelify12/Id-card/actions/runs/38429090694), successful on application-code SHA `21fb77a514c3df60dc377f1ec9af251dd0611fae`; the preceding documented run [38428733778](https://github.com/fuelify12/Id-card/actions/runs/38428733778) reported 17 test files / 109 tests passing, TypeScript pass, lint 0 errors / 8 warnings, production build pass, repository secret check pass, and client bundle check pass. These are historical baseline results, **not** Phase 26's result. The Phase 26 CI run must complete on the final Phase 26 SHA before the code changes are treated as CI-verified.

## Phase 1–25 traceability status

| Phase / requirement area | Code/test evidence | Automated status | Live acceptance status |
|---|---|---|---|
| 1–5 foundation, auth, project and template foundations | Existing application modules, migrations, CI Vitest/typecheck/build | Historical CI baseline only; not every historical test independently rerun per phase | NOT VERIFIED end-to-end |
| 6–8 photo handling, processing and renderer | `lib/photos/**`, `lib/rendering/**`, Phase 6–8 migrations, photo/render tests | Synthetic/unit coverage in full Vitest run | Camera and physical print NOT VERIFIED |
| 9–10 batch generation, validation and ZIP export | `app/api/projects/[id]/batch/route.ts`, `lib/validation/**`, `lib/exports/**`, batch/export tests | Synthetic regression coverage | Real 300-record run and private download NOT VERIFIED |
| 11–16 export, mobile, security, QA, operations, acceptance | export APIs, security checks, phase14/16 tests, E2E suites | Relevant unit suites in full Vitest; mutating E2E safety gate exists | RLS, signed download, browser and recovery restore BLOCKED/NOT VERIFIED |
| 17–20 browser acceptance, worker recovery, export integrity, isolated test safety | Playwright acceptance specs, recovery migrations, E2E preflight | Static/unit coverage and CI security gates | Authenticated E2E and live fault injection BLOCKED |
| 21 audit/completeness | Phase 21 audit history and traceability docs | Audit documentation, not a runtime test | Outstanding external gates remain |
| 22 school projects/template/import/mapping | project/template/import UI and spreadsheet tests | Synthetic tests in full suite | Authenticated workflow NOT VERIFIED |
| 23 photo workflow/camera/matching/crop | photo workspace/matching tests and browser specs | Synthetic matching tests | Physical Android camera NOT VERIFIED |
| 24 canonical identifiers and migration | `lib/identifiers/student-identifier.ts`, three Phase 24 migrations, migration contract tests | Phase 24 CI and static migration contract tests | Live migration/schema constraint BLOCKED; not applied to Production |
| 25 batch artifact integrity | `lib/batch/recovery.ts`, batch API, `tests/batch-artifact-integrity.test.ts` | Previous full CI passed 109 tests | Real 300-card batch, concurrent recovery, authenticated private download BLOCKED |
| 26 blocker-resolution regression | Empty-batch fail-closed reconciliation plus regression test | Awaiting final branch CI result | Infrastructure blockers unchanged; see above |

This table is evidence-aware: historical code and unit tests do not establish live workflow acceptance.

## Release gates

| Gate | Status | Evidence / exact remediation |
|---|---|---|
| 1. Identifier migration/data integrity | BLOCKED | Phase 24 migration exists; live schema assertions require isolated Supabase. Never apply to Production for testing. |
| 2. School project/template workflow | NOT VERIFIED | Needs signed-in Preview workflow on isolated data. |
| 3. Spreadsheet import/mapping | PARTIAL | Parser/unit tests exist; full persisted workflow needs Preview/database. |
| 4. Exact photo matching/crop persistence | PARTIAL | Synthetic matching coverage; live persistence and Android capture remain unverified. |
| 5. Card rendering correctness | PARTIAL | Unit/validation tests; no full artifact inspection or physical print evidence. |
| 6. Approximately 300-record batch | NOT VERIFIED | Only synthetic status-count coverage; execute real renderer/storage/DB pipeline with 300 synthetic records and report measured duration/resources. |
| 7. Retry/resume/cancellation/concurrency | PARTIAL | Unit recovery coverage; inject worker/storage/database faults only in isolated DB. |
| 8. ZIP/private signed download | PARTIAL | Synthetic archive/integrity tests; authenticated byte-for-byte private download not run. |
| 9. RLS/cross-tenant security | BLOCKED | Only Production project available; run two-tenant negative tests in isolated DB. |
| 10. Authenticated browser acceptance | BLOCKED | No saved signed-in TinyFish profile and no Phase 26 Preview tied to tested SHA. |
| 11. Physical Android camera | NOT VERIFIED | Requires physical Android device plus authorized signed-in Preview. |
| 12. Phase 1–25 regression | PARTIAL | Full automated CI baseline exists; not all live scenarios were rerun. Phase 26 final CI pending. |
| 13. TypeScript/lint/build/CI | PASS WITH WARNINGS (baseline) | Previous CI: 109 tests, TS/build pass, 8 lint warnings. Reconfirm final Phase 26 CI. |
| 14. Deployment/operations | BLOCKED | No exact Phase 26 Preview. Create Preview with isolated environment, inspect logs/health/rollback. |
| 15. Backup/restore/rollback | NOT VERIFIED | No controlled restore evidence. Run restore in isolated project and verify schema + storage objects; document retention/encryption and rollback path. |

## Safe release procedure

1. Wait for the Phase 26 CI run on the final branch SHA.
2. Provision an isolated Supabase environment (or explicitly authorize a compatible paid plan); never use Production for mutation tests.
3. Apply migrations to isolated schema, run SQL schema assertions and seed synthetic tenants/records/photos.
4. Deploy Preview from that exact SHA with isolated environment variables and record deployment SHA.
5. Run two-tenant RLS/API tests, 300-student measured batch, fault injection, archive hash verification, and authenticated browser workflow.
6. Run Android capture acceptance on a supported device; separately inspect print output if physical fidelity is required.
7. Perform a controlled backup restore in the isolated environment and verify storage/database consistency.
8. Review moderate dependency advisory and lint warnings; merge only after owner approval. Production deployment still requires explicit owner approval.
