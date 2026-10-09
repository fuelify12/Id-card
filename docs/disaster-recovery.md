# Disaster recovery

## Status and assumptions

This is a recovery plan, not evidence of a successful restore. No backup restore or production recovery was performed during Phase 15. An owner must confirm the active Supabase plan, backup/PITR features, retention, region, and storage-object recovery mechanism in the Supabase dashboard and contract. Database backups do not automatically prove that Storage objects are backed up.

## Proposed initial objectives (owner approval required)

- **RPO:** 24 hours for database metadata, subject to verified scheduled backups and their retention.
- **RTO:** 8 business hours to restore a usable application and database into a recovery environment.
- **Storage objects:** target RPO/RTO cannot be committed until object backup/replication and restore procedures are configured and tested.

These are proposals, not guaranteed service levels. If business needs require smaller data-loss windows, configure and verify suitable backup/PITR and object recovery before release.

## Inventory to protect

- Supabase schema and ordered migration files.
- School/project, student, template, photo, batch, processing, validation, card and export metadata.
- Private Storage objects: original templates, original/processed photos, generated card files and ZIP archives.
- Vercel project configuration, domain and environment-variable names (store secret values only in the approved secret manager).
- GitHub repository, branch protections, CI workflow and release commit IDs.
- Operational runbooks and retention settings.

## Recovery procedure

1. Declare incident, record start time, affected project/service, incident lead and current deployment commit. Preserve logs and audit evidence.
2. Stop risky writes or batch dispatch only through authorized operational controls; do not disable RLS or broadly expose buckets.
3. Create a separate recovery Supabase project/environment. Never restore over production during a drill.
4. Restore the selected database backup using the supported Supabase plan/tooling. Record backup timestamp and actual recovery duration.
5. Restore Storage objects from the separately configured object backup/export. Reconcile object paths, metadata, sizes and checksums. If no object backup exists, declare the corresponding recovery gap rather than assuming database restore recovered files.
6. Apply only the migration sequence appropriate to the restored backup; inspect migration history and schema compatibility. Never blindly rerun non-idempotent SQL.
7. Configure isolated recovery secrets and deploy the compatible application commit to a protected recovery deployment.
8. Verify login, RLS using two synthetic tenants, private Storage denial/allow behavior, templates/photos/card object reads, batch states, export checksums and core workflow smoke tests.
9. Record missing rows/objects, data-loss window, elapsed time, errors, and whether proposed RPO/RTO were met. Obtain owner approval before any production failover or data restoration.
10. Preserve evidence and schedule corrective actions; do not declare recovery complete until application and object data are both verified.

## Drill checklist

- [ ] Backup timestamp and retention confirmed from provider.
- [ ] Separate recovery environment provisioned.
- [ ] Database restore executed and duration recorded.
- [ ] Storage object recovery executed and object checksums reconciled.
- [ ] Migration history and schema verified.
- [ ] Two-tenant RLS and Storage policies tested.
- [ ] Authenticated workflow and ZIP integrity smoke tests passed.
- [ ] Actual RPO/RTO compared with owner-approved targets.
- [ ] Findings and owner sign-off recorded.

## Important limitation

Until the drill above is executed with real authorized backups and isolated resources, restore capability is **NOT VERIFIED**. Do not claim that an available provider backup alone proves complete application recovery.
