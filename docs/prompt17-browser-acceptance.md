# Prompt 17 — Real browser acceptance report

**Status: BROWSER ACCEPTANCE BLOCKED**  
**Assessment date:** 2026-10-09  
**Repository:** `fuelify12/Id-card`  
**Baseline branch / commit:** `main` / `3fe4df7798c6cffc7047e8896a463a18c4b6ce50`  
**Working branch:** `prompt-17-browser-acceptance`  
**Last code/test change before this report update:** `4f30d1f8f988bffd3d7419c892f545bcc5e6eddc`  
**Scope:** Read-only browser reconnaissance, Playwright suite implementation, and safe-environment assessment. No production data or traffic was changed.

## Executive result

The live browser reached the configured Vercel preview URL but was redirected to Vercel's SSO login page before the PrintForge application loaded. The Vercel project environment configuration also confirms that the same `NEXT_PUBLIC_SUPABASE_URL` variable targets Production, Preview, and Development; the decrypted public URL is `https://xdoenkusrakuyyxnnkff.supabase.co`, the existing Supabase project inspected as `Id-card`. Therefore the available preview is **not isolated from the production Supabase project**. All mutating browser tests were stopped before sign-in or form submission.

This is a safety block, not evidence that the application workflow failed or passed. Do not create test students, upload test photos, run batch generation, or create exports on the current preview.

## Environment inventory

| Item | Verified observation |
|---|---|
| GitHub baseline | `main` at `3fe4df7798c6cffc7047e8896a463a18c4b6ce50` |
| Working branch | `prompt-17-browser-acceptance` |
| Framework | Next.js App Router |
| Existing unit test runner | Vitest |
| Browser test runner added | Playwright Test, Chromium project |
| Package lockfile | No committed `package-lock.json`; CI currently uses `npm install` |
| Local working tree | Not available for inspection: the execution container could not resolve `github.com`, so no local clone was created |
| Vercel project | `printforge-id-card-studio`, Next.js, Node.js `24.x` |
| Inspected preview deployment | `dpl_2JDyX9Ts77GSC2ranX9crA3fh4Xu` |
| Preview URL | `https://printforge-id-card-studio-304vhak1z-yash-6966.vercel.app` |
| Preview's source commit | `5d8166ae562bb83f834bb11f021a29ac119a773b` — older than Prompt 17 changes |
| Deployment target | Vercel inventory reports `target: null` (preview), state `READY` |
| Access control | Vercel SSO protection enabled for non-custom domains |
| Supabase project used by all three Vercel targets | `xdoenkusrakuyyxnnkff` (`Id-card`) |
| Authenticated browser profile | No saved sign-in for the application |
| Isolated disposable preview | **Not available / not established** |

The Vercel preview URL does not correspond to the current Prompt 17 branch. The configured Supabase URL is shared across production, preview and development targets, and it resolves to the production project. This is sufficient to block data-mutating E2E execution. No Supabase environment values other than the public project URL were retrieved for this assessment; publishable keys, passwords and tokens are not included in this report.

## Actual browser observation

A live browser automation session opened the preview URL without signing in or submitting any form.

