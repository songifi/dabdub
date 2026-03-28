# Database — Indexing Strategy & Query Optimization

## Migration Safety Rules (Zero-Downtime)

These rules apply to all production migrations.

1. Never `DROP COLUMN` in the same release where code stops using it.
   Use a two-release (or three-phase) strategy.
2. Always use `ADD COLUMN IF NOT EXISTS`.
3. Always use `CREATE INDEX CONCURRENTLY` (never plain `CREATE INDEX`).
4. Never rename columns in-place.
   Add new column, backfill, migrate code, then drop old column later.

### Lock Safety

- Set `lock_timeout = '5s'` at the start of every migration `up()`.
- For migrations creating indexes concurrently, set `transaction = false` on the migration class (Postgres requirement).

### Migration Helper

Use `MigrationHelper` from [backend/src/database/migration.helper.ts](backend/src/database/migration.helper.ts):

- `MigrationHelper.addColumnIfNotExists(runner, table, column, definition)`
- `MigrationHelper.dropColumnIfExists(runner, table, column)`
- `MigrationHelper.createIndexConcurrently(runner, name, table, columns)`

### Template: Safe Column Addition (3-Phase)

Phase 1 (schema)

```ts
// migration phase 1
await queryRunner.query("SET lock_timeout = '5s'");
await MigrationHelper.addColumnIfNotExists(
  queryRunner,
  'users',
  'new_col',
  'text NULL',
);
```

Code phase

```ts
// app code update
// write to both old_col and new_col, read from old_col with fallback to new_col
```

Phase 2 (backfill + enforce)

```ts
// migration phase 2
await queryRunner.query("SET lock_timeout = '5s'");
await queryRunner.query(
  `UPDATE "users" SET "new_col" = "old_col" WHERE "new_col" IS NULL`,
);
await queryRunner.query(
  `ALTER TABLE "users" ALTER COLUMN "new_col" SET NOT NULL`,
);
```

Phase 3 (cleanup after code no longer uses old column)

```ts
// migration phase 3 (future release)
await queryRunner.query("SET lock_timeout = '5s'");
await MigrationHelper.dropColumnIfExists(queryRunner, 'users', 'old_col');
```

### Template: Safe Index Creation

```ts
export class AddUsersEmailIndex1700000000000 implements MigrationInterface {
  name = 'AddUsersEmailIndex1700000000000';
  public transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await MigrationHelper.createIndexConcurrently(
      queryRunner,
      'IDX_users_email',
      'users',
      ['email'],
      true,
    );
  }
}
```

## Overview

As the platform scales, query performance becomes critical. This document describes the indexing strategy, documents which indexes serve which queries, and outlines the maintenance schedule.

**Key principle:** Every index is created with `CREATE INDEX CONCURRENTLY` to avoid locking existing data.

## Index Strategy

### User of Indexes

- **Unique constraints** (email, username, phone, referral_code) enable O(1) lookups and prevent duplicates
- **Composite indexes** (user_id, created_at) support multi-column filtering and sorting with single index scan
- **Partial indexes** (WHERE condition) reduce size for cleanup queries (e.g., `revoked_at IS NOT NULL`)
- **Descending indexes** (created_at DESC) avoid reverse scans when sorting newest first

### Index Naming Convention

All indexes follow the pattern: `IDX_{table}_{column1}_{column2}_{...}`

Example: `IDX_transactions_user_created_at` covers the composite `(user_id, created_at DESC)` index.

---

## Per-Table Indexing Strategy

### `users` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_users_id` | `id` | Unique Primary Key | 1 | Lookup by user ID | Already exists |
| `IDX_users_email` | `email` | Unique | 1 | Login, user lookup by email | Already exists (entity constraint) |
| `IDX_users_username` | `username` | Unique | 1 | Profile lookup by @username | Already exists (entity constraint) |
| `IDX_users_phone` | `phone` | Unique | 1 | Phone verification, SMS lookup | Already exists (entity constraint) |
| `IDX_users_referral_code` | `referral_code` (unique) | Unique, Partial | 1 | Referral reward lookup | Added by migration; partial (WHERE referral_code IS NOT NULL) |
| `IDX_users_tier_is_active` | `(tier, is_active)` | Composite | ~10² | Tier-based user lists, active merchant lists | Added by migration |
| `IDX_users_created_at_desc` | `created_at DESC` | Desc | N | Admin user listing, sorting by signup date | Added by migration |

**Admin Queries:**
```sql
-- Find tier-based user count
SELECT COUNT(*) FROM users WHERE tier = 'GOLD' AND is_active = true;

-- List all users sorted by signup (pagination)
SELECT * FROM users ORDER BY created_at DESC LIMIT 20;

-- Find active merchants
SELECT * FROM users WHERE tier IN ('GOLD', 'PLATINUM') AND is_merchant = true AND is_active = true;
```

