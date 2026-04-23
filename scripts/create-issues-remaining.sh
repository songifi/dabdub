#!/usr/bin/env bash
set -euo pipefail

REPO="songifi/dabdub"
DELAY=2
COUNT=0

create_issue() {
  local title="$1"
  local body="$2"
  local label="$3"
  COUNT=$((COUNT + 1))
  echo "[$COUNT/160] Creating: $title"
  gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$label" \
    2>/dev/null || gh issue create --repo "$REPO" --title "$title" --body "$body" 2>/dev/null \
    || echo "  WARN: failed issue $COUNT"
  sleep $DELAY
}

# ─────────────────────────────────────────────
# PAYMENTS — continuing from #11
# ─────────────────────────────────────────────

create_issue \
  "[Payments] Payment notification emails to customer" \
  "## Overview
Send email notifications to customers when payment status changes.

## Tasks
- [ ] Send confirmation email when payment confirmed on Stellar
- [ ] Send receipt email when payment settled
- [ ] Email sent to \`customerEmail\` if provided on payment creation
- [ ] Use HTML email templates (handlebars)
- [ ] Include merchant business name in email

## Acceptance Criteria
- Emails only sent when customerEmail is present
- Settled email includes receipt details and amount
- Unsubscribe link included in footer" \
  "module:payments"

create_issue \
  "[Payments] Shareable payment link generation" \
  "## Overview
Generate a short, shareable URL customers can open to make a payment.

## Tasks
- [ ] Payment link format: \`https://cheesepay.xyz/pay/{reference}\`
- [ ] Include \`paymentUrl\` in payment creation response
- [ ] QR code encodes the payment link URL as fallback
- [ ] Link works without authentication

## Acceptance Criteria
- Payment link opens the customer payment page
- Link works without any auth
- QR code can encode either Stellar URI or payment link" \
  "module:payments"

create_issue \
  "[Payments] Batch payment creation" \
  "## Overview
Allow merchants to create multiple payment requests in a single API call.

## Tasks
- [ ] \`POST /api/v1/payments/batch\` endpoint
- [ ] Accept array of payment objects (max 50)
- [ ] Create all in a single DB transaction
- [ ] Return array of created payments with per-item success/error

## Acceptance Criteria
- Partial failure returns per-item error status
- Maximum 50 payments per batch
- Each payment has a unique reference and memo" \
  "module:payments"

create_issue \
  "[Payments] Payment retry for failed settlements" \
  "## Overview
Allow merchants to retry settlement for payments that failed during fiat transfer.

## Tasks
- [ ] \`POST /api/v1/payments/:id/retry-settlement\`
- [ ] Only payments in \`failed\` status can be retried
- [ ] Re-trigger the settlement flow
- [ ] Limit to 3 manual retries per payment

## Acceptance Criteria
- Cannot retry non-failed payments (returns 422)
- Retry limit enforced and stored on payment record
- Settlement re-runs the full fiat transfer flow" \
  "module:payments"

create_issue \
  "[Payments] Payment statistics by period" \
  "## Overview
Provide time-series payment statistics for merchant analytics.

## Tasks
- [ ] \`GET /api/v1/payments/stats\` — group by status
- [ ] \`GET /api/v1/payments/stats/daily\` — daily volume for last 30 days
- [ ] \`GET /api/v1/payments/stats/monthly\` — monthly volume for last 12 months
- [ ] Support \`dateFrom\` and \`dateTo\` filter

## Acceptance Criteria
- Daily stats include count and USD volume
- Days with no payments filled with zero entries
- Response cached for 5 minutes" \
  "module:payments"

create_issue \
  "[Payments] Refund processing" \
  "## Overview
Support refunds for settled payments where merchant initiates a crypto refund to the customer.

## Tasks
- [ ] \`POST /api/v1/payments/:id/refund\` endpoint
- [ ] Only settled payments can be refunded
- [ ] Merchant provides customer Stellar address
- [ ] Send equivalent USDC/XLM back to customer
- [ ] Log refund transaction hash

## Acceptance Criteria
- Refund sends crypto (not fiat) back to customer
- Partial refunds supported with \`amount\` field
- Refund status tracked on payment record" \
  "module:payments"

create_issue \
  "[Payments] Payment confirmation tracking (ledger closes)" \
  "## Overview
Track the number of Stellar ledger confirmations before marking a payment confirmed.

## Tasks
- [ ] Require minimum 5 ledger closes before confirming
- [ ] Track \`confirmations\` count on payment entity
- [ ] Update confirmation count in background polling
- [ ] Expose \`confirmations\` in payment response

## Acceptance Criteria
- Payment not confirmed until min confirmations reached
- Confirmation count updated in real-time
- Configurable minimum via \`STELLAR_MIN_CONFIRMATIONS\` env var" \
  "module:payments"

create_issue \
  "[Payments] Exchange rate snapshot on payment creation" \
  "## Overview
Capture and store the XLM/USD exchange rate at the time of payment creation.

## Tasks
- [ ] Fetch rate from Stellar DEX at creation time
- [ ] Store as \`exchangeRateSnapshot\` on payment entity
- [ ] Use snapshot for amount calculation, not live rate
- [ ] Expose rate in payment response

## Acceptance Criteria
- Rate is locked at creation time
- Subsequent rate changes do not affect the payment amount
- Rate source logged for auditing" \
  "module:payments"

create_issue \
  "[Payments] Amount validation and configurable limits" \
  "## Overview
Enforce minimum and maximum payment amounts per merchant.

## Tasks
- [ ] Minimum payment: \$0.50 USD global floor
- [ ] Maximum payment: \$10,000 USD default (configurable per merchant tier)
- [ ] Validate on payment creation
- [ ] Return clear error with allowed range

## Acceptance Criteria
- Sub-minimum amounts rejected with 400
- Over-limit amounts rejected with 400
- Error message states the allowed min/max range" \
  "module:payments"

create_issue \
  "[Payments] Payment module unit and integration tests" \
  "## Overview
Comprehensive tests for the payments module.

## Tasks
- [ ] Unit test \`PaymentsService.create\` (valid, invalid amount, expired)
- [ ] Unit test \`PaymentsService.findAll\` (pagination, filters)
- [ ] Integration test: create payment → Stellar confirm → status update
- [ ] Mock \`StellarService\` for unit tests
- [ ] Test QR code generation output

## Acceptance Criteria
- 90%+ branch coverage on PaymentsService
- Integration tests run against test DB
- Stellar interactions fully mocked in unit tests" \
  "module:payments"

# ─────────────────────────────────────────────
# MODULE: STELLAR (15 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Stellar] Stellar SDK initialization and configuration" \
  "## Overview
Initialize Stellar SDK with Horizon connection, keypair, and network configuration on module startup.

## Tasks
- [ ] Configure Horizon URL from env (testnet/mainnet)
- [ ] Load deposit wallet keypair from \`STELLAR_ACCOUNT_SECRET\`
- [ ] Set USDC asset with configurable issuer address
- [ ] Health check ping on \`onModuleInit\`
- [ ] Log network and account public key on startup

## Acceptance Criteria
- Module fails to start if secret key is invalid
- Testnet and mainnet both supported via env
- Startup log shows network and public key" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar Horizon connection health check" \
  "## Overview
Implement a health check that verifies connectivity to Stellar Horizon.

## Tasks
- [ ] \`GET /health/stellar\` endpoint
- [ ] Ping Horizon server status endpoint
- [ ] Fetch deposit account details to verify key validity
- [ ] Return latency, network name, and XLM balance

## Acceptance Criteria
- Returns degraded if Horizon unreachable
- Returns account public key and balance
- Timeout: 5 seconds" \
  "module:stellar"

create_issue \
  "[Stellar] XLM/USDC to USD exchange rate fetching" \
  "## Overview
Fetch live exchange rates from Stellar DEX for payment amount calculation.

## Tasks
- [ ] Query Stellar DEX orderbook for XLM/USDC pair
- [ ] Fallback to CoinGecko API if DEX orderbook is empty
- [ ] Cache rate for 30 seconds in Redis
- [ ] Expose \`GET /api/v1/rates/xlm\` endpoint

## Acceptance Criteria
- Rate always available (fallback works)
- Cached rate served within 30-second window
- Rate response includes timestamp of last fetch" \
  "module:stellar"

create_issue \
  "[Stellar] Payment monitoring cron job (Horizon polling)" \
  "## Overview
Poll Stellar Horizon every 30 seconds to detect incoming payments to the deposit address.

## Tasks
- [ ] Cron job runs every 30 seconds via \`@nestjs/schedule\`
- [ ] Fetch transactions using cursor-based pagination
- [ ] Persist cursor to Redis to avoid re-processing on restart
- [ ] Match transactions by memo to pending payments
- [ ] Trigger confirmation flow on match

## Acceptance Criteria
- No payment processed twice (cursor-based idempotency)
- Cursor persisted across service restarts
- Runs as no-op when no pending payments exist" \
  "module:stellar"

create_issue \
  "[Stellar] Transaction verification by memo" \
  "## Overview
Verify that an incoming Stellar transaction matches a pending payment by memo.

## Tasks
- [ ] Extract memo from Stellar transaction record
- [ ] Match memo against pending payments in DB
- [ ] Verify asset type (XLM or USDC)
- [ ] Verify amount within ±2% tolerance of expected
- [ ] Handle both memo_text and memo_hash types

## Acceptance Criteria
- Wrong memo → no match, transaction ignored
- Correct memo but wrong asset → rejected
- ±2% tolerance handles minor fee deductions" \
  "module:stellar"

create_issue \
  "[Stellar] USDC payment support on Stellar" \
  "## Overview
Support USDC (Circle USDC on Stellar) in addition to native XLM payments.

## Tasks
- [ ] Configure USDC asset issuer from \`STELLAR_USDC_ISSUER\` env
- [ ] Detect USDC payments in monitoring job
- [ ] Treat 1 USDC = 1 USD for settlement
- [ ] Display USDC as preferred payment option in QR URI
- [ ] Log asset type on payment confirmation

## Acceptance Criteria
- USDC payments detected and confirmed correctly
- 1 USDC = 1 USD (no conversion needed)
- XLM and USDC both supported on same deposit address" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar streaming (real-time transaction events)" \
  "## Overview
Replace cron polling with Stellar Horizon streaming for near-instant payment detection.

## Tasks
- [ ] Use Horizon \`stream()\` API on account transactions
- [ ] Reconnect automatically on stream disconnect (with backoff)
- [ ] Process streamed events same as polled transactions
- [ ] Fall back to cron polling if stream unavailable

## Acceptance Criteria
- Payment detected within 6 seconds of ledger close
- Stream reconnects automatically on network error
- No duplicate processing between stream and fallback cron" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar account balance monitoring and alerts" \
  "## Overview
Monitor the deposit wallet balance and alert when it falls below safe thresholds.

## Tasks
- [ ] Fetch XLM and USDC balance every 10 minutes
- [ ] Alert admin if XLM balance falls below 10 XLM (near minimum reserve)
- [ ] \`GET /api/v1/admin/stellar/balance\` endpoint for admin dashboard
- [ ] Log balance check results

## Acceptance Criteria
- Balance fetched from Horizon accurately
- Admin alerted via email if reserve threshold breached
- Balance visible in admin panel" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar transaction fee estimation" \
  "## Overview
Estimate Stellar transaction fees before submitting operations.

## Tasks
- [ ] Fetch fee stats from Horizon \`/fee_stats\`
- [ ] Use p90 fee for reliable transaction inclusion
- [ ] Cache fee stats for 60 seconds
- [ ] Include estimated fee (in stroops) in payment creation response

## Acceptance Criteria
- Estimated fee returned in payment response
- P90 fee used by default
- Cache prevents excessive Horizon calls" \
  "module:stellar"

create_issue \
  "[Stellar] Multi-signature Stellar transactions for high-value operations" \
  "## Overview
Require multi-sig for high-value outgoing transactions (settlements and refunds above threshold).

## Tasks
- [ ] Configure threshold: transactions > \$1,000 require multi-sig
- [ ] Queue high-value transactions for manual admin approval
- [ ] Admin endpoint to sign and submit pending multi-sig transactions
- [ ] Co-signer keys loaded from secure key management (never in env)

## Acceptance Criteria
- Low-value transactions signed and submitted automatically
- High-value transactions held in \`pending_approval\` queue
- Co-signer private keys never stored in application memory" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar path payment for XLM-to-USDC conversion" \
  "## Overview
Use Stellar path payments to convert received XLM to USDC before fiat settlement.

## Tasks
- [ ] Implement \`pathPaymentStrictReceive\` operation
- [ ] Find best conversion path via Stellar DEX
- [ ] Enforce max slippage tolerance (1%)
- [ ] Log conversion rate and path used on each settlement

## Acceptance Criteria
- XLM automatically converted to USDC via DEX
- Slippage > 1% aborts transaction
- Conversion rate and path logged for auditing" \
  "module:stellar"

create_issue \
  "[Stellar] Testnet vs mainnet environment switching" \
  "## Overview
Support seamless switching between Stellar testnet and mainnet via a single env var.

## Tasks
- [ ] \`STELLAR_NETWORK=TESTNET|PUBLIC\` controls all Stellar interactions
- [ ] Different USDC issuer address per network
- [ ] Testnet payments do not trigger real fiat settlement
- [ ] Response includes network indicator for client awareness

## Acceptance Criteria
- Single env var change switches all Stellar interactions
- Testnet mode labeled in API responses
- No real money movement possible in testnet mode" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar transaction history for admin" \
  "## Overview
Provide admin access to full Stellar transaction history for the deposit account.

## Tasks
- [ ] \`GET /api/v1/admin/stellar/transactions\` — cursor-paginated list
- [ ] Fetch from Horizon with cursor pagination
- [ ] Display: memo, amount, asset, sender, timestamp
- [ ] Link each transaction to matched payment record where applicable

## Acceptance Criteria
- Full history available paginated
- Unmatched transactions visible for edge case detection
- Horizon cursor used for efficient pagination" \
  "module:stellar"

create_issue \
  "[Stellar] Dedicated Stellar sub-account per merchant" \
  "## Overview
Create dedicated Stellar accounts per merchant for isolated fund tracking and direct deposits.

## Tasks
- [ ] Generate Stellar keypair on merchant activation
- [ ] Fund new account with minimum XLM reserve (1.5 XLM) from platform account
- [ ] Store \`stellarPublicKey\` on merchant entity
- [ ] Route payment QR codes to merchant-specific address

## Acceptance Criteria
- Each merchant has a unique Stellar deposit address
- Minimum reserve funded automatically on creation
- Private keys encrypted at rest using \`EncryptionService\`" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar module unit tests" \
  "## Overview
Unit tests for StellarService and StellarMonitorService.

## Tasks
- [ ] Test \`StellarService.verifyPayment\` (correct memo, wrong memo, wrong asset, tolerance)
- [ ] Test \`StellarService.getXlmUsdRate\` (DEX available, fallback to CoinGecko)
- [ ] Test \`StellarMonitorService.scanPendingPayments\` (match, no match, expired)
- [ ] Mock Horizon responses with jest spies

## Acceptance Criteria
- No real Horizon calls in any unit test
- All verification code paths tested
- Rate fallback tested" \
  "module:stellar"

# ─────────────────────────────────────────────
# MODULE: SETTLEMENTS (15 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Settlements] Settlement initiation on payment confirmation" \
  "## Overview
Automatically initiate fiat settlement when a payment is confirmed on Stellar.

## Tasks
- [ ] Triggered by payment status changing to \`confirmed\`
- [ ] Calculate fee and net amount using merchant fee rate
- [ ] Create settlement record in \`settlements\` table
- [ ] Update payment status to \`settling\`
- [ ] Fire \`payment.settling\` webhook

## Acceptance Criteria
- Settlement created within 5 seconds of payment confirmation
- Fee uses merchant-specific rate (fallback to global default)
- Settlement ID linked to payment record" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement fee calculation" \
  "## Overview
Calculate the platform fee for each settlement based on merchant fee rate.

## Tasks
- [ ] Fee = amountUsd × merchant.feeRate
- [ ] Net = amountUsd − fee
- [ ] Apply minimum fee floor: \$0.10
- [ ] Store gross, fee, and net separately on settlement record
- [ ] Return fee breakdown in settlement response

## Acceptance Criteria
- Calculation accurate to 6 decimal places
- Minimum fee floor applied when fee < \$0.10
- Fee breakdown visible to merchant" \
  "module:settlements"

create_issue \
  "[Settlements] Fiat transfer via partner API" \
  "## Overview
Execute the bank transfer via a partner liquidity/payment provider API.

## Tasks
- [ ] POST to partner API with net amount and merchant bank details
- [ ] Handle partner API errors (4xx vs 5xx) differently
- [ ] Store \`partnerReference\` from partner response for reconciliation
- [ ] Retry on transient errors (502, 503) with exponential backoff

## Acceptance Criteria
- Successful transfer updates settlement status to \`completed\`
- Failed transfer updates to \`failed\` with reason stored
- Partner reference stored for bank reconciliation" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement status lifecycle tracking" \
  "## Overview
Track settlement through its full lifecycle: pending → processing → completed/failed.

## Tasks
- [ ] \`SettlementStatus\` enum: pending, processing, completed, failed
- [ ] Update status at each lifecycle stage
- [ ] Record timestamps: processingAt, completedAt, failedAt
- [ ] Expose full status in \`GET /api/v1/settlements/:id\`

## Acceptance Criteria
- All status transitions logged with timestamp
- Terminal states cannot transition further
- Status history queryable via API" \
  "module:settlements"

create_issue \
  "[Settlements] Batch settlement optimization" \
  "## Overview
Group multiple small confirmed payments into single settlement batches to reduce bank transfer fees.

## Tasks
- [ ] Accumulate confirmed payments in a queue every 15 minutes
- [ ] Combine payments from same merchant into one settlement record
- [ ] Minimum batch threshold: \$10 USD
- [ ] Large amounts (> \$500) settled individually and immediately

## Acceptance Criteria
- Payments below \$10 accumulated and batched
- Batch capped at 50 payments maximum
- Large payments settled immediately outside batch window" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement retry with exponential backoff" \
  "## Overview
Automatically retry failed settlements with increasing delays.

## Tasks
- [ ] Auto-retry on partner API failure: up to 3 times
- [ ] Retry delays: 1 min, 5 min, 30 min
- [ ] After 3 failures, mark as permanently failed and alert admin
- [ ] Log each retry attempt with timestamp and error

## Acceptance Criteria
- Transient partner failures recover automatically
- Permanent failure triggers admin alert via email
- Retry count stored and visible on settlement record" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement reporting and CSV export" \
  "## Overview
Allow merchants to view and export their settlement history.

## Tasks
- [ ] \`GET /api/v1/settlements\` with pagination and date range filter
- [ ] \`GET /api/v1/settlements/export?format=csv\` download
- [ ] CSV fields: date, gross, fee, net, currency, status, bankRef, partnerRef
- [ ] Monthly settlement summary endpoint

## Acceptance Criteria
- CSV downloadable with all required fields
- Date range filter works correctly
- Summary includes totals for the filtered period" \
  "module:settlements"

create_issue \
  "[Settlements] Multi-currency settlement support" \
  "## Overview
Settle in multiple fiat currencies based on merchant preference (NGN, USD, EUR, GBP).

## Tasks
- [ ] Fetch live USD→target currency rate from partner API at settlement time
- [ ] Apply conversion and store \`fiatAmount\` and \`fiatCurrency\` on settlement
- [ ] Support merchant \`settlementCurrency\` preference
- [ ] Store conversion rate used for audit trail

## Acceptance Criteria
- Rate fetched fresh at settlement time
- NGN default for Nigerian merchants
- Conversion rate persisted on settlement record" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement notifications to merchant" \
  "## Overview
Notify merchants when their settlement is completed or fails.

## Tasks
- [ ] Email when settlement completes: net amount, bank reference, currency
- [ ] Email when settlement fails: reason, link to retry
- [ ] In-app notification created for both events
- [ ] Respect merchant notification preferences

## Acceptance Criteria
- Email sent within 1 minute of status change
- Bank transfer reference included in success email
- Failure email includes reason and support contact" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement reconciliation report (admin)" \
  "## Overview
Match Stellar transactions to settlements for accounting reconciliation.

## Tasks
- [ ] \`GET /api/v1/admin/reconciliation\` admin endpoint
- [ ] Match each settlement to its originating Stellar tx hash
- [ ] Flag discrepancies: missing tx hash, amount mismatch, duplicate
- [ ] Export as CSV for accounting team

## Acceptance Criteria
- Every settlement traceable to a Stellar transaction
- Discrepancies highlighted clearly in report
- Filterable by date range" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement approval workflow for large amounts" \
  "## Overview
Require manual admin approval before processing settlements above a configurable threshold.

## Tasks
- [ ] Default threshold: \$5,000 USD (configurable via admin settings)
- [ ] Hold large settlements in \`pending_approval\` status
- [ ] Admin endpoint: \`POST /api/v1/admin/settlements/:id/approve\`
- [ ] Admin endpoint: \`POST /api/v1/admin/settlements/:id/reject\`
- [ ] Notify merchant of approval decision

## Acceptance Criteria
- Settlements below threshold process automatically
- Approved settlements proceed to fiat transfer
- Rejected settlements fire \`payment.failed\` webhook" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement audit trail" \
  "## Overview
Maintain a full, immutable audit trail of all actions taken on each settlement.

## Tasks
- [ ] Log events: created, status_changed, retry_attempted, approved, completed, failed
- [ ] Include actor (system or admin), timestamp, and metadata per event
- [ ] \`GET /api/v1/admin/settlements/:id/audit\` endpoint
- [ ] No update or delete on audit entries

## Acceptance Criteria
- Every state transition creates an audit entry
- System actions logged with actor \`system\`
- Audit log queryable by settlement ID" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement webhook events" \
  "## Overview
Fire webhook events at each stage of the settlement lifecycle.

## Tasks
- [ ] \`payment.settling\` — fired when settlement starts
- [ ] \`payment.settled\` — fired when settlement completes
- [ ] \`payment.failed\` — fired when settlement permanently fails
- [ ] Payload includes settlement ID, net amount, currency

## Acceptance Criteria
- All three events fired at the correct lifecycle stage
- Payload includes all relevant settlement details
- Webhook delivery retried on endpoint failure" \
  "module:settlements"

create_issue \
  "[Settlements] Deferred/scheduled settlement option" \
  "## Overview
Allow merchants to opt for scheduled settlement (e.g., end of business day) instead of instant.

## Tasks
- [ ] Merchant setting: instant (default) vs scheduled (daily/weekly)
- [ ] Queue confirmed payments for scheduled batch
- [ ] Process batch at configured time (e.g., 17:00 WAT)
- [ ] Manual trigger endpoint: \`POST /api/v1/settlements/trigger-now\`

## Acceptance Criteria
- Scheduled settlement fires at configured time
- Manual trigger available within schedule window
- All accumulated payments included in the batch" \
  "module:settlements"

create_issue \
  "[Settlements] Settlements module unit tests" \
  "## Overview
Comprehensive tests for the settlements module.

## Tasks
- [ ] Test \`SettlementsService.initiateSettlement\` (success, partner failure)
- [ ] Test fee calculation accuracy including floor
- [ ] Test retry backoff timing
- [ ] Mock partner API with \`nock\`
- [ ] Test webhook dispatch is called correctly

## Acceptance Criteria
- 90%+ branch coverage on SettlementsService
- Partner API failure paths tested
- Fee edge cases covered (minimum fee, zero fee scenario)" \
  "module:settlements"

# ─────────────────────────────────────────────
# MODULE: WEBHOOKS (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Webhooks] Webhook endpoint registration" \
  "## Overview
Allow merchants to register webhook endpoints for payment event delivery.

## Tasks
- [ ] \`POST /api/v1/webhooks\` — create endpoint
- [ ] Accept URL, events array, optional signing secret
- [ ] Auto-generate secret if not provided
- [ ] \`GET /api/v1/webhooks\` — list all endpoints
- [ ] \`DELETE /api/v1/webhooks/:id\` — remove endpoint
- [ ] URL must use HTTPS scheme

## Acceptance Criteria
- Non-HTTPS URLs rejected with 400
- Events validated against allowed event list
- Secret auto-generated and returned once on creation" \
  "module:webhooks"

create_issue \
  "[Webhooks] HMAC-SHA256 webhook payload signing" \
  "## Overview
Sign all webhook payloads with HMAC-SHA256 so receivers can verify authenticity.

## Tasks
- [ ] Sign raw JSON body with merchant webhook secret
- [ ] Include \`X-CheesePay-Signature: sha256=<hex>\` header
- [ ] Include \`X-CheesePay-Event\` and \`X-CheesePay-Timestamp\` headers
- [ ] Document verification example in API docs

## Acceptance Criteria
- Signature computed from raw body bytes, not re-serialized JSON
- Timestamp header prevents replay attacks
- Verification example in multiple languages in docs" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook retry with exponential backoff" \
  "## Overview
Retry failed webhook deliveries automatically with increasing delays.

## Tasks
- [ ] Retry on non-2xx response or timeout (10s limit)
- [ ] Up to 5 retries per event
- [ ] Delays: 1m, 5m, 30m, 2h, 12h
- [ ] Deactivate endpoint after 10 total consecutive failures
- [ ] Log each attempt with response code and latency

## Acceptance Criteria
- Retry schedule followed strictly
- Endpoint deactivated after 10 consecutive failures
- All attempts logged in delivery history" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook delivery logs" \
  "## Overview
Maintain a log of all webhook delivery attempts per endpoint.

## Tasks
- [ ] Log per delivery: event, status code, response body (truncated), latency, timestamp
- [ ] \`GET /api/v1/webhooks/:id/deliveries\` — paginated list
- [ ] Retain logs for 30 days, then auto-purge
- [ ] Filter by event type, success/failure

## Acceptance Criteria
- Every delivery attempt logged
- Response code and latency always recorded
- Failed deliveries filterable" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook test ping endpoint" \
  "## Overview
Let merchants send a test ping to their webhook URL to verify it is working.

## Tasks
- [ ] \`POST /api/v1/webhooks/:id/ping\` endpoint
- [ ] Send a sample \`payment.created\` payload to the webhook URL
- [ ] Return delivery result: success/fail, status code, latency
- [ ] Record ping in delivery history

## Acceptance Criteria
- Ping sends a real HTTP request to the webhook URL
- Returns result within 10-second timeout
- Ping events appear in delivery history" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook event filtering per endpoint" \
  "## Overview
Allow merchants to subscribe to specific event types per webhook endpoint.

## Tasks
- [ ] Accept \`events\` array on creation (\`[\"payment.settled\"]\`)
- [ ] Support wildcard \`*\` to receive all events
- [ ] Only dispatch to endpoints subscribed to the triggered event
- [ ] \`PATCH /api/v1/webhooks/:id\` to update subscribed events

## Acceptance Criteria
- Merchant receives only subscribed events
- Wildcard subscription receives all events
- Event subscriptions updatable after creation" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook secret rotation" \
  "## Overview
Allow merchants to rotate the signing secret for a webhook endpoint.

## Tasks
- [ ] \`POST /api/v1/webhooks/:id/rotate-secret\` endpoint
- [ ] Generate new signing secret
- [ ] Return full secret once (not stored in plaintext)
- [ ] Old secret invalidated immediately on rotation
- [ ] Log rotation in audit trail

## Acceptance Criteria
- New secret returned only at rotation time (not retrievable later)
- Deliveries after rotation use new secret
- Rotation event logged with timestamp and actor" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook payload versioning" \
  "## Overview
Version webhook payloads to allow backward-compatible schema evolution.

## Tasks
- [ ] Include \`apiVersion\` field in all webhook payloads (e.g., \`2024-01\`)
- [ ] Merchants can pin preferred payload version per endpoint
- [ ] Maintain payload transformers per version
- [ ] Document migration path between versions

## Acceptance Criteria
- \`X-CheesePay-Api-Version\` header included on all deliveries
- Old payload format preserved for pinned endpoints
- Default is always the latest version" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook endpoint deactivation and reactivation" \
  "## Overview
Allow merchants and the system to deactivate and reactivate webhook endpoints.

## Tasks
- [ ] \`PATCH /api/v1/webhooks/:id\` with \`{ isActive: false }\` to deactivate
- [ ] System auto-deactivates after 10 consecutive failures
- [ ] \`POST /api/v1/webhooks/:id/activate\` to reactivate and reset failure count
- [ ] Deactivation reason stored (manual vs auto)

## Acceptance Criteria
- Deactivated endpoints receive no deliveries
- Reactivation resets failure counter to zero
- Deactivation reason persisted on record" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhooks module unit tests" \
  "## Overview
Unit and integration tests for the webhooks module.

## Tasks
- [ ] Test \`WebhooksService.dispatch\` (event matches, no match, inactive endpoint)
- [ ] Test HMAC signature generation and verification
- [ ] Test retry schedule and deactivation threshold
- [ ] Test ping endpoint response handling
- [ ] Mock HTTP calls with \`nock\`

## Acceptance Criteria
- Dispatch only sends to matching, active endpoints
- Signature tests verify correct header format
- Deactivation after 10 failures tested explicitly" \
  "module:webhooks"

# ─────────────────────────────────────────────
# MODULE: WAITLIST (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Waitlist] Waitlist registration endpoint" \
  "## Overview
Allow potential merchants to join the waitlist before full platform launch.

## Tasks
- [ ] \`POST /api/v1/waitlist/join\` endpoint (public, no auth)
- [ ] Accept: email, username (optional), businessName, country
- [ ] Reject duplicate emails with 409 Conflict
- [ ] Send confirmation email on join

## Acceptance Criteria
- Duplicate email returns 409
- Confirmation email sent within 1 minute
- Entry visible in admin waitlist view" \
  "module:waitlist"

create_issue \
  "[Waitlist] Username availability check" \
  "## Overview
Allow users to check if a desired username is available before joining.

## Tasks
- [ ] \`GET /api/v1/waitlist/check/:username\` (public)
- [ ] Return \`{ available: boolean }\`
- [ ] Case-insensitive comparison
- [ ] Rate limit: 10 checks per minute per IP

## Acceptance Criteria
- Returns \`available: false\` for taken usernames
- Case-insensitive (john = JOHN = John)
- Rate limited to prevent username enumeration" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist position and signup stats" \
  "## Overview
Show users their queue position and display total waitlist signups publicly.

## Tasks
- [ ] \`GET /api/v1/waitlist/stats\` — total count (public)
- [ ] \`GET /api/v1/waitlist/position?email=xxx\` — position number
- [ ] Position based on \`createdAt\` chronological order
- [ ] Cache stats for 60 seconds

## Acceptance Criteria
- Position is accurate and 1-indexed
- Unknown email returns 404
- Stats cached, not recomputed on every request" \
  "module:waitlist"

create_issue \
  "[Waitlist] Referral system to advance queue position" \
  "## Overview
Allow waitlist members to refer others and jump ahead in the queue as reward.

## Tasks
- [ ] Generate unique referral code per member on join
- [ ] Accept \`referralCode\` on join request
- [ ] Track referral count per member
- [ ] Move referrer up 5 positions per successful referral
- [ ] Prevent self-referral

## Acceptance Criteria
- Referral code unique per member
- Self-referral returns 400
- Position update immediate on successful referral" \
  "module:waitlist"

create_issue \
  "[Waitlist] Admin waitlist management" \
  "## Overview
Allow admins to view, filter, and approve waitlist members.

## Tasks
- [ ] \`GET /api/v1/admin/waitlist\` — paginated list with search/filter
- [ ] \`POST /api/v1/admin/waitlist/:id/approve\` — grant platform access
- [ ] Approval triggers merchant account creation + onboarding email
- [ ] Filter by country, date range, referral count

## Acceptance Criteria
- Approval creates active merchant account
- Approved member receives login credentials via email
- Admin can sort and filter waitlist" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist email notification campaign" \
  "## Overview
Send bulk email announcements to waitlist members (launch updates, invites).

## Tasks
- [ ] \`POST /api/v1/admin/waitlist/notify\` — send campaign
- [ ] Accept: subject, body (Markdown), target (all or filter)
- [ ] Preview endpoint before sending
- [ ] Respect unsubscribe preferences

## Acceptance Criteria
- Bulk email respects unsubscribed members
- Preview mode available before actual send
- Send report available after campaign" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist export for CRM/marketing" \
  "## Overview
Export waitlist data for import into CRM or email marketing tools.

## Tasks
- [ ] \`GET /api/v1/admin/waitlist/export\` — CSV download
- [ ] Fields: email, username, businessName, country, position, referrals, createdAt
- [ ] Filter by country and date range
- [ ] Exclude unsubscribed members by default

## Acceptance Criteria
- CSV includes all required fields
- Unsubscribed members excluded by default (opt-in to include)
- File downloadable immediately" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist unsubscribe and GDPR deletion" \
  "## Overview
Allow waitlist members to unsubscribe from emails or fully delete their entry.

## Tasks
- [ ] One-click unsubscribe link in all waitlist emails (no login required)
- [ ] \`POST /api/v1/waitlist/unsubscribe?token=xxx\` endpoint
- [ ] \`DELETE /api/v1/waitlist?email=xxx&token=xxx\` — full data deletion
- [ ] Deletion confirmation email sent

## Acceptance Criteria
- Unsubscribe works without login
- Full deletion removes all PII within 30 days (GDPR)
- Confirmation email sent on deletion request" \
  "module:waitlist"

# ─────────────────────────────────────────────
# MODULE: ADMIN (15 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Admin] Admin authentication and authorization" \
  "## Overview
Separate authentication flow for admin users with elevated privileges.

## Tasks
- [ ] \`AdminUser\` entity separate from merchant entity
- [ ] \`POST /api/v1/admin/auth/login\` endpoint
- [ ] Admin JWT with \`role: admin\` claim, 8h expiry
- [ ] All \`/api/v1/admin/*\` routes require admin JWT
- [ ] Admin accounts created via CLI seed/script only

## Acceptance Criteria
- Merchant JWT rejected on admin routes
- Admin login uses separate credential store
- 2FA enforced on all admin accounts" \
  "module:admin"

create_issue \
  "[Admin] Admin dashboard overview metrics" \
  "## Overview
Real-time platform overview for admins: key metrics and system health.

## Tasks
- [ ] \`GET /api/v1/admin/stats\` endpoint
- [ ] Metrics: total merchants, total payments, total settled volume (USD)
- [ ] Active payments in last 24 hours
- [ ] System health: DB, Stellar, partner API status

## Acceptance Criteria
- Stats computed from live DB (cached 30s)
- Stellar connectivity status included
- Response < 200ms with cache hit" \
  "module:admin"

create_issue \
  "[Admin] Merchant management — list, view, update, suspend" \
  "## Overview
Full admin CRUD for merchant accounts.

## Tasks
- [ ] \`GET /api/v1/admin/merchants\` — paginated with search
- [ ] \`GET /api/v1/admin/merchants/:id\` — full detail including internal fields
- [ ] \`PATCH /api/v1/admin/merchants/:id\` — update any field
- [ ] \`PATCH /api/v1/admin/merchants/:id/status\` — activate/suspend

## Acceptance Criteria
- Search by email, businessName, country
- Status change triggers email notification to merchant
- All changes logged in audit trail" \
  "module:admin"

create_issue \
  "[Admin] Platform-wide payment oversight" \
  "## Overview
Allow admins to view all payments across all merchants.

## Tasks
- [ ] \`GET /api/v1/admin/payments\` — paginated, filterable
- [ ] Filter by: merchantId, status, network, dateRange, minAmount
- [ ] \`GET /api/v1/admin/payments/:id\` — full payment detail
- [ ] Include Stellar.expert link for each transaction

## Acceptance Criteria
- Admin sees all merchants' payments
- Stellar transaction link generated automatically
- All internal fields visible to admin" \
  "module:admin"

create_issue \
  "[Admin] Settlement oversight and manual operations" \
  "## Overview
Admin view of all settlements with ability to manually trigger or retry.

## Tasks
- [ ] \`GET /api/v1/admin/settlements\` — all settlements with filters
- [ ] \`POST /api/v1/admin/settlements/:id/retry\` — force retry
- [ ] \`POST /api/v1/admin/settlements/:id/approve\` — approve large amount
- [ ] Partner API reference visible per settlement

## Acceptance Criteria
- Admin can force retry any failed settlement
- Large settlement approval workflow enforced
- Partner reference visible for bank reconciliation" \
  "module:admin"

create_issue \
  "[Admin] Platform fee configuration" \
  "## Overview
Admin management of global and per-merchant fee rates.

## Tasks
- [ ] \`GET /api/v1/admin/fees\` — current global fee config
- [ ] \`PATCH /api/v1/admin/fees\` — update global default fee rate
- [ ] Per-merchant override via merchant update endpoint
- [ ] Fee changes take effect on next settlement

## Acceptance Criteria
- Global fee change affects merchants without custom rate
- Custom merchant rate preserved when global changes
- Fee history auditable" \
  "module:admin"

create_issue \
  "[Admin] Platform-wide audit log viewer" \
  "## Overview
Unified admin view of all system audit events across all modules.

## Tasks
- [ ] \`GET /api/v1/admin/audit-log\` — paginated event log
- [ ] Filter by: actor, action, resourceType, dateRange
- [ ] Export to CSV
- [ ] Immutable (no delete endpoint)

## Acceptance Criteria
- All audit events from all modules visible
- CSV export includes all fields
- Endpoint read-only — no modifications" \
  "module:admin"

create_issue \
  "[Admin] AML transaction monitoring and flagging" \
  "## Overview
Flag suspicious transaction patterns for AML review.

## Tasks
- [ ] Auto-flag payments > \$10,000 USD
- [ ] Auto-flag merchants with > 50 payments/day velocity
- [ ] Admin dashboard for reviewing flagged items
- [ ] Admin can clear or escalate flags
- [ ] Flagged items do not automatically block settlement

## Acceptance Criteria
- Flagged payments do not block settlement (advisory only)
- Admin notified of new flags via email
- Flag history maintained per merchant" \
  "module:admin"

create_issue \
  "[Admin] System health monitoring dashboard" \
  "## Overview
Aggregated health status of all system components for admin visibility.

## Tasks
- [ ] \`GET /api/v1/admin/health\` — per-component health check
- [ ] Components: DB, Stellar Horizon, partner API, Redis, queue
- [ ] Return per-component: status (ok/degraded/down) and latency
- [ ] Overall status: healthy / degraded / down

## Acceptance Criteria
- All components checked on each request
- Response time < 2 seconds (parallel checks)
- 503 returned if any critical component down" \
  "module:admin"

create_issue \
  "[Admin] Compliance reporting (PCI-DSS)" \
  "## Overview
Generate compliance reports for PCI-DSS and financial regulation requirements.

## Tasks
- [ ] Access control report: who accessed what and when
- [ ] Data retention policy enforcement report
- [ ] Failed authentication report
- [ ] Settlement reconciliation report
- [ ] Exportable as PDF for auditors

## Acceptance Criteria
- Reports cover required PCI-DSS scope
- Generated on demand via admin endpoint
- Downloadable PDF format" \
  "module:admin"

create_issue \
  "[Admin] Bulk merchant actions" \
  "## Overview
Allow admins to perform actions on multiple merchants at once.

## Tasks
- [ ] \`POST /api/v1/admin/merchants/bulk/suspend\` — suspend many
- [ ] \`POST /api/v1/admin/merchants/bulk/activate\` — activate many
- [ ] Accept array of merchant IDs (max 100)
- [ ] Return per-ID result (success/error)

## Acceptance Criteria
- Partial success returns per-item status
- Maximum 100 IDs per request
- All actions individually audited" \
  "module:admin"

create_issue \
  "[Admin] Admin alert and notification system" \
  "## Overview
Notify admins of critical platform events requiring attention.

## Tasks
- [ ] Alert types: low Stellar balance, settlement failure spike, suspicious activity, DLQ overflow
- [ ] Email + Slack notification channels
- [ ] Configurable thresholds per alert type
- [ ] Alert acknowledgment to suppress re-alerting

## Acceptance Criteria
- Alerts sent within 1 minute of trigger condition
- Each alert type has configurable threshold
- Acknowledged alerts not re-sent within cooldown period" \
  "module:admin"

create_issue \
  "[Admin] Admin user management (create, remove, 2FA)" \
  "## Overview
Super-admin management of admin user accounts.

## Tasks
- [ ] Super-admin role above admin
- [ ] \`POST /api/v1/admin/users\` — create new admin
- [ ] \`DELETE /api/v1/admin/users/:id\` — remove admin
- [ ] 2FA enforced on all admin accounts at login
- [ ] IP allowlisting for admin login

## Acceptance Criteria
- Only super-admin can create/delete admin users
- 2FA mandatory, cannot be disabled
- Admin creation logged in audit trail" \
  "module:admin"

create_issue \
  "[Admin] Sandbox environment management" \
  "## Overview
Manage the sandbox/testnet environment for merchant developer testing.

## Tasks
- [ ] Admin endpoint to toggle sandbox mode per merchant
- [ ] Sandbox uses Stellar testnet, no real fiat settlement
- [ ] Seed test data (test USDC faucet) for sandbox merchants
- [ ] Admin endpoint to reset sandbox data per merchant

## Acceptance Criteria
- Sandbox payments never trigger real settlements
- Sandbox mode clearly labeled in all API responses
- Test USDC faucet endpoint available for sandbox merchants" \
  "module:admin"

create_issue \
  "[Admin] Admin module unit tests" \
  "## Overview
Tests for admin module services and controllers.

## Tasks
- [ ] Test admin auth (valid, merchant JWT rejected, role enforcement)
- [ ] Test merchant CRUD (found, not found, status transition)
- [ ] Test bulk actions with partial failure
- [ ] Test stats aggregation query
- [ ] Mock all service dependencies

## Acceptance Criteria
- Role enforcement tested for all admin routes
- Bulk action partial failure explicitly tested
- 85%+ branch coverage on admin service" \
  "module:admin"

# ─────────────────────────────────────────────
# MODULE: ANALYTICS (12 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Analytics] Payment volume time-series metrics" \
  "## Overview
Track and expose payment volume over time for merchant and admin dashboards.

## Tasks
- [ ] Daily volume aggregation: count and USD total
- [ ] Monthly volume aggregation
- [ ] \`GET /api/v1/analytics/volume?period=daily&dateFrom=&dateTo=\`
- [ ] Fill date gaps with zero entries
- [ ] Cache results for 5 minutes

## Acceptance Criteria
- Returns \`[{date, count, volumeUsd}]\` array
- Zero-filled for days with no activity
- Merchant-scoped and admin-global endpoints" \
  "module:analytics"

create_issue \
  "[Analytics] Revenue analytics — platform fees earned" \
  "## Overview
Track platform fee revenue over time for merchant and admin reporting.

## Tasks
- [ ] Aggregate fee revenue by day/month from settlement records
- [ ] \`GET /api/v1/analytics/revenue\`
- [ ] Merchant view: fees they've paid
- [ ] Admin view: total platform revenue across all merchants

## Acceptance Criteria
- Fee revenue matches settlement fee records exactly
- Period-over-period comparison supported
- Response includes period totals and daily breakdown" \
  "module:analytics"

create_issue \
  "[Analytics] Settlement conversion funnel" \
  "## Overview
Track the percentage of created payments that convert through to settlement.

## Tasks
- [ ] Calculate: created → confirmed → settling → settled conversion at each stage
- [ ] Identify drop-off count at each step
- [ ] \`GET /api/v1/analytics/funnel\`
- [ ] Filter by date range and network

## Acceptance Criteria
- Funnel shows count and percentage at each stage
- Expired and failed tracked separately from settled
- Period comparison supported" \
  "module:analytics"

create_issue \
  "[Analytics] Merchant growth metrics (admin)" \
  "## Overview
Track merchant signups, activation, and retention for admin business intelligence.

## Tasks
- [ ] Daily new merchant signups trend
- [ ] Activation rate: registered → first payment created
- [ ] Monthly active merchants (at least one payment)
- [ ] \`GET /api/v1/admin/analytics/merchants\`

## Acceptance Criteria
- Signup trends visible by day/week/month
- Activation funnel percentage calculated
- Monthly active metric available" \
  "module:analytics"

create_issue \
  "[Analytics] Geographic distribution of payment volume" \
  "## Overview
Track which countries are generating the most payment activity.

## Tasks
- [ ] Group payment volume and count by merchant country
- [ ] \`GET /api/v1/admin/analytics/geography\`
- [ ] Return: country ISO code, merchantCount, paymentCount, volumeUsd
- [ ] Sortable by any field

## Acceptance Criteria
- Data grouped by ISO 3166-1 alpha-2 country code
- Sortable by volume, merchant count, or payment count
- Powers heatmap visualization on admin dashboard" \
  "module:analytics"

create_issue \
  "[Analytics] Top merchants by volume report" \
  "## Overview
Identify the highest-volume merchants for platform performance analysis.

## Tasks
- [ ] \`GET /api/v1/admin/analytics/top-merchants?limit=10\`
- [ ] Rank by total USD volume in selected period
- [ ] Include: businessName, volume, paymentCount, settlementCount, country
- [ ] Cache for 10 minutes

## Acceptance Criteria
- Returns top N merchants by volume (configurable)
- Period filterable: 7d, 30d, 90d
- Tied merchants ordered by payment count" \
  "module:analytics"

create_issue \
  "[Analytics] Real-time live metrics endpoint" \
  "## Overview
Live-updating counters for the admin operations dashboard.

## Tasks
- [ ] \`GET /api/v1/admin/analytics/live\`
- [ ] Payments in the last 1 hour
- [ ] Pending settlements count and value
- [ ] Stellar monitor job last run time and status
- [ ] Response max age: 60 seconds

## Acceptance Criteria
- Data no older than 60 seconds
- Endpoint responds in < 100ms
- Frontend can poll safely every 30 seconds" \
  "module:analytics"

create_issue \
  "[Analytics] Period-over-period comparative analytics" \
  "## Overview
Compare current period metrics to the previous equivalent period.

## Tasks
- [ ] \`compareWith=previous\` query param on analytics endpoints
- [ ] Return current and previous period data side-by-side
- [ ] Calculate % change per metric
- [ ] Handle zero-previous-period edge case gracefully

## Acceptance Criteria
- % change calculated correctly
- Zero previous period shows \`null\` not divide-by-zero
- Both periods returned in a single response object" \
  "module:analytics"

create_issue \
  "[Analytics] Analytics PDF report generation" \
  "## Overview
Generate a branded PDF analytics report for a given period.

## Tasks
- [ ] \`POST /api/v1/analytics/export?format=pdf\`
- [ ] Include: volume chart, key stats, settlement summary, top metrics
- [ ] Merchant business name in header
- [ ] Generated async, download link sent via email

## Acceptance Criteria
- PDF includes all key metrics for period
- Merchant name in document header
- Download link expires after 24 hours" \
  "module:analytics"

create_issue \
  "[Analytics] Analytics Redis caching layer" \
  "## Overview
Cache expensive analytics queries to avoid repeated DB aggregations.

## Tasks
- [ ] Cache key: \`analytics:{merchantId}:{endpoint}:{dateRange}\`
- [ ] TTL: 5 minutes merchant, 10 minutes admin
- [ ] Invalidate on \`payment.settled\` event
- [ ] Compress large payloads before Redis storage

## Acceptance Criteria
- Cached response < 20ms
- Uncached computed within 2 seconds
- Cache invalidated when new payment settles" \
  "module:analytics"

create_issue \
  "[Analytics] Network breakdown — volume by blockchain" \
  "## Overview
Break down payment volume by blockchain network for chain-specific insights.

## Tasks
- [ ] Group payments by \`network\` field
- [ ] \`GET /api/v1/analytics/networks\`
- [ ] Return: network, count, volumeUsd, percentOfTotal
- [ ] Historical trend per network over time

## Acceptance Criteria
- All supported networks shown even with zero volume
- Percentage calculated correctly (sums to 100%)
- Sortable by volume" \
  "module:analytics"

create_issue \
  "[Analytics] Analytics module tests" \
  "## Overview
Tests for analytics queries and aggregation logic.

## Tasks
- [ ] Test daily/monthly volume aggregation with known data
- [ ] Test funnel calculation (counts, percentages)
- [ ] Test period comparison including zero-previous edge case
- [ ] Test cache hit/miss behavior
- [ ] Use seeded in-memory or test DB

## Acceptance Criteria
- Edge cases tested: no data period, single record
- Cache hit and miss both explicitly tested
- Date range boundary conditions tested" \
  "module:analytics"

# ─────────────────────────────────────────────
# MODULE: SECURITY (12 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Security] Global rate limiting with @nestjs/throttler" \
  "## Overview
Apply rate limiting across all API endpoints to prevent brute force and abuse.

## Tasks
- [ ] Install and configure \`@nestjs/throttler\`
- [ ] Default global limit: 100 req/min per IP
- [ ] Higher limits for authenticated merchants (1,000 req/min)
- [ ] Return 429 with \`Retry-After\` header
- [ ] Exempt \`/health\` from limits

## Acceptance Criteria
- IP-based limiting for unauthenticated requests
- Merchant-level limiting for authenticated requests
- Health endpoint not rate-limited" \
  "module:security"

create_issue \
  "[Security] Helmet.js security headers" \
  "## Overview
Apply standard security HTTP headers to all responses.

## Tasks
- [ ] Install and configure \`helmet\` in NestJS bootstrap
- [ ] Enable: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- [ ] Customize CSP to allow Swagger UI
- [ ] Remove \`X-Powered-By\` header

## Acceptance Criteria
- All Helmet defaults enabled
- Swagger UI functional with CSP active
- X-Powered-By absent from all responses" \
  "module:security"

create_issue \
  "[Security] CORS configuration for trusted origins" \
  "## Overview
Restrict API cross-origin access to trusted frontend domains only.

## Tasks
- [ ] \`ALLOWED_ORIGINS\` env var (comma-separated list)
- [ ] Restrict in production; allow all in development
- [ ] Support credentials mode for cookie-based auth
- [ ] Proper OPTIONS preflight response

## Acceptance Criteria
- Unknown origins rejected with CORS error
- Preflight responds with correct allow headers
- Credentials mode works for the frontend domain" \
  "module:security"

create_issue \
  "[Security] Input validation and sanitization (global ValidationPipe)" \
  "## Overview
Validate and sanitize all incoming request data globally.

## Tasks
- [ ] Global \`ValidationPipe\` with \`whitelist: true, transform: true\`
- [ ] Strip properties not in DTO (whitelist)
- [ ] \`forbidNonWhitelisted: false\` (silently strip, don't error)
- [ ] Validate UUID path params
- [ ] Sanitize strings: trim whitespace

## Acceptance Criteria
- Unknown body fields silently stripped
- Invalid UUIDs in path params return 400
- Validation errors include field-level detail" \
  "module:security"

create_issue \
  "[Security] API key scoping — read/write permission model" \
  "## Overview
Support scoped API keys that restrict what operations can be performed.

## Tasks
- [ ] Scopes: \`payments:read\`, \`payments:write\`, \`settlements:read\`, \`webhooks:manage\`
- [ ] Store scopes on API key record
- [ ] \`ApiKeyGuard\` enforces scope per endpoint
- [ ] Return 403 Forbidden if scope insufficient

## Acceptance Criteria
- Read-only key cannot create payments or webhooks
- Scope validated at guard level, not service
- Current scopes visible in merchant profile" \
  "module:security"

create_issue \
  "[Security] AES-256-GCM encrypted field storage" \
  "## Overview
Encrypt sensitive entity fields at rest (bank account numbers, Stellar private keys).

## Tasks
- [ ] Implement \`EncryptionService\` using AES-256-GCM
- [ ] TypeORM column transformer applies encrypt on write, decrypt on read
- [ ] Encryption key from 32-byte \`ENCRYPTION_KEY\` env var
- [ ] Never log decrypted values

## Acceptance Criteria
- Encrypted fields are unreadable in DB dump without key
- Decryption failure logged as security event and service errors gracefully
- Key rotation process documented" \
  "module:security"

create_issue \
  "[Security] Centralized audit logging service" \
  "## Overview
Injectable audit service that records all security-relevant actions across modules.

## Tasks
- [ ] \`AuditService.log({ actor, action, resource, before, after, ip })\`
- [ ] Store in append-only \`audit_logs\` table
- [ ] Auto-applied via interceptor for sensitive endpoints
- [ ] No update or delete operations on audit records

## Acceptance Criteria
- All sensitive actions produce an audit entry
- Actor, resource, and timestamp always recorded
- Audit table protected from modification at DB level" \
  "module:security"

create_issue \
  "[Security] IP allowlisting for admin endpoints" \
  "## Overview
Restrict admin API access to a configured list of trusted IP addresses.

## Tasks
- [ ] \`ADMIN_ALLOWED_IPS\` env var (comma-separated CIDR or IP)
- [ ] IP allowlist guard applied to all \`/api/v1/admin/*\` routes
- [ ] Return 403 for requests from non-whitelisted IPs
- [ ] Log blocked access attempts as security events

## Acceptance Criteria
- Admin routes inaccessible from unlisted IPs
- Empty allowlist defaults to block all (secure default)
- Development mode flag can bypass (never in prod)" \
  "module:security"

create_issue \
  "[Security] Partner API webhook signature validation" \
  "## Overview
Validate HMAC signatures on incoming callbacks from the fiat partner API.

## Tasks
- [ ] Partner sends \`X-Partner-Signature\` header
- [ ] Validate HMAC-SHA256 against shared partner secret
- [ ] Reject invalid signatures with 403
- [ ] Use timing-safe comparison (\`crypto.timingSafeEqual\`)
- [ ] Log verification failures as security events

## Acceptance Criteria
- Invalid signature returns 403 immediately
- Timing-safe comparison prevents timing attacks
- Verification failures logged and alerted" \
  "module:security"

create_issue \
  "[Security] SQL injection prevention via parameterized queries" \
  "## Overview
Ensure all DB queries use parameterized inputs to prevent SQL injection.

## Tasks
- [ ] Enforce TypeORM query builder with parameters only
- [ ] Ban raw SQL string concatenation (ESLint rule)
- [ ] Add \`eslint-plugin-security\` to identify dangerous patterns
- [ ] CI check fails if raw SQL patterns detected

## Acceptance Criteria
- No raw SQL concatenation exists in codebase
- ESLint flags dangerous patterns as errors
- All dynamic queries use \`QueryBuilder\` with bound params" \
  "module:security"

create_issue \
  "[Security] PCI-DSS compliance documentation and controls" \
  "## Overview
Document and implement PCI-DSS applicable controls for the platform.

## Tasks
- [ ] Determine scope: SAQ-A or SAQ-D
- [ ] Implement access control per PCI Requirement 7
- [ ] Enforce TLS 1.2+ on all endpoints
- [ ] Document vulnerability management process
- [ ] Annual review schedule established

## Acceptance Criteria
- PCI scope determination documented
- All applicable controls implemented and documented
- Annual review calendar created" \
  "module:security"

create_issue \
  "[Security] Automated dependency vulnerability scanning" \
  "## Overview
Automate scanning for known vulnerabilities in npm dependencies.

## Tasks
- [ ] \`npm audit\` step in CI pipeline
- [ ] Configure Dependabot for automatic patch PRs
- [ ] CI fails on high/critical severity findings
- [ ] Weekly audit report emailed to admin

## Acceptance Criteria
- CI fails on high/critical CVEs
- Dependabot PRs created automatically for patches
- Weekly report generated and delivered" \
  "module:security"

# ─────────────────────────────────────────────
# MODULE: NOTIFICATIONS (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Notifications] Email notification service with HTML templates" \
  "## Overview
Reusable email notification service using a provider and Handlebars templates.

## Tasks
- [ ] Integrate Nodemailer with SMTP or SendGrid
- [ ] HTML templates via Handlebars
- [ ] Plaintext fallback for all emails
- [ ] Template variables: merchant name, amount, reference, etc.
- [ ] Failed sends logged and retried once

## Acceptance Criteria
- Emails render in major clients (Gmail, Outlook)
- Template variables populated correctly for all templates
- SMTP failures retried once then logged" \
  "module:notifications"

create_issue \
  "[Notifications] Payment confirmed email to merchant" \
  "## Overview
Email merchant when a payment is confirmed on Stellar.

## Tasks
- [ ] Template: payment confirmed, amount (USD + XLM/USDC), reference, Stellar tx link
- [ ] Sent within 30 seconds of confirmation
- [ ] Respect merchant notification preferences
- [ ] Include link to payment detail page

## Acceptance Criteria
- Sent to merchant email within 30 seconds of confirmation
- Stellar Explorer tx link included
- Skipped if merchant disabled this notification type" \
  "module:notifications"

create_issue \
  "[Notifications] Settlement completed email to merchant" \
  "## Overview
Email merchant when fiat settlement has been completed and funds transferred.

## Tasks
- [ ] Template: net amount, fee, currency, bank reference, date
- [ ] Itemized fee breakdown in email body
- [ ] Link to settlement detail page
- [ ] Sent within 1 minute of settlement.completed status

## Acceptance Criteria
- Net amount and fee shown separately
- Bank transfer reference included
- Delivered within 1 minute of status change" \
  "module:notifications"

create_issue \
  "[Notifications] Settlement failure alert to merchant and admin" \
  "## Overview
Immediate alert when a settlement fails permanently.

## Tasks
- [ ] Template for merchant: failure reason, payment reference, retry link
- [ ] Separate template for admin: same data plus partner error detail
- [ ] Both sent within 1 minute of permanent failure
- [ ] Admin alert also goes to Slack (if configured)

## Acceptance Criteria
- Merchant email sent immediately on permanent failure
- Admin notified simultaneously
- Failure reason included in both emails" \
  "module:notifications"

create_issue \
  "[Notifications] Customer payment receipt email" \
  "## Overview
Send a receipt email to the customer who made the payment.

## Tasks
- [ ] Only sent when \`customerEmail\` provided on payment creation
- [ ] Sent on \`payment.settled\` (not just confirmed)
- [ ] Template: merchant name, amount, date, receipt reference
- [ ] Include receipt download link

## Acceptance Criteria
- Only sent when customerEmail is present
- Merchant business name shown (not internal merchant ID)
- Triggers on settled status, not confirmed" \
  "module:notifications"

create_issue \
  "[Notifications] Webhook endpoint failure alert" \
  "## Overview
Alert merchant when their webhook endpoint fails repeatedly.

## Tasks
- [ ] Alert at 3 consecutive failures: endpoint URL, last error
- [ ] Second alert at 7 failures with urgency
- [ ] Final alert at 10 failures with deactivation notice
- [ ] Include link to webhook settings in each alert

## Acceptance Criteria
- First alert sent at 3rd consecutive failure
- Escalating urgency in subsequent alerts
- No duplicate alerts within the same failure streak" \
  "module:notifications"

create_issue \
  "[Notifications] Web Push notifications for merchant dashboard (PWA)" \
  "## Overview
Push browser notifications to merchants using the Web Push API.

## Tasks
- [ ] Integrate \`web-push\` package
- [ ] \`POST /api/v1/merchants/me/push-subscription\` — register device
- [ ] Push on payment.confirmed and payment.settled events
- [ ] Merchant can opt out via notification preferences

## Acceptance Criteria
- Push received within 5 seconds of event
- Works on Chrome and Firefox
- Merchant can disable push per event type" \
  "module:notifications"

create_issue \
  "[Notifications] In-app notification center" \
  "## Overview
Store and serve in-app notifications for the merchant dashboard.

## Tasks
- [ ] \`notifications\` entity: merchantId, type, message, read, createdAt
- [ ] \`GET /api/v1/notifications\` — unread count and list
- [ ] \`PATCH /api/v1/notifications/:id/read\`
- [ ] \`PATCH /api/v1/notifications/read-all\`
- [ ] Auto-delete notifications older than 30 days

## Acceptance Criteria
- Unread count accurate and fast (< 50ms)
- Notifications created automatically on payment events
- 30-day auto-purge prevents table growth" \
  "module:notifications"

create_issue \
  "[Notifications] Notification channel preference management" \
  "## Overview
Let merchants control notification channels (email, push, in-app) per event type.

## Tasks
- [ ] \`GET /api/v1/merchants/me/notification-prefs\`
- [ ] \`PATCH /api/v1/merchants/me/notification-prefs\`
- [ ] Channels: email, push, in-app
- [ ] Events: payment.confirmed, payment.settled, settlement.failed
- [ ] In-app always enabled (cannot disable)

## Acceptance Criteria
- Preferences persisted per channel per event
- Disabling email for an event stops that email type
- In-app notifications cannot be disabled" \
  "module:notifications"

create_issue \
  "[Notifications] Notifications module unit tests" \
  "## Overview
Tests for notifications module services.

## Tasks
- [ ] Test template rendering with all variable combinations
- [ ] Test notification dispatch respects preferences
- [ ] Test push subscription registration and delivery
- [ ] Test in-app CRUD (create, read, mark read, bulk read, delete)
- [ ] Mock email provider to avoid real sends

## Acceptance Criteria
- All email template variable combinations tested
- Preference enforcement tested (disabled channel skipped)
- Mock provider assertions verify correct template/recipient" \
  "module:notifications"

# ─────────────────────────────────────────────
# MODULE: DATABASE (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Database] TypeORM entity configuration and relationships" \
  "## Overview
Define all TypeORM entities with proper FK relationships, indices, and constraints.

## Tasks
- [ ] FK constraints with \`onDelete\` behavior defined
- [ ] Composite unique constraints where required
- [ ] Index all FK and frequently queried columns
- [ ] Cascade delete on appropriate child relationships

## Acceptance Criteria
- All FK constraints defined in entity metadata
- Unique constraints prevent duplicate data
- Query EXPLAIN shows index usage on common queries" \
  "module:database"

create_issue \
  "[Database] Migration system with TypeORM CLI" \
  "## Overview
Set up TypeORM migrations for safe, production-grade schema management.

## Tasks
- [ ] Configure TypeORM CLI in \`package.json\` scripts
- [ ] \`migration:generate\` from entity diff
- [ ] \`migration:run\` to apply pending migrations
- [ ] \`migration:revert\` to roll back last migration
- [ ] CI check for uncommitted migration files

## Acceptance Criteria
- Migrations run without data loss on existing data
- Revert cleanly undoes the last migration
- \`synchronize: false\` enforced in all environments" \
  "module:database"

create_issue \
  "[Database] Development and test database seeding" \
  "## Overview
Seed scripts for local development and predictable test data.

## Tasks
- [ ] Seed: 1 admin, 3 merchants, payments in all statuses, settlements
- [ ] \`npm run db:seed\` command
- [ ] \`npm run db:reset\` — drop, migrate, seed
- [ ] Separate seed for test environment with predictable IDs

## Acceptance Criteria
- Seed runs idempotently (safe to re-run)
- Test seed creates fixed IDs for assertions
- Reset command usable in CI pipelines" \
  "module:database"

create_issue \
  "[Database] PostgreSQL connection pooling configuration" \
  "## Overview
Tune connection pool settings for production reliability and performance.

## Tasks
- [ ] Pool min: 2, max: 20 (configurable via env)
- [ ] \`acquireTimeoutMillis\`: 10s
- [ ] \`idleTimeoutMillis\`: 60s
- [ ] PgBouncer configuration guide for horizontal scaling

## Acceptance Criteria
- No connection leaks under sustained load
- Pool exhaustion logged as warning with pool stats
- All pool settings configurable via env vars" \
  "module:database"

create_issue \
  "[Database] Soft delete for merchants and payments" \
  "## Overview
Implement soft delete on key entities to allow data recovery and meet retention requirements.

## Tasks
- [ ] \`@DeleteDateColumn() deletedAt\` on Merchant, Payment entities
- [ ] TypeORM \`withDeleted()\` for admin queries
- [ ] Normal queries automatically exclude soft-deleted records
- [ ] Admin restore endpoint: \`POST /admin/:entity/:id/restore\`

## Acceptance Criteria
- Soft-deleted records excluded from all merchant-facing queries
- Admin can view and restore soft-deleted records
- Hard delete only available to super-admin" \
  "module:database"

create_issue \
  "[Database] Index strategy for query performance" \
  "## Overview
Create targeted DB indices to keep query performance fast as data grows.

## Tasks
- [ ] \`payments.merchantId\` + \`payments.createdAt\` composite index
- [ ] \`payments.stellarMemo\` index for monitoring lookup
- [ ] \`payments.status\` index for pending payment cron job
- [ ] \`settlements.merchantId\` + \`settlements.status\` index
- [ ] Run EXPLAIN ANALYZE on all list queries to verify

## Acceptance Criteria
- Monitoring memo lookup uses index (not seq scan)
- Paginated lists use composite (merchantId, createdAt) index
- No sequential scans on tables > 10k rows" \
  "module:database"

create_issue \
  "[Database] Materialized view for analytics aggregations" \
  "## Overview
Use PostgreSQL materialized views to accelerate heavy analytics queries.

## Tasks
- [ ] Materialized view: \`mv_daily_payment_volume\`
- [ ] Refresh on schedule every hour via cron job
- [ ] Refresh concurrently to avoid locking readers
- [ ] Analytics queries read from materialized view

## Acceptance Criteria
- Analytics queries complete in < 200ms using materialized view
- Concurrent refresh does not block reads
- View automatically refreshed on schedule" \
  "module:database"

create_issue \
  "[Database] Backup and point-in-time recovery strategy" \
  "## Overview
Automated backups and tested recovery procedures for the production database.

## Tasks
- [ ] Daily logical backups (pg_dump) to S3/Cloudflare R2
- [ ] Retain backups for 30 days
- [ ] WAL archiving for point-in-time recovery
- [ ] Alert if backup job fails
- [ ] Quarterly recovery drill documented

## Acceptance Criteria
- Backup job runs and succeeds daily
- Recovery from backup tested quarterly
- RTO < 1 hour, RPO < 24 hours" \
  "module:database"

# ─────────────────────────────────────────────
# MODULE: CACHE (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Cache] Redis integration with NestJS CacheModule" \
  "## Overview
Set up Redis as the primary cache backend across the application.

## Tasks
- [ ] Install \`ioredis\` and \`@nestjs/cache-manager\`
- [ ] Configure Redis from \`REDIS_HOST\`, \`REDIS_PORT\`, \`REDIS_PASSWORD\` env vars
- [ ] Global CacheModule with configurable default TTL
- [ ] Graceful degradation: cache miss if Redis unavailable

## Acceptance Criteria
- App starts and functions without Redis (degrades gracefully)
- Redis connection status logged on startup
- Default TTL configurable per deployment" \
  "module:cache"

create_issue \
  "[Cache] Exchange rate caching (30-second TTL)" \
  "## Overview
Cache XLM/USD rate to avoid excessive Stellar DEX queries.

## Tasks
- [ ] Cache key: \`rate:xlm:usd\`
- [ ] TTL: 30 seconds
- [ ] Admin force-refresh endpoint: \`POST /api/v1/admin/cache/rates/refresh\`
- [ ] Log cache hit/miss at debug level

## Acceptance Criteria
- Same rate returned within 30-second window
- Fresh rate fetched after TTL expiry
- Admin can force refresh without waiting for TTL" \
  "module:cache"

create_issue \
  "[Cache] Analytics result caching" \
  "## Overview
Cache aggregation query results to avoid repeated heavy DB computation.

## Tasks
- [ ] Cache key: \`analytics:{merchantId}:{endpoint}:{dateRange}\`
- [ ] Merchant analytics TTL: 5 minutes
- [ ] Admin analytics TTL: 10 minutes
- [ ] Invalidate on \`payment.settled\` event
- [ ] Compress large payloads with LZ4 before Redis storage

## Acceptance Criteria
- Cached responses < 20ms
- Uncached responses computed within 2 seconds
- Cache invalidated when a payment settles" \
  "module:cache"

create_issue \
  "[Cache] Auth token claim caching" \
  "## Overview
Cache validated JWT claims to avoid DB lookup on every authenticated request.

## Tasks
- [ ] Cache key: \`session:{jti}\` (JWT ID claim)
- [ ] TTL matches token remaining validity
- [ ] Invalidate immediately on logout (blacklist entry)
- [ ] DB fallback on cache miss

## Acceptance Criteria
- DB not queried on cache-hit requests
- Logout invalidates cache entry instantly
- Cache key includes jti (not sub) to handle token rotation" \
  "module:cache"

create_issue \
  "[Cache] Cache warming on application startup" \
  "## Overview
Pre-populate critical caches on startup to eliminate cold-start latency.

## Tasks
- [ ] Warm exchange rate cache on \`onApplicationBootstrap\`
- [ ] Warm platform fee config cache
- [ ] Warm active merchant count cache
- [ ] Log warm-up completion time
- [ ] Skip in test environment

## Acceptance Criteria
- Warm-up completes before first request is served
- Warm-up logged with per-key duration
- First request has same latency as subsequent cached requests" \
  "module:cache"

create_issue \
  "[Cache] Distributed cache for multi-instance deployment" \
  "## Overview
Ensure cache works correctly across horizontally scaled app instances.

## Tasks
- [ ] All caching via shared Redis (no in-process stores)
- [ ] Cache namespace per environment: \`{env}:cache:{key}\`
- [ ] Cache invalidation broadcasts to all instances via Redis pub/sub
- [ ] No local memory cache that can diverge between instances

## Acceptance Criteria
- Cache invalidation on one instance reflected on all others within 100ms
- Environment namespace prevents cross-environment pollution
- No stale data served after invalidation in multi-instance setup" \
  "module:cache"

create_issue \
  "[Cache] Cache hit rate metrics and monitoring" \
  "## Overview
Track cache performance to optimize TTLs and cache strategy.

## Tasks
- [ ] Instrument cache hits and misses per key pattern
- [ ] Export as Prometheus counters
- [ ] Alert if exchange rate cache hit rate drops below 80%
- [ ] Grafana dashboard panel for cache metrics

## Acceptance Criteria
- Hit/miss rates tracked per key pattern
- Prometheus metrics exported correctly
- Low hit rate alert fires within 1 minute of threshold breach" \
  "module:cache"

create_issue \
  "[Cache] Cache invalidation strategy documentation and implementation" \
  "## Overview
Define and implement cache invalidation rules to prevent stale data being served.

## Tasks
- [ ] Event-driven: \`payment.settled\` → invalidate analytics cache
- [ ] TTL-based: exchange rates, fee configs
- [ ] Manual: admin \`POST /api/v1/admin/cache/flush\` endpoint
- [ ] Document all cache keys and their invalidation triggers

## Acceptance Criteria
- No stale analytics data after relevant event
- Manual flush available to admin for emergencies
- All cache keys documented with TTL and trigger" \
  "module:cache"

# ─────────────────────────────────────────────
# MODULE: QUEUE (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Queue] Bull queue integration with Redis backend" \
  "## Overview
Set up Bull queues for reliable async task processing.

## Tasks
- [ ] Install \`@nestjs/bull\` and \`bull\`
- [ ] Configure Redis connection for Bull
- [ ] Define queues: settlement, webhook, notification, stellar-monitor
- [ ] Bull Board admin UI at \`/admin/queues\` (secured)

## Acceptance Criteria
- Queues operational with Redis backend
- Bull Board accessible to admin users only
- Queue names consistent across all modules" \
  "module:queue"

create_issue \
  "[Queue] Settlement processing queue" \
  "## Overview
Process settlement jobs asynchronously to decouple from payment confirmation.

## Tasks
- [ ] Enqueue settlement job on \`payment.confirmed\`
- [ ] Worker processes one settlement per merchant concurrently
- [ ] Exponential backoff retry on failure (up to 3 retries)
- [ ] Alert on DLQ entries

## Acceptance Criteria
- Settlement does not block payment confirmation response
- Concurrency configurable per queue
- DLQ entries trigger admin alert" \
  "module:queue"

create_issue \
  "[Queue] Webhook delivery queue" \
  "## Overview
Deliver webhook events asynchronously with reliable retry semantics.

## Tasks
- [ ] Enqueue one job per webhook endpoint per event
- [ ] Worker delivers HTTP request with signature headers
- [ ] Retry on delivery failure per retry schedule
- [ ] Log delivery result back to webhook delivery log table

## Acceptance Criteria
- Webhook delivery does not block event dispatch
- Each endpoint gets a separate job (parallel delivery)
- Retry schedule: 1m, 5m, 30m, 2h, 12h" \
  "module:queue"

create_issue \
  "[Queue] Email notification queue" \
  "## Overview
Send all emails asynchronously through a dedicated queue.

## Tasks
- [ ] Email jobs enqueued from NotificationService
- [ ] Worker sends via email provider (SendGrid/SMTP)
- [ ] Retry once on transient SMTP failure
- [ ] Log email send result (success/fail) per job

## Acceptance Criteria
- Email sending does not delay API response
- Transient SMTP failures retried once with 5m delay
- Send failures logged with full error detail" \
  "module:queue"

create_issue \
  "[Queue] Stellar monitoring as a recurring Bull job" \
  "## Overview
Replace the \`@nestjs/schedule\` cron with a recurring Bull job for more reliable Stellar monitoring.

## Tasks
- [ ] Repeating Bull job every 30 seconds
- [ ] Job fetches new Stellar transactions and matches to payments
- [ ] Locked to a single worker (prevent parallel execution)
- [ ] Reschedule after failure (no job loss on crash)

## Acceptance Criteria
- Only one monitoring job runs at a time (job locking)
- Job rescheduled immediately after failure
- Run duration and transactions processed logged per execution" \
  "module:queue"

create_issue \
  "[Queue] Dead letter queue (DLQ) handling" \
  "## Overview
Capture and manage jobs that have exhausted all retries.

## Tasks
- [ ] Configure DLQ per queue (Bull \`removeOnFail: false\`)
- [ ] Admin endpoint: \`GET /api/v1/admin/queues/:name/failed\`
- [ ] Admin endpoint: \`POST /api/v1/admin/queues/:name/failed/:id/retry\`
- [ ] Alert admin when DLQ size exceeds 10

## Acceptance Criteria
- Failed jobs stored in Bull's failed set
- Admin can inspect and requeue failed jobs
- DLQ size alert triggers within 1 minute of threshold" \
  "module:queue"

create_issue \
  "[Queue] Queue health monitoring and metrics" \
  "## Overview
Expose queue depth, throughput, and failure metrics for operations monitoring.

## Tasks
- [ ] Queue depth, active, completed, failed counts via Prometheus
- [ ] Alert if queue depth > 1,000 or processing rate drops to zero
- [ ] Bull Board for visual queue management
- [ ] Grafana panel for queue depth trend

## Acceptance Criteria
- Prometheus metrics emitted per queue
- Alert fires within 1 minute of threshold breach
- Grafana panel shows queue depth over time" \
  "module:queue"

create_issue \
  "[Queue] Queue retry configuration per queue type" \
  "## Overview
Tune retry settings appropriately for each queue's workload characteristics.

## Tasks
- [ ] Settlement: 3 retries, exponential backoff (1m, 5m, 30m)
- [ ] Webhook: 5 retries, schedule (1m, 5m, 30m, 2h, 12h)
- [ ] Email: 1 retry, 5m delay
- [ ] Stellar monitor: 1 retry, immediate
- [ ] All settings configurable via env vars

## Acceptance Criteria
- Each queue uses correct retry count and delays
- Backoff delays configurable without code change
- Config documented in \`.env.example\`" \
  "module:queue"

# ─────────────────────────────────────────────
# MODULE: API / CORE (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[API] URL-based API versioning (/api/v1)" \
  "## Overview
Implement API versioning for backward-compatible platform evolution.

## Tasks
- [ ] All routes prefixed with \`/api/v1\`
- [ ] Version header support: \`Accept: application/vnd.cheesepay.v1+json\`
- [ ] \`Deprecation\` header on endpoints scheduled for removal
- [ ] Document migration path for future v2

## Acceptance Criteria
- All endpoints accessible at \`/api/v1/*\`
- Version header respected in response format
- Deprecated endpoints return \`Deprecation\` header" \
  "module:api"

create_issue \
  "[API] Swagger / OpenAPI documentation" \
  "## Overview
Comprehensive auto-generated API documentation for all endpoints.

## Tasks
- [ ] Swagger UI at \`/docs\`, OpenAPI JSON at \`/docs-json\`
- [ ] \`@ApiOperation\`, \`@ApiResponse\` on every endpoint
- [ ] Request/response schemas derived from DTOs
- [ ] Bearer auth + API key auth configured in Swagger UI

## Acceptance Criteria
- Every endpoint visible and documented in Swagger
- All status codes and schemas documented
- Swagger UI usable as a manual test client" \
  "module:api"

create_issue \
  "[API] Global HTTP exception filter" \
  "## Overview
Standardize all error responses to a consistent format.

## Tasks
- [ ] \`AllExceptionsFilter\` registered globally
- [ ] Format: \`{ statusCode, error, message, timestamp, path }\`
- [ ] Log all 5xx errors with stack trace
- [ ] Sentry capture on unhandled exceptions

## Acceptance Criteria
- All error responses match standard format
- 5xx errors logged with full stack trace
- Validation errors include field-level detail in \`message\`" \
  "module:api"

create_issue \
  "[API] Request/response logging interceptor" \
  "## Overview
Log all API requests and responses for observability and debugging.

## Tasks
- [ ] Log: method, path, statusCode, duration, merchantId (if authenticated)
- [ ] Exclude: password, apiKey, secret fields from logs
- [ ] Structured JSON log format for ELK/Loki
- [ ] Log level by status: INFO (2xx), WARN (4xx), ERROR (5xx)

## Acceptance Criteria
- All requests logged with duration
- Sensitive fields never appear in logs
- Log output is valid structured JSON" \
  "module:api"

create_issue \
  "[API] Standardized pagination utility" \
  "## Overview
Consistent cursor/offset pagination across all list endpoints.

## Tasks
- [ ] \`PaginationDto\`: page (default 1), limit (default 20, max 100)
- [ ] Response wrapper: \`{ data, total, page, limit, totalPages }\`
- [ ] \`PaginatedResponseDto<T>\` generic class
- [ ] All list endpoints use PaginationDto

## Acceptance Criteria
- All list endpoints share same pagination structure
- totalPages calculated and returned
- Out-of-range page returns empty data array (not 404)" \
  "module:api"

create_issue \
  "[API] Health check endpoints (/health and /health/ready)" \
  "## Overview
Liveness and readiness health endpoints for load balancer and k8s integration.

## Tasks
- [ ] \`GET /health\` — liveness: always 200 if app running
- [ ] \`GET /health/ready\` — readiness: checks DB, Redis, Stellar
- [ ] Use \`@nestjs/terminus\`
- [ ] Return 503 if any critical dependency is down

## Acceptance Criteria
- Liveness always 200 while process is alive
- Readiness 503 if DB disconnected
- Response shows per-dependency status and latency" \
  "module:api"

create_issue \
  "[API] Response transformation and field exclusion" \
  "## Overview
Automatically serialize entities to safe API responses, excluding sensitive fields.

## Tasks
- [ ] \`ClassSerializerInterceptor\` applied globally
- [ ] \`@Exclude()\` on: passwordHash, apiKeyHash, encryptedKey
- [ ] \`@Transform()\` for masked fields (bank account → last 4 digits)
- [ ] ISO 8601 dates consistently

## Acceptance Criteria
- Excluded fields never visible in any response
- Masked fields show last 4 digits only
- All dates in ISO 8601 format" \
  "module:api"

create_issue \
  "[API] Dynamic query filtering utility" \
  "## Overview
Reusable filtering utility that maps query params to TypeORM WHERE conditions.

## Tasks
- [ ] \`FilterService\` maps query params to TypeORM conditions
- [ ] Operators: eq, gte, lte, like, in, between
- [ ] Validate filter field names against an entity allowlist
- [ ] Combine with pagination seamlessly

## Acceptance Criteria
- All operators produce correct SQL conditions
- Unknown filter field names return 400
- Combined filter + pagination works correctly" \
  "module:api"

create_issue \
  "[API] Idempotency key support for payment creation" \
  "## Overview
Prevent duplicate payment creation when clients retry failed requests.

## Tasks
- [ ] Accept \`Idempotency-Key\` header on \`POST /payments\`
- [ ] Store request fingerprint + response in Redis for 24 hours
- [ ] Return cached response for duplicate key
- [ ] Log idempotency cache hits

## Acceptance Criteria
- Same idempotency key returns identical response (including IDs)
- Different key for same body creates a new payment
- Cached responses served for 24 hours" \
  "module:api"

create_issue \
  "[API] Per-merchant API key rate limiting" \
  "## Overview
Rate limit API key requests per merchant to prevent abuse.

## Tasks
- [ ] Default: 1,000 requests/hour per API key
- [ ] Higher limits for verified/enterprise tier merchants
- [ ] Response headers: \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`
- [ ] Redis counter for sliding window rate tracking

