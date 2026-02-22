# Privacy Module Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUPER_ADMIN Dashboard                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Privacy Module API                            │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │ Data Retention       │  │ Privacy Compliance           │    │
│  │ Controller           │  │ Controller                   │    │
│  │                      │  │                              │    │
│  │ - List Policies      │  │ - List Deletion Requests     │    │
│  │ - Update Policy      │  │ - Update Request Status      │    │
│  │ - Trigger Purge      │  │ - Execute Deletion           │    │
│  │ - Purge History      │  │ - Generate Export            │    │
│  └──────────┬───────────┘  └──────────┬───────────────────┘    │
└─────────────┼──────────────────────────┼──────────────────────┘
              │                          │
              ▼                          ▼
┌─────────────────────────┐  ┌──────────────────────────────┐
│ DataRetentionService    │  │ PrivacyService               │
│                         │  │                              │
│ - Policy CRUD           │  │ - Deletion Request Workflow  │
│ - Purge Stats           │  │ - Validation Logic           │
└────────┬────────────────┘  └────────┬─────────────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────────┐  ┌──────────────────────────────┐
│ DataPurgeService        │  │ MerchantDataDeletionService  │
│                         │  │                              │
│ - Estimate Rows         │  │ - Anonymize PII              │
│ - Execute Purge         │  │ - Delete Documents           │
│ - Archive Data          │  │ - Purge Records              │
└────────┬────────────────┘  └────────┬─────────────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Background Jobs (Bull)                   │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │ DataPurgeProcessor   │  │ MerchantDataDeletion     │    │
│  │                      │  │ Processor                │    │
│  │ Queue: data-purge    │  │ Queue: merchant-data-    │    │
│  │ Job: purge-data      │  │        deletion          │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database (PostgreSQL)                   │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │ data_retention_      │  │ data_deletion_           │    │
│  │ policies             │  │ requests                 │    │
│  │                      │  │                          │    │
│  │ - data_type (unique) │  │ - merchant_id            │    │
│  │ - retention_days     │  │ - status (enum)          │    │
│  │ - legal_basis        │  │ - review_note            │    │
│  │ - archive_before_    │  │ - legal_hold_expires_at  │    │
│  │   delete             │  │ - deleted_data_summary   │    │
│  │ - last_purge_run_at  │  │ - completed_at           │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Audit Log System                          │
│                                                              │
│  All operations logged with:                                 │
│  - Entity type & ID                                          │
│  - Action (UPDATE, DATA_PURGE_TRIGGERED, etc.)              │
│  - Actor ID & Type                                           │
│  - Before/After state                                        │
│  - Data classification (PERMANENT for deletions)            │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Retention Policy Update Flow

```
Admin Request
     │
     ▼
[SuperAdminGuard]
     │
     ▼
DataRetentionController.updatePolicy()
     │
     ▼
DataRetentionService.updatePolicy()
     │
     ├─► Find existing policy
     ├─► Create or update
     └─► Save to database
     │
     ▼
AuditLogService.log()
     │
     └─► Record policy change
```

### 2. Manual Purge Trigger Flow

```
Admin Request
     │
     ▼
[SuperAdminGuard]
     │
     ▼
DataRetentionController.runPurge()
     │
     ▼
DataPurgeService.estimateRowsToDelete()
     │
     ▼
AuditLogService.log(DATA_PURGE_TRIGGERED)
     │
     ▼
Enqueue Job → Bull Queue (data-purge)
     │
     ▼
DataPurgeProcessor.handlePurge()
     │
     ├─► Calculate cutoff date
     ├─► Archive (if enabled)
     ├─► Delete records
     └─► Update purge stats
```

### 3. Deletion Request Execution Flow

```
Admin Request
     │
     ▼
[SuperAdminGuard]
     │
     ▼
PrivacyController.executeDeletion()
     │
     ▼
PrivacyService.validateExecutionEligibility()
     │
     ├─► Check status = APPROVED
     └─► Check legal hold expired
     │
     ▼
PrivacyService.markAsProcessing()
     │
     ▼
MerchantDataDeletionService.deleteMerchantData()
     │
     ├─► Anonymize PII
     ├─► Delete S3 documents
     ├─► Purge webhook deliveries
     ├─► Delete API keys
     └─► Retain transaction records
     │
     ▼
PrivacyService.markAsCompleted()
     │
     ▼
AuditLogService.log(MERCHANT_DATA_DELETED, PERMANENT)
```

