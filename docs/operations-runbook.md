# Operations runbook

## Severity and initial response

- **SEV-1:** suspected cross-tenant data exposure, leaked credentials, widespread data loss, or unusable core service. Stop release/promotion; restrict access using approved controls; preserve evidence; notify the designated owner/security contact immediately.
- **SEV-2:** broad login/database/storage outage, batch corruption, or repeated failed exports. Pause new release activity, collect sanitized request/job IDs and timestamps, and escalate to the application/Supabase/Vercel owner.
- **SEV-3:** isolated recoverable job failure or degraded performance. Retry only after inspecting persisted status and confirming idempotency.

Do not put student names, photographs, tokens, signed URLs, or raw request bodies in incident logs or tickets.

## Deployment verification

1. Confirm CI success for the exact commit.
2. Review full dependency audit and secret scan results.
3. Confirm migration review and isolated-environment validation.
4. Deploy to protected preview and verify `/api/health`, authentication, project ownership, private storage, rendering and export download.
5. Verify browser console/server logs for new errors using request IDs.
6. Promote only through the approved Vercel workflow after release owner approval; record deployment URL, commit SHA, operator and time.
7. No production traffic change is authorized by this runbook alone.

## Application rollback

Use Vercel deployment history to promote a known-good application deployment. Confirm the old code is compatible with the current database schema. Recheck authentication, tenant isolation, batch states and downloads. A deployment rollback does not roll back database changes.

## Failed migration

1. Stop further migration/deployment steps.
2. Capture migration name, commit SHA, sanitized error, migration history and schema state.
3. Determine whether the migration transaction committed partially and whether it is additive or destructive.
4. Do not reset production, manually delete data, or rerun SQL blindly.
5. Prefer a reviewed forward-fix for compatible additive changes. For data loss or destructive changes, invoke the disaster recovery procedure and require owner authorization.
6. Verify schema, RLS, storage policies and application compatibility in a separate environment before resuming.

## Authentication outage

- Check provider status and recent deployment/environment changes.
- Verify the environment's Supabase URL and publishable key are configured without printing values.
- Inspect sanitized auth errors and request IDs.
- Do not disable auth, broaden RLS, or switch to service-role credentials in the client.
- Roll back application-only changes if a verified regression is found; escalate provider-side failures to the owner.

## Database or Storage outage

- Check provider status, connection/resource metrics and server-side errors.
- Distinguish configuration readiness (`/api/health`) from actual dependency availability; the health route intentionally does not query the database.
- Avoid retry storms; use bounded retries and preserve persisted job state.
- Do not make private buckets public as a workaround. Escalate prolonged outages to the service owner.

## Failed batch jobs

- Capture project/batch/job IDs only where access-controlled; do not log student payloads.
- Inspect persisted statuses, attempts, lease timestamps and sanitized error categories.
- Confirm no active worker owns the lease before retrying.
- Use existing authenticated pause/resume/retry actions. Retries must be bounded and output fingerprints/idempotency must be checked.
- Reconcile eligible = success + failed + skipped + review-required before declaring completion.
- Current architecture is request-driven; closing the browser stops dispatching new groups until reopened/resumed, and there is no independent scheduled recovery worker for abandoned leases. Do not promise unattended recovery.

## Corrupt or incomplete ZIP export

- Mark the export unavailable for download until recreated and verified.
- Verify archive opens, entries match the manifest, no unsafe paths exist, and checksums match where available.
- Retry through the authorized export flow with bounded resource use. Never report success based only on a queued status.

## Suspected credential exposure or unauthorized access

- Treat as SEV-1. Preserve audit evidence and identify credential scope/time window.
- Notify the security/account owner. Rotate/revoke only with explicit authorization and a coordinated deployment plan; this runbook does not perform rotation.
- Review Git history, CI logs/artifacts, deployment variables, signed URL access, auth logs and affected project/object scope.
- Reissue narrowly scoped credentials, validate access and monitor. Notify affected parties according to approved incident/legal policy.

## Accidental deletion

- Stop cleanup/deletion jobs and preserve audit metadata.
- Identify exact project/object IDs, deletion time and retention/backup source.
- Restore into an isolated environment first; verify tenant policies and object checksums.
- Obtain owner authorization before restoring or modifying production data. Reconcile database metadata and Storage objects; they may require separate restoration.

## Monitoring and alert ownership

The repository does not establish a verified external error-reporting integration or delivered alerts. The service owner should configure Vercel deployment/build alerts and Supabase database/storage/auth alerts in the provider dashboards, assign an on-call recipient, and run a test notification. Record evidence and timestamps; do not mark alert delivery complete until tested.

## Routine operations

- Review deployment failures and full dependency audit weekly and before each release.
- Review failed/stale batch jobs and storage growth daily during active production use.
- Verify backup status and retention weekly.
- Perform an isolated restore drill at least quarterly or after material architecture changes.
- Review access, retention and incident contacts quarterly.