- **Observed redirect:** Vercel login / SSO page.
- **Page title:** `Log in to Vercel`.
- **Visible heading:** `Log in to Vercel`.
- **Application UI:** Not reached.
- **Console / network:** Browser agent reported no visible console errors or failed network requests on the Vercel login page.
- **Data mutation:** None.
- **Evidence/run:** [Read-only browser run](https://agent.tinyfish.ai/runs/783b70da-70be-4d3a-9cdb-fa7bf2dd2cce).

Interpretation: Vercel's access gate behaved as configured for an anonymous visitor. This does **not** verify PrintForge's own authentication form, project authorization, or RLS.

## Changes on the feature branch

- `playwright.config.ts`: Chromium browser project, bounded test timeouts, one CI worker, one retry on CI, HTML report, screenshots/traces/videos on failure, optional local web server.
- `tests/e2e/smoke.spec.ts`: read-only anonymous root/protected-route checks and a mobile-width overflow check; attaches sanitized console/network diagnostics.
- `tests/e2e/acceptance-fixture.ts`: runtime-generated 300-row fictional XLSX, synthetic template artwork, synthetic portrait-like images, and a JSON outcome manifest. Special cases include Devanagari/Latin/long names, optional values, duplicate canonical serials, missing serial/name, an omitted photo, duplicate photo bytes, corrupt bytes, and a low-resolution image. Fixture files are written to a temporary directory and are not committed.
- `tests/e2e/acceptance.spec.ts`: explicitly gated, real-UI test for sign-in, project creation/persistence, template upload, 300-row import, representative photo upload/matching, and reload persistence. It is skipped unless an isolated test project, distinct production/test project refs, test account, explicit mutation opt-in, and exact preview URL are configured.
- `tests/e2e/README.md`: safety requirements, setup commands, limitations and report locations.
- `.github/workflows/browser-smoke.yml`: manual, read-only smoke workflow; no production deploy or promotion step.
- `package.json`: Playwright dependency and E2E scripts.
- `vitest.config.ts`: limits Vitest discovery to `*.test.ts(x)`, so Playwright `*.spec.ts` files are not accidentally run by Vitest.
- `.gitignore`: ignores Playwright reports, traces, videos, screenshots and cache output.
- `.github/workflows/phase8-rendering-checks.yml`: corrected its invalid Supabase publishable-key placeholder after the first PR run failed the production build with `Supabase publishable key has an unsupported format`.

The full persisted 300-card batch, crop approval, validation correction, ZIP download, two-tenant authorization, session expiry, camera permission behavior and final archive hashes are **not yet implemented as completed browser assertions**. They remain explicitly outside the currently executable test journey rather than being represented as passing.

## Test result classification

| Test / gate | Status | Evidence |
|---|---|---|
| Live anonymous preview visit | **PASSED — limited** | Real browser loaded the Vercel SSO page; no app access or mutation |
| Vercel SSO redirect for anonymous browser | **PASSED — limited** | Final URL and visible login heading observed |
| PrintForge login and authenticated session | **BLOCKED** | No saved signed-in profile; app never reached behind SSO |
| Playwright suite execution | **BLOCKED** | Local clone attempt failed because the execution environment could not resolve `github.com`; no Playwright browser run or HTML report has been claimed |
| Repository CI on code head `4f30d1f8f988bffd3d7419c892f545bcc5e6eddc` | **PASSED** | [Run 37927199069](https://github.com/fuelify12/Id-card/actions/runs/37927199069): 9 Vitest files / 59 tests passed, TypeScript, ESLint, production build, dependency gate, repository secret hygiene and client-bundle check passed |
| Existing Phase 8 rendering CI | **PASSED after fix** | [Run 37927199105](https://github.com/fuelify12/Id-card/actions/runs/37927199105): the workflow's invalid dummy publishable key was corrected; build validation then passed |
| Earlier CI attempts | **TRANSIENT FAILURES, RE-RUN PASSED** | [Run 37926862925](https://github.com/fuelify12/Id-card/actions/runs/37926862925) failed because its old workflow placeholder was invalid; [run 37927138271](https://github.com/fuelify12/Id-card/actions/runs/37927138271) encountered a Gitleaks action error (`stderr is not empty`) before the later run passed |
| Project creation and persistence | **BLOCKED** | Requires authenticated test account and isolated Supabase |
| Template upload / private storage | **BLOCKED** | Current preview targets production Supabase |
| 300-row import and row reconciliation in browser | **BLOCKED** | Fixture and test implemented; not submitted |
| Photo upload / persisted matching | **BLOCKED** | Test implemented for a representative synthetic subset; not submitted |
| Crop approval / final render | **NOT TESTED** | No app session or isolated environment |
| Persisted batch worker / 300-card run | **NOT TESTED** | No app session or isolated environment |
| Validation correction / stale output | **NOT TESTED** | No app session or isolated environment |
| ZIP export/download/hash verification | **NOT TESTED** | No app session or isolated environment |
| Cross-tenant RLS and storage authorization | **BLOCKED** | No two-tenant isolated environment |
| Mobile PrintForge UI | **BLOCKED** | Browser was limited to Vercel SSO page; no app viewport test |
| Production deployment / promotion | **NOT PERFORMED** | No deployment, promotion, traffic or production data changes |

### Commands / execution evidence

Implemented commands:

```sh
npm install --no-audit --no-fund
npx playwright install chromium
PLAYWRIGHT_BASE_URL=https://your-inspected-preview.example npm run test:e2e:smoke
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:acceptance
```

The live browser action was performed through the connected browser automation session, not through Playwright. The local attempt to clone the repository and run Playwright could not start because DNS resolution for `github.com` failed in the execution environment. Consequently, there are no verified Playwright pass counts, timings, screenshots from Playwright, or HTML report artifacts for this run.

## Required owner actions to unblock full acceptance

1. Create or authorize a dedicated Supabase test project/branch with isolated database, storage buckets and auth users. Ensure the test project's project ref differs from production.
2. Configure the Vercel Preview environment to use that isolated project; do not reuse the current shared production URL variable. Verify the actual deployment's runtime configuration before running mutating tests.
3. Produce a new preview deployment from `prompt-17-browser-acceptance`, confirm its exact commit and URL, and inspect its environment configuration before use.
4. Provide access to an authorized test account through a supported browser profile or Vercel access-control configuration. Never send passwords in chat.
5. Install dependencies and run the Playwright smoke suite; resolve type/lint/test failures without weakening assertions.
6. Complete the end-to-end test journey for crop approval, rendering, persisted 300-card batch, validation, verified ZIP download and reload/session behavior.
7. Use two synthetic tenants to verify project, student, template, photo, batch and export isolation.
8. Keep separate acceptance gates for worker recovery, private-storage integrity, physical print, monitoring alerts and backup restore.

## Final decision

**BROWSER ACCEPTANCE BLOCKED.** The Playwright suite and reproducible synthetic fixture have been added, and one live read-only browser reconnaissance run was completed. The actual application workflow could not safely be exercised because the preview uses the production Supabase project and the application is behind an SSO gate with no signed-in test profile available. No data-mutating acceptance test was run, no preview was promoted, and production was not changed.


## CI quality-gate results

The final code head before this report-only update, `4f30d1f8f988bffd3d7419c892f545bcc5e6eddc`, passed the main GitHub Actions CI run [37927199069](https://github.com/fuelify12/Id-card/actions/runs/37927199069). The log confirms **9 Vitest files and 59 tests passed**, TypeScript passed, ESLint passed, the optimized production build compiled successfully, the production dependency vulnerability gate passed, repository secret hygiene passed, and the client-bundle security check passed. The full dependency report still listed **3 moderate severity vulnerabilities**.

The existing Phase 8 rendering workflow initially failed because its CI-only environment value `ci-placeholder-not-a-secret` did not match the application's supported Supabase publishable-key format. The placeholder was changed to the same syntactically valid CI-only value used by the main workflow. The subsequent Phase 8 run [37927199105](https://github.com/fuelify12/Id-card/actions/runs/37927199105) passed. No live key was changed.

An earlier main CI attempt at code commit `29edb2fe34386b51e2d64ce05eef350e34881cf3` failed in the Gitleaks action with `failed to scan Git repository: stderr is not empty`. A subsequent run on the later code head passed all security steps. This is recorded rather than hidden.

The report-only commit will trigger its own CI run; no claim is made that that new run has finished. Passing repository CI is not a substitute for executing the Playwright browser suite against an isolated preview.
