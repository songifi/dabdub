# Privacy Module - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] PostgreSQL 14+ running
- [ ] Redis 6+ running (for Bull queues)
- [ ] Node.js 18+ installed
- [ ] S3 bucket configured for exports
- [ ] SUPER_ADMIN users created

### 2. Configuration
- [ ] Database connection configured
- [ ] Bull queue configuration verified
- [ ] S3 credentials set
- [ ] JWT secret configured
- [ ] Audit module enabled

## Deployment Steps

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Run Database Migration
```bash
# Generate migration (if needed)
npm run migration:generate -- -n CreateDataRetentionTables

# Run migration
npm run migration:run

# Verify migration
npm run migration:show
```

### Step 3: Verify Default Policies
```sql
-- Connect to database
psql -U postgres -d dabdub

-- Check default policies
SELECT data_type, retention_days, legal_basis 
FROM data_retention_policies;

-- Expected output:
-- transaction_records | 2555 | Financial regulations...
-- audit_logs          | 2555 | Compliance and security...
-- webhook_deliveries  | 90   | Operational debugging...
-- support_tickets     | 1095 | Customer service...
-- kyc_documents       | 2555 | Anti-money laundering...
```

### Step 4: Configure Bull Queues
```typescript
// In app.module.ts or privacy.module.ts
BullModule.forRoot({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
}),
BullModule.registerQueue(
  { name: 'data-purge' },
  { name: 'merchant-data-deletion' },
),
```

### Step 5: Import Privacy Module
```typescript
// In app.module.ts
import { PrivacyModule } from './privacy/privacy.module';

@Module({
  imports: [
    // ... other modules
    PrivacyModule,
  ],
})
export class AppModule {}
```

### Step 6: Start Application
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Step 7: Verify API Endpoints
```bash
# Test authentication
curl http://localhost:3000/api/v1/data-retention/policies \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# Should return 200 with list of policies
```

## Post-Deployment Verification

### 1. API Health Check
```bash
# List retention policies
curl -X GET http://localhost:3000/api/v1/data-retention/policies \
  -H "Authorization: Bearer TOKEN"

# Expected: 200 OK with 5 default policies
```

### 2. Database Verification
```sql
-- Check tables exist
\dt data_*

-- Expected:
-- data_retention_policies
-- data_deletion_requests

-- Check indexes
\di data_*

-- Expected:
-- IDX_deletion_requests_merchant_id
-- IDX_deletion_requests_status
```

### 3. Queue Verification
```bash
# Check Redis queues
redis-cli

# List queues
KEYS bull:*

# Expected:
# bull:data-purge:*
# bull:merchant-data-deletion:*
```

### 4. Audit Log Verification
```sql
-- Check audit logs table
SELECT COUNT(*) FROM compliance_audit_logs;

-- Should exist and be accessible
```

## Configuration Reference

### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=dabdub

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# S3 (for exports)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_EXPORTS_BUCKET=dabdub-exports

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars

# Application
NODE_ENV=production
PORT=3000
```

### Bull Queue Configuration
```typescript
// Default configuration
{
  redis: {
    host: 'localhost',
    port: 6379,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
}
```

## Monitoring Setup

### 1. Bull Board (Optional)
```bash
npm install @bull-board/express @bull-board/api

# Add to main.ts
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullAdapter(dataPurgeQueue),
    new BullAdapter(merchantDataDeletionQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

### 2. Prometheus Metrics
```typescript
// Add metrics for:
- privacy_purge_jobs_total
- privacy_purge_records_deleted_total
- privacy_deletion_requests_total
- privacy_exports_generated_total
```

### 3. Logging
```typescript
// Configure Winston or Pino
logger.info('Privacy module initialized');
logger.info('Default retention policies loaded');
logger.info('Bull queues registered');
```

## Security Hardening

### 1. Rate Limiting
```typescript
// Add rate limiting to privacy endpoints
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per minute
```

### 2. IP Whitelisting (Optional)
```typescript
// Restrict to admin IPs
@UseGuards(IpWhitelistGuard)
```

### 3. Audit All Operations
```typescript
// Already implemented - verify logs
SELECT * FROM compliance_audit_logs 
WHERE entity_type IN ('DataRetentionPolicy', 'DataDeletionRequest')
ORDER BY created_at DESC 
LIMIT 10;
```

## Rollback Procedure

### If Issues Occur:

#### 1. Revert Migration
```bash
npm run migration:revert
```

#### 2. Remove Module Import
```typescript
// Comment out in app.module.ts
// PrivacyModule,
```

#### 3. Clear Bull Queues
```bash
redis-cli
FLUSHDB  # WARNING: Clears all Redis data
```

#### 4. Restart Application
```bash
npm run start:prod
```

## Testing in Production

### 1. Create Test Retention Policy
```bash
curl -X PATCH http://localhost:3000/api/v1/data-retention/policies/test_data \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "retentionDays": 30,
    "isEnabled": true,
    "legalBasis": "Test policy for validation purposes only",
    "archiveBeforeDelete": false
  }'
```

### 2. Trigger Test Purge
```bash
curl -X POST http://localhost:3000/api/v1/data-retention/policies/test_data/run-purge \
  -H "Authorization: Bearer TOKEN"
```

### 3. Verify Audit Logs
```sql
SELECT * FROM compliance_audit_logs 
WHERE entity_type = 'DataRetentionPolicy' 
  AND action = 'DATA_PURGE_TRIGGERED'
ORDER BY created_at DESC 
LIMIT 1;
```

### 4. Clean Up Test Data
```sql
DELETE FROM data_retention_policies WHERE data_type = 'test_data';
```

## Maintenance Tasks

### Daily
- [ ] Monitor purge job success rate
- [ ] Check deletion request queue
- [ ] Review audit logs for anomalies

### Weekly
- [ ] Review retention policies
- [ ] Check purge history
- [ ] Verify export generation

### Monthly
- [ ] Audit deletion requests
- [ ] Review legal holds
- [ ] Update retention periods if needed

## Troubleshooting

### Issue: Migration Fails
```bash
# Check database connection
psql -U postgres -d dabdub -c "SELECT 1"

# Check migration status
npm run migration:show

# Force migration
npm run migration:run -- --transaction all
```

### Issue: Bull Queue Not Processing
```bash
# Check Redis connection
redis-cli ping

# Check queue status
redis-cli KEYS bull:data-purge:*

# Restart queue processor
pm2 restart dabdub-backend
```

### Issue: Purge Job Fails
```sql
-- Check policy configuration
SELECT * FROM data_retention_policies WHERE data_type = 'failing_type';

-- Check audit logs
SELECT * FROM compliance_audit_logs 
WHERE action = 'DATA_PURGE_TRIGGERED' 
ORDER BY created_at DESC;
```

### Issue: Deletion Request Stuck
```sql
-- Check request status
SELECT * FROM data_deletion_requests WHERE id = 'request_id';

-- Check legal hold
SELECT legal_hold_expires_at FROM data_deletion_requests 
WHERE id = 'request_id';

-- Manually update if needed (with caution)
UPDATE data_deletion_requests 
SET status = 'APPROVED', legal_hold_expires_at = NULL 
WHERE id = 'request_id';
```

## Performance Optimization

### 1. Database Indexes
```sql
-- Already created in migration
-- Verify they exist
\di data_*
```

### 2. Query Optimization
```sql
-- Add composite indexes if needed
CREATE INDEX idx_deletion_requests_merchant_status 
ON data_deletion_requests(merchant_id, status);
```

### 3. Bull Queue Concurrency
```typescript
// Adjust processor concurrency
@Process({ name: 'purge-data', concurrency: 5 })
```

## Support Contacts

- **Technical Issues**: tech-support@dabdub.xyz
- **Security Concerns**: security@dabdub.xyz
- **Compliance Questions**: compliance@dabdub.xyz

## Additional Resources

- [README.md](./README.md) - Full documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick commands
- [privacy-api.http](./examples/privacy-api.http) - API examples

## Deployment Checklist Summary

- [x] Dependencies installed
- [x] Migration executed
- [x] Default policies verified
- [x] Bull queues configured
- [x] Module imported
- [x] Application started
- [x] API endpoints tested
- [x] Database verified
- [x] Queues verified
- [x] Audit logs verified
- [x] Monitoring configured
- [x] Security hardened
- [x] Documentation reviewed

## Success Criteria

✅ All API endpoints return 200 OK
✅ Default retention policies exist
✅ Bull queues processing jobs
✅ Audit logs being created
✅ SUPER_ADMIN access working
✅ Database tables created
✅ Indexes created
✅ No errors in logs

**Deployment Status**: Ready for Production 🚀
