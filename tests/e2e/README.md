# Prompt 17 browser acceptance

## Safety gate

The connected Vercel project currently shares its `NEXT_PUBLIC_SUPABASE_URL` environment variable across Production, Preview, and Development targets. The observed URL resolves to the existing Supabase project `xdoenkusrakuyyxnnkff`, which is the project inspected as `Id-card`. Therefore, current previews are **not demonstrated to be isolated** and mutating acceptance tests must not run against them.

The mutating acceptance test is skipped unless all required settings are present and will throw before browser actions if the configured test project ref equals the production project ref:

- `PLAYWRIGHT_BASE_URL`: exact disposable preview URL
- `E2E_ISOLATED_ENV=true`
- `E2E_ALLOW_MUTATIONS=true`: explicit owner opt-in to create synthetic test data
- `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`: credentials for an authorized synthetic test account; never commit these
- `E2E_SUPABASE_PROJECT_REF`: verified test database project ref
- `E2E_PRODUCTION_SUPABASE_PROJECT_REF`: production project ref used only for the safety comparison

Do not set these flags until the preview's actual Supabase database, storage, and authentication configuration are independently verified as isolated. Vercel SSO may also need an authorized test profile/account before the app UI can be reached. Never paste credentials into chat or store them in Git.

## Install and run

```sh
npm install --no-audit --no-fund
npx playwright install chromium
PLAYWRIGHT_BASE_URL=https://your-inspected-preview.example npm run test:e2e:smoke
```

For a local Next.js server, start `npm run dev` in one terminal and run the smoke suite with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:smoke` in another. A local app still needs a safe test Supabase project; placeholder credentials are not evidence of a working authenticated integration.

The full acceptance journey is deliberately skipped until the isolation and test-account gates above are satisfied:

```sh
PLAYWRIGHT_BASE_URL=https://your-isolated-preview.example \
E2E_ISOLATED_ENV=true E2E_ALLOW_MUTATIONS=true \
E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
E2E_SUPABASE_PROJECT_REF=your-test-ref \
E2E_PRODUCTION_SUPABASE_PROJECT_REF=your-production-ref \
npm run test:e2e:acceptance
```

The fixture is generated at runtime and writes only to the OS temporary directory. It contains 300 fictional rows, Devanagari and Latin names, long names, optional values, duplicate canonical serials, a missing serial, a missing name, generated synthetic artwork and synthetic portrait-like images. It also includes a byte-identical duplicate, corrupt image bytes, a low-resolution image, and an intentionally missing photo. No generated records or images are committed.

## What is and is not covered

- `smoke.spec.ts` checks anonymous root/protected-route behavior and a mobile viewport without submitting forms.
- `acceptance.spec.ts` uses the actual UI and real sign-in to create a synthetic project, upload a generated template, import the 300-row spreadsheet, verify the import preview and persistence after reload, and attach the synthetic manifest to the test report.
- This is not yet a full 300-card persisted batch, crop approval, export/download or two-tenant RLS test. Those steps remain blocked until the isolated environment and test account exist; do not interpret this suite as passing those gates.

HTML reports, screenshots, traces, videos and attachments are emitted under `playwright-report/` and `test-results/`. These folders are ignored by Git and must be reviewed before sharing because browser traces may contain sensitive page content.
