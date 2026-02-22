# Privacy Module - Quick Reference

## 🚀 Quick Start

```bash
# Run migration
npm run migration:run

# Start the server
npm run start:dev

# Run tests
npm run test -- privacy
```

## 📋 Common Operations

### Update Retention Policy
```bash
curl -X PATCH http://localhost:3000/api/v1/data-retention/policies/webhook_deliveries \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "retentionDays": 60,
    "isEnabled": true,
    "legalBasis": "Operational debugging requirement",
    "archiveBeforeDelete": false
  }'
```

### Trigger Manual Purge
```bash
curl -X POST http://localhost:3000/api/v1/data-retention/policies/webhook_deliveries/run-purge \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Approve Deletion Request
```bash
curl -X PATCH http://localhost:3000/api/v1/privacy/deletion-requests/REQUEST_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "reviewNote": "Legal review completed. Approved for deletion."
  }'
```

### Execute Deletion
```bash
curl -X POST http://localhost:3000/api/v1/privacy/deletion-requests/REQUEST_ID/execute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Generate GDPR Export
```bash
curl -X POST http://localhost:3000/api/v1/privacy/exports/MERCHANT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔐 Security Requirements

- **Role**: SUPER_ADMIN required for all endpoints
- **Authentication**: JWT Bearer token
- **Audit**: All operations logged automatically

## 📊 Default Retention Periods

| Data Type | Days | Years |
|-----------|------|-------|
| transaction_records | 2555 | 7 |
| audit_logs | 2555 | 7 |
| kyc_documents | 2555 | 7 |
| support_tickets | 1095 | 3 |
| webhook_deliveries | 90 | 0.25 |

## 🔄 Deletion Request Workflow

```
RECEIVED → UNDER_REVIEW → APPROVED → PROCESSING → COMPLETED
                ↓              ↓
           LEGAL_HOLD     REJECTED
```

## ⚠️ Important Rules

1. **Transaction Records**: Cannot be deleted within 7 years (2555 days)
2. **Legal Holds**: Must expire before deletion can execute
3. **Audit Logs**: MERCHANT_DATA_DELETED entries are PERMANENT
4. **Idempotency**: Running same purge twice won't delete more data
5. **PII Anonymization**: Names/emails replaced with [DELETED]

## 🧪 Testing Checklist

- [ ] List all retention policies
- [ ] Update a retention policy
- [ ] Trigger manual purge
- [ ] View purge history
- [ ] List deletion requests
- [ ] Update deletion request status
- [ ] Place request on legal hold
- [ ] Approve deletion request
- [ ] Execute deletion
- [ ] Generate GDPR export
- [ ] Verify audit logs created
- [ ] Test legal hold validation
- [ ] Test transaction record protection

## 📁 File Structure

```
privacy/
├── entities/
│   ├── data-retention-policy.entity.ts
│   └── data-deletion-request.entity.ts
├── enums/
│   └── deletion-request-status.enum.ts
├── dto/
│   ├── update-retention-policy.dto.ts
│   └── update-deletion-request.dto.ts
├── services/
│   ├── data-retention.service.ts
│   ├── privacy.service.ts
│   ├── data-purge.service.ts
│   ├── merchant-data-deletion.service.ts
│   └── data-export.service.ts
├── controllers/
│   ├── data-retention.controller.ts
│   └── privacy.controller.ts
├── processors/
│   ├── data-purge.processor.ts
│   └── merchant-data-deletion.processor.ts
├── examples/
│   └── privacy-api.http
├── privacy.module.ts
├── README.md
└── IMPLEMENTATION_SUMMARY.md
```

## 🐛 Troubleshooting

### Purge Job Not Running
- Check Bull queue configuration
- Verify Redis connection
- Check purge history endpoint

### Deletion Fails
- Verify status is APPROVED
- Check legal hold expiration
- Review audit logs for errors

### Export Not Generated
- Check S3 configuration
- Verify merchant exists
- Review service logs

## 📞 Support

For issues or questions:
- Check README.md for detailed documentation
- Review IMPLEMENTATION_SUMMARY.md for architecture
- Examine privacy-api.http for API examples
- Check audit logs for operation history

## 🎯 Key Metrics

Monitor these metrics in production:
- Purge job success rate
- Average deletion processing time
- Export generation time
- Active legal holds count
- Failed purge attempts

## ✅ Acceptance Criteria

All criteria met:
- ✅ SUPER_ADMIN required and logged
- ✅ Purge jobs are idempotent
- ✅ Legal holds prevent execution
- ✅ Transaction records protected (7 years)
- ✅ MERCHANT_DATA_DELETED logs permanent
- ✅ Export includes manifest