---

### `transactions` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_transactions_id` | `id` | Unique Primary Key | 1 | Lookup by transaction ID | Already exists |
| `IDX_transactions_user_created_at` | `(user_id, created_at DESC)` | Composite | 10k+ | Activity feed (all user transactions) | **Most critical index** — supports pagination, filtering by date range |
| `IDX_transactions_user_type_created_at` | `(user_id, type, created_at DESC)` | Composite | 10k+ | Type-filtered activity feed (e.g., deposits only) | Extends primary activity feed index |
| `IDX_transactions_reference` | `reference` (unique) | Unique, Partial | 1 | Idempotency check, duplicate detection | Added by migration; partial (WHERE reference IS NOT NULL) |
| `IDX_transactions_status_created_at` | `(status, created_at DESC)` | Composite | 1k+ | Background worker polling (find PENDING transactions) | Added by migration |
| `IDX_transactions_counterparty_username` | `counterparty_username` | Regular, Partial | 10k+ | Username search for transaction history | Added by migration; partial (WHERE counterparty_username IS NOT NULL) |

**Common Queries:**
```sql
-- Activity feed pagination (most common)
SELECT * FROM transactions 
  WHERE user_id = 'user-123' 
  ORDER BY created_at DESC 
  LIMIT 20 OFFSET 0;
-- Uses: IDX_transactions_user_created_at

-- Filtered activity feed (by type)
SELECT * FROM transactions 
  WHERE user_id = 'user-123' AND type = 'TRANSFER' 
  ORDER BY created_at DESC 
  LIMIT 20;
-- Uses: IDX_transactions_user_type_created_at

-- Worker polling
SELECT id, status FROM transactions 
  WHERE status = 'PENDING' 
  ORDER BY created_at DESC 
  LIMIT 100;
-- Uses: IDX_transactions_status_created_at
```

**Estimated Cardinality:**
- High-volume users: 100–1000 transactions
- Popular merchants: 10k+ transactions
- Platform total: 1M+ transactions

---

### `refresh_tokens` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_refresh_tokens_id` | `id` | Unique Primary Key | 1 | Lookup by token ID | Already exists |
| `IDX_refresh_tokens_user_id` | `user_id` | Regular | 10k+ | Find all sessions for a user | Already exists (entity @Index decorator) |
| `IDX_refresh_tokens_token_hash` | `token_hash` (unique) | Unique | 1 | Token verification during refresh | Added by migration |
| `IDX_refresh_tokens_expires_at` | `expires_at` | Regular, Partial | 1k+ | Cleanup: find expired tokens | Added by migration; partial (WHERE expires_at < NOW()) |
| `IDX_refresh_tokens_revoked_at` | `revoked_at` | Regular, Partial | 1k+ | Cleanup: find revoked tokens older than 30 days | Added by migration; partial (WHERE revoked_at IS NOT NULL) |

**Cleanup Strategy:**
```sql
-- Weekly job: delete tokens expired more than inherent expiry window
DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days';

-- Weekly job: delete revoked tokens older than N days
DELETE FROM refresh_tokens 
  WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days';
```

---

### `otps` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_otps_id` | `id` | Unique Primary Key | 1 | Lookup by OTP ID | Already exists |
| `IDX_otps_email_type_created_at` | `(email, type, created_at DESC)` | Composite | 10k+ | OTP verification: find latest OTP for email + type | Added by migration |
| `IDX_otps_expires_at` | `expires_at` | Regular, Partial | 1k+ | Cleanup: find expired OTPs | Added by migration; partial (WHERE expires_at < NOW()) |

**Verification Query:**
```sql
SELECT code FROM otps 
  WHERE email = 'user@example.com' AND type = 'EMAIL_VERIFY' 
  ORDER BY created_at DESC 
  LIMIT 1;
-- Uses: IDX_otps_email_type_created_at
```

**Cleanup:**
```sql
DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '7 days';
```

---

### `waitlist_entries` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_waitlist_entries_id` | `id` | Unique Primary Key | 1 | Lookup by entry ID | Already exists |
| `IDX_waitlist_entries_email` | `email` (unique) | Unique | 1 | Duplicate prevention | Added by migration |
| `IDX_waitlist_entries_referral_code` | `referral_code` (unique) | Unique, Partial | 1 | Referral link activation | Added by migration; partial (WHERE referral_code IS NOT NULL) |
| `IDX_waitlist_entries_points_created_at` | `(points DESC, created_at ASC)` | Composite | 10k+ | Leaderboard ranking | Added by migration |

