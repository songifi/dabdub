# Admin Settlements API

This module provides admin functionality for managing settlements across all merchants.

## Endpoints

### GET /api/v1/admin/settlements
Retrieve all settlements with filtering options.

**Query Parameters:**
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by settlement status (`pending`, `pending_approval`, `processing`, `completed`, `failed`)
- `merchantId` (string): Filter by merchant ID
- `startDate` (string): Filter settlements created after this date (ISO format)
- `endDate` (string): Filter settlements created before this date (ISO format)
- `partnerReference` (string): Filter by partner reference
- `bankReference` (string): Filter by bank reference

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "merchantId": "uuid",
      "merchant": {
        "businessName": "string"
      },
      "totalAmountUsd": 1000.00,
      "feeAmountUsd": 15.00,
      "netAmountUsd": 985.00,
      "fiatCurrency": "NGN",
      "fiatAmount": 1500000.00,
      "status": "completed",
      "partnerReference": "ref123",
      "bankReference": "bank456",
      "requiresApproval": false,
      "approvedBy": null,
      "approvedAt": null,
      "completedAt": "2024-01-01T12:00:00Z",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### POST /api/v1/admin/settlements/:id/retry
Force retry a failed settlement.

**Requirements:**
- Settlement must have status `failed`
- Admin authentication required

**Response:**
```json
{
  "message": "Settlement retry initiated successfully"
}
```

### POST /api/v1/admin/settlements/:id/approve
Approve a large settlement that requires manual approval.

**Requirements:**
- Settlement must have status `pending_approval`
- Settlement must have `requiresApproval: true`
- Admin authentication required

**Response:**
```json
{
  "message": "Settlement approved successfully"
}
```

## Settlement Status Flow

1. **pending** - Initial state for small settlements
2. **pending_approval** - Large settlements (>$10,000) requiring manual approval
3. **processing** - Settlement is being processed with partner
4. **completed** - Settlement successfully completed
5. **failed** - Settlement failed and can be retried

## Large Settlement Approval Workflow

Settlements with `netAmountUsd >= $10,000` automatically:
- Set status to `pending_approval`
- Set `requiresApproval: true`
- Generate admin alert for manual review
- Require admin approval before processing

## Partner Reference Visibility

Each settlement includes:
- `partnerReference` - Reference from payment partner for bank reconciliation
- `bankReference` - Bank transaction reference (if available)
- Both references are visible in admin interface for reconciliation purposes

## Error Handling

- **404** - Settlement not found
- **400** - Invalid operation (e.g., trying to retry non-failed settlement)
- **401** - Authentication required
- **403** - Admin access required