# Environment configuration

## Environment separation

Maintain separate Supabase projects (or isolated Supabase branches with verified isolation) and separate credentials for local development, automated tests, preview, and production. Never point preview/test fixtures at production. Use synthetic student records and photos in non-production environments. Vercel environment scopes should be reviewed in the Vercel dashboard by an authorized owner; this repository cannot verify account-level settings.

## Variables

| Variable | Scope | Required | Description |
|---|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Yes | URL of the Supabase project for this environment; HTTPS outside local development. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Yes | Supabase publishable/legacy anon key only. Never use a service-role key. |
| `NEXT_PUBLIC_APP_URL` | Browser and server | Yes for canonical redirects | Canonical origin for the current environment, e.g. local `http://localhost:3000`, preview origin, or production HTTPS origin. |
| `GEMINI_API_KEY` | Server only | Optional unless template analysis is used | Secret for template analysis. Never prefix with `NEXT_PUBLIC_`. |
| `GEMINI_TEMPLATE_MODEL` | Server only | Optional | Model identifier; not a credential. |

See the sanitized root `.env.example`. Do not put real values in commits, issue comments, screenshots, or logs. Vercel environment values should be configured separately for Development, Preview, and Production, with least privilege and restricted project access.

## Validation

`lib/env.ts` validates the public Supabase URL and publishable key format when used. Production must use HTTPS. The `/api/health` probe returns only `ok` or `not_ready`; it checks required public configuration syntax and does not test live database/storage connectivity. Do not interpret it as a database health guarantee.

Before release, verify required variables in the Vercel project settings and run:
```sh
npm run typecheck
npm test
npm run lint
npm run build
curl -fsS https://YOUR-DEPLOYMENT/api/health
```
Replace the URL with the authorized preview or production origin. Do not run test fixtures against production.

## Secret exposure controls

Only Supabase publishable/anon credentials may use `NEXT_PUBLIC_`. Service-role keys, database passwords, provider API keys, signing secrets, and backup credentials must remain server-side and must never be placed in source control. No credential rotation is performed by this guide. If exposure is suspected, follow the incident runbook and obtain owner authorization before rotation.