**Leaderboard Query:**
```sql
SELECT rank, email, points FROM (
  SELECT 
    ROW_NUMBER() OVER (ORDER BY points DESC, created_at ASC) as rank,
    email,
    points
  FROM waitlist_entries
) ranked
WHERE rank <= 100;
-- Uses: IDX_waitlist_entries_points_created_at
```

---

### `settlements` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_settlements_id` | `id` | Unique Primary Key | 1 | Lookup by settlement ID | Already exists |
| `IDX_settlements_merchant_created_at` | `(merchant_id, created_at DESC)` | Composite | 1k+ | Settlement history per merchant | Added by migration |
| `IDX_settlements_status_created_at` | `(status, created_at DESC)` | Composite | 100+ | Background worker: find pending settlements | Added by migration |

**Settlement History:**
```sql
SELECT * FROM settlements 
  WHERE merchant_id = 'merchant-123' 
  ORDER BY created_at DESC 
  LIMIT 20;
-- Uses: IDX_settlements_merchant_created_at
```

**Worker Polling:**
```sql
SELECT id, amount FROM settlements 
  WHERE status = 'PENDING' 
  ORDER BY created_at DESC 
  LIMIT 50;
-- Uses: IDX_settlements_status_created_at
```

---

### `webhook_deliveries` Table

| Index Name | Columns | Type | Cardinality | Query Pattern | Notes |
|---|---|---|---|---|---|
| `PK_webhook_deliveries_id` | `id` | Unique Primary Key | 1 | Lookup by delivery ID | Already exists |
| `IDX_webhook_deliveries_created_at` | `created_at` | Regular, Partial | 1k+ | Cleanup: find logs older than 90 days | Added by migration; partial (WHERE created_at < NOW() - INTERVAL 90 days) |

---

## Query Logging & Performance Monitoring

### Slow Query Logging

TypeORM is configured to log queries exceeding **1 second** in non-production environments:

```typescript
// src/database/database.module.ts
maxQueryExecutionTime: isDev ? 1000 : undefined, // Log queries > 1s in dev/test
```

**Output Example:**
```
Query: SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20 -- took 2500ms
```

This helps identify:
- Missing or ineffective indexes
- N+1 query patterns
- Queries against unindexed columns

### Monitoring in Production

In production, slow query logging is disabled by default to avoid performance overhead. Consider:

1. **PostgreSQL `log_min_duration_statement`** (database-level setting)
   ```sql
   SET log_min_duration_statement = 1000; -- Log queries > 1s
   ```

2. **Application Performance Monitoring (APM)** tools:
   - Datadog
   - New Relic
   - AWS CloudWatch

3. **Periodic Manual Analysis**
   ```sql
   SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;
   ```

---

## Maintenance Schedule

### Weekly Cleanup (Every Sunday, 2:00–2:30 AM UTC)

**Service:** `DatabaseMaintenanceService` (in `src/database/database-maintenance.service.ts`)

Runs via `@nestjs/schedule` `@Cron` decorators:

| Time | Job | Command | Notes |
|---|---|---|---|
| 2:00 AM | Clean expired OTPs | `DELETE FROM otps WHERE expires_at < NOW() - INTERVAL '7 days'` | Removes OTPs older than 7 days |
| 2:15 AM | Clean revoked refresh tokens | `DELETE FROM refresh_tokens WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days'` | Removes revoked tokens older than 30 days |
| 2:30 AM | Clean old webhook logs | `DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL '90 days'` | Removes logs older than 90 days |

### Expected Data Reduction

**OTPs:**
- Typical generation: 100–500 per day (signup, password reset, 2FA)
- Retention: 7 days → ~3.5k rows stored
- Monthly cleanup: ~3.5k rows deleted

**Refresh Tokens:**
- Typical generation: 1k–5k per day
- Retention: 30 days (post-revocation) → ~150k rows stored
- Weekly cleanup: reduced via rolling deletion

**Webhook Logs:**
- Typical generation: 10k–50k per day
- Retention: 90 days → ~5M rows stored
- monthly cleanup: ~1.5M rows deleted

### Manual Trigger

Admins can trigger cleanup manually via:

```typescript
// In any injectable service
constructor(private db: DatabaseMaintenanceService) {}

async cleanup() {
  await this.db.runAllCleanupJobs();
  // Returns void; logs progress to Winston
}
```

---

## Index Maintenance

### Monitoring Index Health

Check index bloat and unused indexes:

