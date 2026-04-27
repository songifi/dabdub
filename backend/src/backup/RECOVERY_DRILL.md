# Database Backup & Point-in-Time Recovery

## Overview

| Target | Value |
|--------|-------|
| RTO    | < 1 hour |
| RPO    | < 24 hours |
| Backup schedule | Daily at 02:00 UTC (pg_dump logical backup) |
| Retention | 30 days (configurable via `BACKUP_RETENTION_DAYS`) |
| Storage | S3 / Cloudflare R2 under `backups/` prefix |
| WAL archiving | Continuous, stored under `wal/` prefix |

---

## Backup Strategy

### 1. Daily Logical Backups (pg_dump)

`BackupService.runDailyBackup()` runs every day at 02:00 UTC via `@Cron`.

- Dumps the database in custom format (`-Fc`) to a temp file
- Uploads to S3/R2 as `backups/backup-<ISO-timestamp>.dump`
- Prunes objects older than `BACKUP_RETENTION_DAYS` (default 30)
- On failure: raises an `AdminAlert` (Slack + email) via `AdminAlertService`

### 2. WAL Archiving (Point-in-Time Recovery)

Configure the following in `postgresql.conf` on the database host:

```ini
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://<BACKUP_S3_BUCKET>/wal/%f --region <BACKUP_S3_REGION>'
restore_command = 'aws s3 cp s3://<BACKUP_S3_BUCKET>/wal/%f %p --region <BACKUP_S3_REGION>'
```

For Cloudflare R2, add `--endpoint-url https://<account_id>.r2.cloudflarestorage.com` to both commands.

WAL segments are archived continuously, enabling recovery to any point in time between daily backups (RPO < 24 h).

---

## Restore Procedures

### A. Full Restore from pg_dump (RTO target: < 1 hour)

```bash
# 1. Download the latest backup
aws s3 cp s3://<BACKUP_S3_BUCKET>/backups/<filename>.dump /tmp/restore.dump \
  --region <BACKUP_S3_REGION>

# 2. Create a fresh target database
psql -h <DB_HOST> -U <DB_USER> -c "CREATE DATABASE cheesepay_restore;"

# 3. Restore
pg_restore -Fc -h <DB_HOST> -U <DB_USER> -d cheesepay_restore /tmp/restore.dump

# 4. Verify row counts match expectations
psql -h <DB_HOST> -U <DB_USER> -d cheesepay_restore \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# 5. Promote / swap connection string in app config
```

### B. Point-in-Time Recovery (PITR)

```bash
# 1. Stop the primary Postgres instance

# 2. Restore the base backup (latest pg_dump or a base backup taken with pg_basebackup)
pg_restore -Fc -h <DB_HOST> -U <DB_USER> -d cheesepay_pitr /tmp/restore.dump

# 3. Create recovery.conf (Postgres < 12) or postgresql.conf entry (Postgres >= 12):
#    recovery_target_time = '2025-01-15 14:30:00 UTC'
#    restore_command = 'aws s3 cp s3://<BACKUP_S3_BUCKET>/wal/%f %p'

# 4. Start Postgres — it will replay WAL up to the target time

# 5. Confirm with: SELECT pg_is_in_recovery();  -- should return false after promotion
```

---

## Quarterly Recovery Drill

Run this drill every quarter to validate RTO/RPO targets.

### Checklist

- [ ] **Schedule**: Pick a low-traffic window (e.g., Saturday 06:00 UTC)
- [ ] **Download** the most recent `backups/*.dump` from S3/R2
- [ ] **Restore** to a staging/isolated Postgres instance using procedure A above
- [ ] **Verify** row counts and spot-check critical tables (`users`, `payments`, `settlements`)
- [ ] **Measure** total elapsed time — must be < 1 hour (RTO)
- [ ] **Confirm** backup age — must be < 24 hours old (RPO)
- [ ] **Document** results in the table below and commit to this file

### Drill Log

| Date | Backup file used | Restore time | Row count match | Outcome | Performed by |
|------|-----------------|--------------|-----------------|---------|--------------|
| _YYYY-QN_ | `backup-....dump` | _X min_ | ✅ / ❌ | Pass / Fail | @handle |

---

## Alerting

If the daily backup cron fails, `AdminAlertService` raises a `BACKUP_FAILURE` alert:
- Slack notification to `ADMIN_ALERT_SLACK_WEBHOOK_URL`
- Email to `ADMIN_ALERT_EMAIL`
- Dedupe key: `db-backup-daily` (re-alerts after cooldown if still failing)

Check `cron_job_logs` table for historical run status:

```sql
SELECT job_name, status, started_at, duration_ms, error_message
FROM cron_job_logs
WHERE job_name = 'db-backup'
ORDER BY started_at DESC
LIMIT 10;
```