## Acceptance Criteria
- Counter resets on the hour boundary
- Correct headers returned on every API key request
- 429 response includes \`Retry-After\` header" \
  "module:api"

# ─────────────────────────────────────────────
# MODULE: TESTING (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Testing] Jest configuration and coverage thresholds" \
  "## Overview
Configure Jest for the full test suite with coverage enforcement.

## Tasks
- [ ] Jest config in \`package.json\`
- [ ] TypeScript support via \`ts-jest\`
- [ ] Module path alias mapping (\`@/\` → \`src/\`)
- [ ] Coverage thresholds: 80% lines, 75% branches
- [ ] Watch mode for local development

## Acceptance Criteria
- \`npm test\` runs all unit tests
- Coverage report generated in lcov format
- CI fails if coverage drops below threshold" \
  "module:testing"

create_issue \
  "[Testing] Integration test setup with real PostgreSQL" \
  "## Overview
Configure integration tests that run against a real PostgreSQL test database.

## Tasks
- [ ] Separate \`DB_NAME_TEST\` env var for test DB
- [ ] NestJS test module with real TypeORM connection
- [ ] DB reset between test suites (truncate tables)
- [ ] Seed test data per suite using factory functions

## Acceptance Criteria
- Integration tests use real DB (no mocks for DB)
- Tables truncated between suites (no cross-suite pollution)
- Integration tests in \`*.integration-spec.ts\` files" \
  "module:testing"

create_issue \
  "[Testing] E2E test suite with supertest" \
  "## Overview
End-to-end tests that exercise the full HTTP request/response cycle.

## Tasks
- [ ] \`@nestjs/testing\` + \`supertest\`
- [ ] Full NestJS app bootstrapped for E2E
- [ ] Test core flows: register → login → create payment → check status
- [ ] Run E2E in CI against test environment

## Acceptance Criteria
- E2E tests boot full NestJS app
- Full auth + payment flow tested end-to-end
- \`npm run test:e2e\` runs the E2E suite" \
  "module:testing"

create_issue \
  "[Testing] Mock StellarService factory" \
  "## Overview
Reusable mock StellarService for isolating Stellar interactions in unit tests.

## Tasks
- [ ] \`MockStellarService\` with all public methods returning configurable values
- [ ] Default: rate = 0.1, verifyPayment = { verified: true, amount: 50, asset: 'USDC' }
- [ ] \`createMockStellarService(overrides)\` factory for per-test customization
- [ ] Usable in NestJS test module providers

## Acceptance Criteria
- No real Horizon calls in unit tests using mock
- Mock configurable per test case via overrides
- All StellarService public methods covered by mock" \
  "module:testing"

create_issue \
  "[Testing] Full payment lifecycle integration test" \
  "## Overview
Integration test covering the complete payment lifecycle end-to-end.

## Tasks
- [ ] Create merchant → login → create payment → simulate Stellar confirmation → verify settlement triggered
- [ ] Mock partner API with \`nock\` in integration test
- [ ] Assert webhooks dispatched at each stage
- [ ] Assert settlement record created with correct amounts

## Acceptance Criteria
- Full lifecycle verifiable in a single test suite
- Partner API mocked (no real external calls)
- All webhook events asserted via spy" \
  "module:testing"

create_issue \
  "[Testing] Auth module E2E tests" \
  "## Overview
E2E tests for all authentication flows.

## Tasks
- [ ] Register → login → access protected route → 200
- [ ] Wrong password → 401
- [ ] Rate limit exceeded → 429
- [ ] Expired JWT → 401
- [ ] Valid API key → 200

## Acceptance Criteria
- All auth flows tested via real HTTP calls
- Rate limit test uses short TTL override for speed
- JWT expiry simulated by moving clock forward" \
  "module:testing"

create_issue \
  "[Testing] Test coverage reporting in CI (Codecov)" \
  "## Overview
Generate, publish, and track test coverage on every PR.

## Tasks
- [ ] Jest outputs lcov coverage report
- [ ] Upload to Codecov in CI
- [ ] GitHub PR comment shows coverage diff
- [ ] CI fails if coverage drops more than 2% from base

## Acceptance Criteria
- Coverage report visible on every PR
- Coverage delta shown in PR comment
- CI blocks merge on coverage regression > 2%" \
  "module:testing"

create_issue \
  "[Testing] Test data factory functions" \
  "## Overview
Factory functions to generate consistent, overridable test fixtures.

## Tasks
- [ ] \`merchantFactory(overrides?)\` — build merchant object
- [ ] \`paymentFactory(overrides?)\` — build payment object
- [ ] \`settlementFactory(overrides?)\` — build settlement object
- [ ] Persist to DB via TypeORM for integration tests

## Acceptance Criteria
- Factories support arbitrary field overrides
- All required fields have sensible defaults
- Same factories usable in unit and integration tests" \
  "module:testing"

create_issue \
  "[Testing] Load testing with k6" \
  "## Overview
Verify API performance under realistic load with k6 load tests.

## Tasks
- [ ] k6 scripts: login, create payment, list payments
- [ ] Target: 100 VUs, 1,000 req/min sustained
- [ ] Measure p50, p95, p99 latency and error rate
- [ ] Run weekly against staging environment

## Acceptance Criteria
- p95 latency < 500ms under 100 VUs
- Error rate < 0.1% under target load
- Performance regression detected before production deploy" \
  "module:testing"

create_issue \
  "[Testing] Partner API contract tests with Pact" \
  "## Overview
Consumer-driven contract tests to verify the fiat partner API integration.

## Tasks
- [ ] Define consumer contract for partner settlement endpoint
- [ ] Pact consumer tests in settlements module
- [ ] Publish contract to Pact Broker in CI
- [ ] Alert on contract verification failure

## Acceptance Criteria
- Contract tests fail if partner changes response schema
- No real partner API calls during contract tests
- Contract published automatically on successful test run" \
  "module:testing"

# ─────────────────────────────────────────────
# MODULE: MONITORING (9 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Monitoring] Prometheus metrics integration" \
  "## Overview
Export application metrics in Prometheus format for infrastructure monitoring.

## Tasks
- [ ] Install \`@willsoto/nestjs-prometheus\`
- [ ] Custom counters: \`payment_created_total\`, \`payment_settled_total\`, \`settlement_failed_total\`
- [ ] Custom histogram: \`settlement_duration_seconds\`
- [ ] Default Node.js metrics (CPU, memory, event loop lag)
- [ ] Expose at \`/metrics\` (network-restricted, not public)

## Acceptance Criteria
- Custom metrics increment correctly on each event
- \`/metrics\` returns valid Prometheus text format
- Endpoint inaccessible from public internet" \
  "module:monitoring"

create_issue \
  "[Monitoring] Sentry error tracking" \
  "## Overview
Capture unhandled exceptions with full context in Sentry.

## Tasks
- [ ] Install \`@sentry/nestjs\`
- [ ] Configure with \`SENTRY_DSN\` env var
- [ ] Attach user context (merchantId, email) to all captured errors
- [ ] Set up Sentry alert for error rate spike
- [ ] Enable Sentry performance tracing

## Acceptance Criteria
- All unhandled 5xx exceptions appear in Sentry
- Merchant context attached to each error event
- Sentry performance traces enabled for slow requests" \
  "module:monitoring"

create_issue \
  "[Monitoring] Request latency and throughput APM" \
  "## Overview
Track per-endpoint latency and request rate via Prometheus histograms.

## Tasks
- [ ] Histogram: \`http_request_duration_ms{method, route, status}\`
- [ ] Counter: \`http_requests_total{method, route, status}\`
- [ ] Slow request log (> 1s) at WARN level
- [ ] Grafana panel: p50/p95/p99 latency per endpoint

## Acceptance Criteria
- Latency histogram accurate per route
- Slow requests logged immediately
- Grafana panel shows latency percentiles" \
  "module:monitoring"

create_issue \
  "[Monitoring] Grafana dashboard templates" \
  "## Overview
Pre-built Grafana dashboard JSON templates for the platform.

## Tasks
- [ ] Dashboard: payment volume time-series
- [ ] Dashboard: settlement success/failure rate
- [ ] Dashboard: API latency (p95 per endpoint)
- [ ] Dashboard: queue depths and processing rate
- [ ] All dashboards versioned as JSON in repo

## Acceptance Criteria
- All dashboards importable via Grafana JSON import
- Dashboards show meaningful data with sample metrics
- Alerting rules configured on each dashboard" \
  "module:monitoring"

create_issue \
  "[Monitoring] Structured logging with correlation IDs" \
  "## Overview
Add request correlation IDs to all log entries for distributed trace correlation.

## Tasks
- [ ] Generate UUID correlation ID per incoming request
- [ ] Accept client-provided \`X-Correlation-ID\` header if present
- [ ] Return correlation ID in response header
- [ ] Include correlation ID in every log entry for that request

## Acceptance Criteria
- Every log line includes correlation ID
- Client-supplied ID respected and echoed back
- Logs searchable by correlation ID in log aggregator" \
  "module:monitoring"

create_issue \
  "[Monitoring] External uptime monitoring" \
  "## Overview
Monitor platform uptime from outside the infrastructure and alert on downtime.

## Tasks
- [ ] Configure UptimeRobot or Better Uptime
- [ ] Monitor: \`/health\` (API), Horizon connectivity
- [ ] Alert: email + Slack on downtime detection
- [ ] Public status page at \`status.cheesepay.xyz\`

## Acceptance Criteria
- Downtime detected within 2 minutes of occurrence
- On-call alerted within 5 minutes
- Status page shows real-time component status" \
  "module:monitoring"

create_issue \
  "[Monitoring] OpenTelemetry distributed tracing" \
  "## Overview
Implement distributed tracing for end-to-end request visibility.

## Tasks
- [ ] Install \`@opentelemetry/sdk-node\`
- [ ] Auto-instrument: HTTP, PostgreSQL (\`pg\`), Redis (\`ioredis\`)
- [ ] Export traces to Jaeger or Grafana Tempo
- [ ] Trace Stellar monitoring job execution

## Acceptance Criteria
- Full request trace visible from HTTP → DB queries
- Stellar job execution shown as child spans
- Slow DB queries identifiable in trace UI" \
  "module:monitoring"

create_issue \
  "[Monitoring] Log aggregation with Loki/ELK" \
  "## Overview
Ship structured application logs to a centralized log management system.

## Tasks
- [ ] Configure Winston for structured JSON logging
- [ ] Ship to Grafana Loki via Promtail (or ELK via Filebeat)
- [ ] Grafana Loki dashboard for log exploration
- [ ] Alert on ERROR log rate spike (> 10/min)

## Acceptance Criteria
- All log levels shipped to central store
- Logs searchable by correlation ID
- Error spike alert fires within 1 minute" \
  "module:monitoring"

create_issue \
  "[Monitoring] Alerting rules for critical platform metrics" \
  "## Overview
Define and wire up alerts for all critical platform health metrics.

## Tasks
- [ ] Settlement failure rate > 5% → page on-call
- [ ] API error rate (5xx) > 1% → alert team
- [ ] Stellar balance below XLM reserve → alert admin
- [ ] Queue depth > 1,000 → alert team
- [ ] Zero payments processed in 1 hour (business hours) → investigate
- [ ] Route all alerts to Slack and email

## Acceptance Criteria
- All alerts configured in Prometheus Alertmanager
- Alert routing tested end-to-end
- Runbook URL linked in each alert annotation" \
  "module:monitoring"

echo ""
echo "✅ All $COUNT remaining issues created!"
