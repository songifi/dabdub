import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddPerformanceIndexes
 *
 * Strategy: Add missing indexes for all high-cardinality lookups, filtering, and sorting.
 * Uses CREATE INDEX CONCURRENTLY to avoid locking existing data.
 *
 * Performance targets:
 *   - User lookups (email, username, referral_code): O(1)
 *   - Tier-based queries: O(1) + filter
 *   - User admin list (sorted): Index scan
 *   - Transaction activity feed: Index scan on (user_id, created_at DESC)
 *   - Transaction type filtering: Index scan
 *   - Leaderboard ordered: Index scan on (points DESC, created_at ASC)
 *   - Settlement processing: Cursor scan on (status, created_at DESC)
 *   - OTP cleanup: Sequential scan with index on expires_at
 *   - Refresh token cleanup: Sequential scan with index on revoked_at
 */
export class AddPerformanceIndexes1700000000006 implements MigrationInterface {
  name = 'AddPerformanceIndexes1700000000006';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    // ====================================================================
    // Users Table Indexes
    // ====================================================================
    // NOTE: email unique index already exists via entity constraint
    // NOTE: username unique index already exists via entity constraint
    // NOTE: phone unique index already exists via entity constraint

    // Referral code lookups (when/if referral feature is added)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_referral_code"
       ON "users" ("referral_code") WHERE "referral_code" IS NOT NULL`,
    );

    // Tier-based user queries (list users by tier + activity status)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_tier_is_active"
       ON "users" ("tier", "is_active")`,
    );

    // Admin user list sorted by creation time
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_created_at_desc"
       ON "users" ("created_at" DESC)`,
    );

    // ====================================================================
    // Transactions Table Indexes
    // ====================================================================

    // Activity feed: all transactions by user, sorted by time (most common query)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_transactions_user_created_at"
       ON "transactions" ("user_id", "created_at" DESC)`,
    );

    // Type-filtered activity feed (e.g., only deposits or transfers)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_transactions_user_type_created_at"
       ON "transactions" ("user_id", "type", "created_at" DESC)`,
    );

    // Reference lookup (for duplicate detection, idempotency)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_transactions_reference"
       ON "transactions" ("reference") WHERE "reference" IS NOT NULL`,
    );

    // Unique reference (if needed)
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_transactions_reference_unique"
       ON "transactions" ("reference") WHERE "reference" IS NOT NULL`,
    );

    // Background worker polling: find pending transactions to process
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_transactions_status_created_at"
       ON "transactions" ("status", "created_at" DESC)`,
    );

    // Counterparty search (when/if username search feature is added)
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_transactions_counterparty_username"
       ON "transactions" ("counterparty_username") WHERE "counterparty_username" IS NOT NULL`,
    );

    // ====================================================================
    // Waitlist Entries Indexes (when/if waitlist feature is added)
    // ====================================================================

    // Email lookups (for duplicate prevention)
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_waitlist_entries_email"
       ON "waitlist_entries" ("email") WHERE "email" IS NOT NULL`,
    );

    // Referral code lookups
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_waitlist_entries_referral_code"
       ON "waitlist_entries" ("referral_code") WHERE "referral_code" IS NOT NULL`,
    );

    // Leaderboard ordering by points descending, then by join time
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_waitlist_entries_points_created_at"
       ON "waitlist_entries" ("points" DESC, "created_at" ASC)`,
    );

    // ====================================================================
    // Refresh Tokens Indexes
    // ====================================================================

    // Note: user_id index already exists via entity @Index decorator

    // Token hash lookup for validation (should already have index, but ensure uniqueness)
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_refresh_tokens_token_hash"
       ON "refresh_tokens" ("token_hash")`,
    );

    // Cleanup job: find expired tokens
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_refresh_tokens_expires_at"
       ON "refresh_tokens" ("expires_at") WHERE "expires_at" < NOW()`,
    );

    // Cleanup job: find revoked tokens older than 30 days
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_refresh_tokens_revoked_at"
       ON "refresh_tokens" ("revoked_at") WHERE "revoked_at" IS NOT NULL`,
    );

    // ====================================================================
    // OTPs Indexes (when/if OTP feature is added)
    // ====================================================================

    // Lookup OTP for verification
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_otps_email_type_created_at"
       ON "otps" ("email", "type", "created_at" DESC)`,
    );

    // Cleanup job: find expired OTPs
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_otps_expires_at"
       ON "otps" ("expires_at") WHERE "expires_at" < NOW()`,
    );

    // ====================================================================
    // Settlements Indexes (when/if settlements feature is added)
    // ====================================================================

    // Settlement history by merchant, sorted by date
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_settlements_merchant_created_at"
       ON "settlements" ("merchant_id", "created_at" DESC)`,
    );

    // Background worker polling: find pending settlements to process
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_settlements_status_created_at"
       ON "settlements" ("status", "created_at" DESC)`,
    );

    // ====================================================================
    // Webhook Delivery Logs Indexes (for cleanup)
    // ====================================================================

    // Cleanup job: find webhook logs older than 90 days
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_webhook_deliveries_created_at"
       ON "webhook_deliveries" ("created_at") WHERE "created_at" < NOW() - INTERVAL '90 days'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all created indexes (will be recreated if migration is reverted and re-applied)
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_users_referral_code"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_users_tier_is_active"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_users_created_at_desc"`);

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_transactions_user_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_transactions_user_type_created_at"`,
    );
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_transactions_reference"`);
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_transactions_reference_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_transactions_status_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_transactions_counterparty_username"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_waitlist_entries_email"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_waitlist_entries_referral_code"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_waitlist_entries_points_created_at"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_refresh_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_refresh_tokens_revoked_at"`,
    );

    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_otps_email_type_created_at"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_otps_expires_at"`);

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_settlements_merchant_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_settlements_status_created_at"`,
    );

    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_webhook_deliveries_created_at"`,
    );
  }
}
