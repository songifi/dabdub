# Data Retention Policy Management & GDPR/Privacy Compliance

This module implements comprehensive data retention policy management and GDPR/privacy compliance tools for DabDub.

## Features

### Data Retention Policies
- Configure retention periods for different data types
- Legal basis documentation for each policy
- Optional archival before deletion
- Automated purge job scheduling
- Purge history tracking

### Data Deletion Requests
- Merchant data deletion request workflow
- Multi-stage approval process (RECEIVED → UNDER_REVIEW → APPROVED → PROCESSING → COMPLETED)
- Legal hold support with expiration dates
- Comprehensive deletion summary tracking
- PII anonymization

### GDPR Subject Access Requests
- Complete merchant data export generation
- Manifest listing all included data categories
- Secure download link generation
- 24-hour delivery SLA

## Entities

### DataRetentionPolicy
- `dataType`: Unique identifier for data category
- `retentionDays`: Number of days to retain data
- `isEnabled`: Policy activation status
- `legalBasis`: Legal justification for retention period
- `archiveBeforeDelete`: Whether to archive to cold storage before deletion
- `lastPurgeRunAt`: Timestamp of last purge execution
- `lastPurgeDeletedCount`: Number of records deleted in last purge

### DataDeletionRequest
- `merchantId`: Merchant requesting deletion
- `status`: Current workflow status
- `requestReason`: Merchant's reason for deletion
- `reviewedById`: Admin who reviewed the request
- `reviewNote`: Admin's review notes
- `legalHoldExpiresAt`: Legal hold expiration date (if applicable)
- `deletedDataSummary`: JSON summary of deleted data counts
- `completedAt`: Completion timestamp

## API Endpoints

### Data Retention (SUPER_ADMIN only)

#### GET /api/v1/data-retention/policies
List all retention policies.

#### PATCH /api/v1/data-retention/policies/:dataType
Update retention policy for a specific data type.

**Request Body:**
```json
{
  "retentionDays": 365,
  "isEnabled": true,
  "legalBasis": "GDPR Article 6(1)(c) - Legal obligation to retain financial records",
  "archiveBeforeDelete": true
}
```

**Validation:**
- `retentionDays`: 30-3650 days
- `legalBasis`: Minimum 20 characters

#### POST /api/v1/data-retention/policies/:dataType/run-purge
Trigger manual purge for a specific data type.

**Response:**
```json
{
  "jobId": "purge-audit_logs-1740100000000",
  "estimatedRowsToDelete": 15234
}
```

#### GET /api/v1/data-retention/purge-history
Get purge execution history.

**Response:**
```json
[
  {
    "dataType": "webhook_deliveries",
    "rowsDeleted": 5432,
    "runAt": "2026-02-20T10:30:00Z"
  }
]
```

### Privacy Compliance (SUPER_ADMIN only)

#### GET /api/v1/privacy/deletion-requests
List all data deletion requests.

#### GET /api/v1/privacy/deletion-requests/:id
Get deletion request details.

#### PATCH /api/v1/privacy/deletion-requests/:id
Update deletion request status.

**Request Body:**
```json
{
  "status": "APPROVED",
  "reviewNote": "Request approved after legal review. No active investigations.",
  "legalHoldExpiresAt": "2026-03-01T00:00:00Z"
}
```

#### POST /api/v1/privacy/deletion-requests/:id/execute
Execute approved deletion request.

**Validation:**
- Status must be `APPROVED`
- Legal hold must be expired or null

**Response:**
```json
{
  "success": true,
  "deletedDataSummary": {
    "merchantsAnonymized": 1,
    "documentsDeleted": 5,
    "webhookDeliveriesDeleted": 234,
    "apiKeysDeleted": 3
  }
}
```

#### POST /api/v1/privacy/exports/:merchantId
Generate merchant data export (GDPR subject access request).

**Response:**
```json
{
  "downloadLink": "https://exports.dabdub.xyz/merchant-123/export-1740100000000.json"
}
```

## Default Retention Policies

| Data Type | Retention Period | Legal Basis | Archive Before Delete |
|-----------|------------------|-------------|----------------------|
| transaction_records | 2555 days (7 years) | Financial regulations | Yes |
| audit_logs | 2555 days (7 years) | Compliance requirements | Yes |
| webhook_deliveries | 90 days | Operational debugging | No |
| support_tickets | 1095 days (3 years) | Customer service | No |
| kyc_documents | 2555 days (7 years) | AML/KYC regulations | Yes |

## Compliance Features

### Transaction Record Protection
- Transaction records cannot be deleted within 7-year regulatory minimum
- Attempting to set retention period below 2555 days throws error
- Ensures compliance with financial regulations

### Audit Log Exemption
- `MERCHANT_DATA_DELETED` audit log entries are marked as `PERMANENT`
- Never purged regardless of retention policy
- Provides immutable deletion audit trail

### Legal Hold Support
- Deletion requests can be placed on legal hold
- Hold expiration date must pass before execution
- Prevents premature deletion during investigations

### PII Anonymization
- Names, emails, phone numbers replaced with `[DELETED]`
- Preserves data structure for analytics
- Maintains referential integrity

### Data Export Manifest
```json
{
  "exportDate": "2026-02-22T17:00:00Z",
  "dataCategories": [
    "Business Information",
    "Transaction History",
    "Settlement History",
    "KYC Documents",
    "API Keys",
    "Webhook Configurations"
  ],
  "format": "JSON",
  "version": "1.0"
}
```

## Job Processors

### DataPurgeProcessor
- Queue: `data-purge`
- Job: `purge-data`
- Idempotent: Running same purge twice doesn't delete more data
- Updates policy stats after completion

### MerchantDataDeletionProcessor
- Queue: `merchant-data-deletion`
- Job: `delete-merchant-data`
- Handles complete merchant data deletion workflow
- Returns detailed deletion summary

## Audit Logging

All operations are logged to the audit system:

- `DATA_PURGE_TRIGGERED`: Manual purge initiated
- `MERCHANT_DATA_DELETED`: Merchant data deletion completed (PERMANENT)
- `DATA_EXPORT_REQUESTED`: GDPR export generated
- `UPDATE`: Retention policy or deletion request updated

## Security

- All endpoints require `SUPER_ADMIN` role
- Audit logs for all operations
- Legal hold validation before deletion
- Regulatory minimum retention enforcement

## Testing

```bash
# Run privacy module tests
npm run test -- privacy

# Test data purge
npm run test -- data-purge.service

# Test merchant deletion
npm run test -- merchant-data-deletion.service
```

## Usage Example

```typescript
// Update retention policy
PATCH /api/v1/data-retention/policies/webhook_deliveries
{
  "retentionDays": 60,
  "isEnabled": true,
  "legalBasis": "Operational requirement for debugging webhook delivery issues",
  "archiveBeforeDelete": false
}

// Trigger manual purge
POST /api/v1/data-retention/policies/webhook_deliveries/run-purge

// Approve deletion request
PATCH /api/v1/privacy/deletion-requests/abc-123
{
  "status": "APPROVED",
  "reviewNote": "Verified merchant account closed. No pending transactions or investigations."
}

// Execute deletion
POST /api/v1/privacy/deletion-requests/abc-123/execute

// Generate GDPR export
POST /api/v1/privacy/exports/merchant-456
```

## Future Enhancements

- Automated scheduled purges (cron jobs)
- Cold storage integration (AWS Glacier)
- Multi-region data residency support
- Enhanced anonymization algorithms
- Deletion request self-service portal for merchants
- Real-time purge progress tracking
- Data retention policy templates by jurisdiction