```sql
-- Find unused indexes (never scanned)
SELECT schemaname, tablename, indexname 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY indexrelname;

-- Check index size
SELECT 
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find indexes on columns with low cardinality
SELECT t.relname, a.attname, (SELECT COUNT(DISTINCT v) FROM (SELECT attvals as v FROM pg_stats WHERE tablename = t.relname AND attname = a.attname) s) as distinct_values
FROM pg_class t JOIN pg_attribute a ON t.oid = a.attrelid
WHERE t.relkind = 'r' AND a.attnum > 0;
```

### VACUUM and ANALYZE

PostgreSQL needs regular maintenance:

```sql
-- Manual vacuum (safe in busy tables)
VACUUM ANALYZE users;
VACUUM ANALYZE transactions;

-- Or set autovacuum settings per table (already auto-configured by default)
ALTER TABLE transactions SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE transactions SET (autovacuum_analyze_scale_factor = 0.02);
```

### Index Rebuilding

If an index becomes bloated:

```sql
-- Rebuild index without locking table
REINDEX INDEX CONCURRENTLY IDX_transactions_user_created_at;
```

---

## Estimated Space Usage

| Index | Est. Size (1M rows) | Notes |
|---|---|---|
| `IDX_transactions_user_created_at` | ~100 MB | Composite key + 2 columns |
| `IDX_transactions_user_type_created_at` | ~150 MB | Extended version of above |
| `IDX_waitlist_entries_points_created_at` | ~10 MB | Small table but frequent sorting |
| `IDX_settlements_status_created_at` | ~5 MB | Small table |
| `IDX_refresh_tokens_expires_at` | ~20 MB | Partial index |
| All user indexes | ~30 MB | Email, username, referral, tier, date |

**Total: ~400 MB for 1M+ transactions**

---

## Adding New Indexes

When adding a new query pattern:

1. **Identify the query** and its columns
   
   ```sql
   SELECT * FROM merchants WHERE category = $1 AND is_verified = true LIMIT 20;
   ```

2. **Create index non-blocking**
   
   ```sql
   CREATE INDEX CONCURRENTLY IDX_merchants_category_verified ON merchants (category, is_verified);
   ```

3. **Add to migration** for reproducibility
   
   ```typescript
   // In src/database/migrations/AddNewIndex.ts
   await queryRunner.query(`CREATE INDEX CONCURRENTLY ...`);
   ```

4. **Test performance** before/after: Use EXPLAIN ANALYZE

   ```sql
   EXPLAIN ANALYZE SELECT * FROM merchants WHERE category = $1 AND is_verified = true;
   ```

5. **Document in this file** with query pattern and cardinality

---

## Performance Baseline

Set performance expectations for key queries:

| Query | Expected Time (Indexed) | Expected Time (No Index) | Cardinality |
|---|---|---|---|
| User login (email lookup) | < 1ms | 100–500ms | 100k+ |
| Activity feed (20 items) | 5–15ms | 500–2000ms | 1M+ |
| Type-filtered feed | 5–20ms | 1000–5000ms | 1M+ |
| Settlement worker poll (50 items) | 1–5ms | 100–500ms | 100k+ |
| Leaderboard top 100 | 10–30ms | 500–2000ms | 100k+ |

**Regression Detection:** If query time exceeds 10% of baseline, investigate missing index.

---

## Troubleshooting

### Query Performance Issues

1. **Check for full table scan**
   ```sql
   EXPLAIN ANALYZE SELECT ... -- Look for "Seq Scan" instead of "Index Scan"
   ```

2. **Check index exists and is used**
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'transactions';
   ```

3. **Check query statistics**
   ```sql
   SELECT query, calls, mean_time FROM pg_stat_statements 
   WHERE query LIKE '%transactions%' ORDER BY mean_time DESC;
   ```

4. **Force index usage (if optimizer is wrong)**
   ```sql
   SET enable_seqscan = off; -- Last resort!
   SELECT ... -- Your query
   SET enable_seqscan = on;
   ```

### High Memory Use

Check for bloated indexes:

```sql
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

If index > 500 MB and idx_scan = 0, consider dropping it.

### Slow Cleanup Jobs

Monitor cleanup job performance:

```sql
-- Check vacuum progress
SELECT * FROM pg_stat_progress_vacuum;

-- Check index build progress
SELECT * FROM pg_stat_progress_create_index;
```

If cleanup is slow, consider increasing `maintenance_work_mem` in PostgreSQL config:

```sql
ALTER SYSTEM SET maintenance_work_mem = '2GB';
SELECT pg_reload_conf();
```

---

## References

- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [TypeORM Query Performance](https://typeorm.io/select-query-builder)
- [NestJS Schedule Module](https://docs.nestjs.com/techniques/task-scheduling)
- [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