### 4. GDPR Export Generation Flow

```
Admin Request
     │
     ▼
[SuperAdminGuard]
     │
     ▼
PrivacyController.generateExport()
     │
     ▼
DataExportService.generateMerchantDataExport()
     │
     ├─► Fetch merchant info
     ├─► Fetch transactions
     ├─► Fetch settlements
     ├─► List KYC documents
     ├─► Fetch API key metadata
     ├─► Fetch webhook configs
     └─► Generate manifest
     │
     ▼
Upload to S3
     │
     ▼
Generate presigned URL
     │
     ▼
AuditLogService.log(DATA_EXPORT_REQUESTED)
     │
     └─► Return download link
```

## Deletion Request State Machine

```
                    ┌──────────┐
                    │ RECEIVED │
                    └────┬─────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ UNDER_REVIEW │
                  └──────┬───────┘
                         │
                ┌────────┼────────┐
                │                 │
                ▼                 ▼
         ┌────────────┐    ┌──────────┐
         │ LEGAL_HOLD │    │ APPROVED │
         └────┬───────┘    └────┬─────┘
              │                 │
              │ (hold expires)  │
              └────────┬────────┘
                       │
                       ▼
                ┌────────────┐
                │ PROCESSING │
                └────┬───────┘
                     │
                     ▼
                ┌───────────┐
                │ COMPLETED │
                └───────────┘

         Alternative path:
         UNDER_REVIEW → REJECTED
```

## Security Layers

```
┌─────────────────────────────────────────┐
│         Request Layer                    │
│  - JWT Authentication                    │
│  - Bearer Token Validation               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      Authorization Layer                 │
│  - SuperAdminGuard                       │
│  - Role Verification                     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│       Validation Layer                   │
│  - DTO Validation (class-validator)     │
│  - Business Logic Validation             │
│  - Legal Hold Checks                     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│        Audit Layer                       │
│  - All Operations Logged                 │
│  - Actor Tracking                        │
│  - State Change Recording                │
└─────────────────────────────────────────┘
```

## Data Retention Timeline

```
Day 0                Day 90              Day 1095            Day 2555
│                    │                   │                   │
├────────────────────┼───────────────────┼───────────────────┤
│                    │                   │                   │
│ Webhook            │ Support           │                   │ Transaction
│ Deliveries         │ Tickets           │                   │ Records
│ Purged             │ Purged            │                   │ Audit Logs
│                    │                   │                   │ KYC Docs
│                    │                   │                   │ Purged
│                    │                   │                   │
└────────────────────┴───────────────────┴───────────────────┘
   3 months            3 years                                7 years
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                     Privacy Module                           │
└──────┬──────────────┬──────────────┬──────────────┬────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Audit   │  │   Auth   │  │   Bull   │  │ TypeORM  │
│  Module  │  │  Module  │  │  Queues  │  │ Database │
│          │  │          │  │          │  │          │
│ - Log    │  │ - Guards │  │ - Jobs   │  │ - Repos  │
│   All    │  │ - User   │  │ - Async  │  │ - Entities│
│   Ops    │  │   Info   │  │   Tasks  │  │ - Queries│
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Compliance Matrix

```
┌──────────────────────┬──────────────┬──────────────┬──────────────┐
│ Requirement          │ Implementation│ Validation   │ Audit Trail  │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ GDPR Right to        │ Deletion     │ Legal Hold   │ PERMANENT    │
│ Erasure              │ Requests     │ Check        │ Log Entry    │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ GDPR Data            │ Export       │ Manifest     │ Export       │
│ Portability          │ Service      │ Generation   │ Logged       │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ Financial            │ 7-Year       │ Min Days     │ Purge        │
│ Regulations          │ Retention    │ Check        │ Prevented    │
├──────────────────────┼──────────────┼──────────────┼──────────────┤
│ Data Minimization    │ Automated    │ Retention    │ Purge        │
│                      │ Purges       │ Policies     │ History      │
└──────────────────────┴──────────────┴──────────────┴──────────────┘
```
