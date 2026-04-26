#!/usr/bin/env bash
set -euo pipefail

REPO="songifi/dabdub"
DELAY=2  # seconds between each issue (safe at ~30/min vs GitHub's 80/min limit)
COUNT=0

create_issue() {
  local title="$1"
  local body="$2"
  local label="$3"
  COUNT=$((COUNT + 1))
  echo "[$COUNT/200] Creating: $title"
  gh issue create --repo "$REPO" --title "$title" --body "$body" --label "$label" 2>/dev/null || \
    gh issue create --repo "$REPO" --title "$title" --body "$body" 2>/dev/null || \
    echo "  WARN: failed to create issue $COUNT"
  sleep $DELAY
}

# ─────────────────────────────────────────────
# MODULE: AUTH (15 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Auth] Merchant registration with email and password" \
  "## Overview
Implement merchant registration endpoint that accepts email, password, and business name.

## Tasks
- [ ] Create \`POST /api/v1/auth/register\` endpoint
- [ ] Validate email uniqueness
- [ ] Hash password with bcrypt (cost factor 12)
- [ ] Return JWT access token on success
- [ ] Return sanitized merchant object (no passwordHash)

## Acceptance Criteria
- Duplicate email returns 409 Conflict
- Weak password returns 400 with validation errors
- Successful registration returns \`{ accessToken, merchant }\`" \
  "module:auth"

create_issue \
  "[Auth] JWT login for merchants" \
  "## Overview
Implement login endpoint that validates credentials and issues a JWT.

## Tasks
- [ ] Create \`POST /api/v1/auth/login\` endpoint
- [ ] Compare password with bcrypt
- [ ] Sign JWT with configurable secret and expiry
- [ ] Return \`{ accessToken, merchant }\`

## Acceptance Criteria
- Wrong password returns 401 Unauthorized
- Valid credentials return a signed JWT
- JWT payload includes \`sub\` (merchantId) and \`email\`" \
  "module:auth"

create_issue \
  "[Auth] JWT refresh token flow" \
  "## Overview
Allow merchants to refresh their access token without re-logging in.

## Tasks
- [ ] Issue refresh token on login (httpOnly cookie or response body)
- [ ] Create \`POST /api/v1/auth/refresh\` endpoint
- [ ] Validate refresh token and issue new access token
- [ ] Implement refresh token rotation
- [ ] Store refresh token hash in DB for revocation

## Acceptance Criteria
- Expired access token + valid refresh token yields new access token
- Used refresh token cannot be reused (rotation)" \
  "module:auth"

create_issue \
  "[Auth] Password reset flow" \
  "## Overview
Allow merchants to reset their password via email.

## Tasks
- [ ] Create \`POST /api/v1/auth/forgot-password\` endpoint
- [ ] Generate secure reset token (UUID or crypto.randomBytes)
- [ ] Send reset email with token link
- [ ] Create \`POST /api/v1/auth/reset-password\` endpoint
- [ ] Validate token expiry (1 hour TTL)
- [ ] Invalidate token after use

## Acceptance Criteria
- Reset link expires after 1 hour
- Token can only be used once
- Old password no longer works after reset" \
  "module:auth"

create_issue \
  "[Auth] Email verification on registration" \
  "## Overview
Require merchants to verify their email address before full account activation.

## Tasks
- [ ] Generate email verification token on registration
- [ ] Send verification email with link
- [ ] Create \`GET /api/v1/auth/verify-email?token=xxx\` endpoint
- [ ] Set \`emailVerified\` flag on merchant entity
- [ ] Block certain actions for unverified merchants

## Acceptance Criteria
- Unverified merchants can log in but see a warning
- Verification link expires after 24 hours
- Resend verification endpoint available" \
  "module:auth"

create_issue \
  "[Auth] API key authentication strategy" \
  "## Overview
Allow merchants to authenticate API requests using an API key via \`x-api-key\` header.

## Tasks
- [ ] Create \`ApiKeyStrategy\` (Passport custom strategy)
- [ ] Validate key against hashed value in DB
- [ ] Create \`ApiKeyGuard\`
- [ ] Apply guard to public-facing API routes

## Acceptance Criteria
- Valid API key grants access same as JWT
- Invalid key returns 401
- Key lookup is timing-safe (constant-time compare)" \
  "module:auth"

create_issue \
  "[Auth] Rate limiting on authentication endpoints" \
  "## Overview
Protect login and register endpoints from brute force attacks.

## Tasks
- [ ] Install and configure \`@nestjs/throttler\`
- [ ] Apply 5 req/minute limit to \`/auth/login\`
- [ ] Apply 3 req/minute limit to \`/auth/register\`
- [ ] Return 429 Too Many Requests with Retry-After header

## Acceptance Criteria
- Exceeding limit returns 429
- Limit resets after the window expires
- IP-based tracking" \
  "module:auth"

create_issue \
  "[Auth] Role-based access control (RBAC)" \
  "## Overview
Implement roles (merchant, admin) to gate access to different resources.

## Tasks
- [ ] Add \`role\` field to merchant entity
- [ ] Create \`Roles\` decorator
- [ ] Create \`RolesGuard\`
- [ ] Apply admin role requirement to admin endpoints
- [ ] Include role in JWT payload

## Acceptance Criteria
- Non-admin cannot access \`/admin/*\` routes
- Role is enforced at controller level
- Guards compose correctly with JwtAuthGuard" \
  "module:auth"

create_issue \
  "[Auth] Account lockout after failed login attempts" \
  "## Overview
Lock merchant account temporarily after repeated failed login attempts.

## Tasks
- [ ] Track failed login count and last attempt timestamp
- [ ] Lock account after 10 failed attempts
- [ ] Return 423 Locked with unlock time
- [ ] Auto-unlock after 30 minutes
- [ ] Reset counter on successful login

## Acceptance Criteria
- Account locked after 10 consecutive failures
- Locked account returns 423 even with correct password
- Auto-unlock after lockout period" \
  "module:auth"

create_issue \
  "[Auth] Two-factor authentication (TOTP)" \
  "## Overview
Support TOTP-based 2FA (Google Authenticator, Authy) for merchant accounts.

## Tasks
- [ ] Generate TOTP secret and QR code (\`otplib\`)
- [ ] Create \`POST /api/v1/auth/2fa/setup\` endpoint
- [ ] Create \`POST /api/v1/auth/2fa/verify\` endpoint
- [ ] Require TOTP code on login when enabled
- [ ] Store encrypted TOTP secret in DB
- [ ] Allow 2FA disable with password confirmation

## Acceptance Criteria
- TOTP codes expire after 30 seconds
- Backup codes generated on setup
- 2FA disable requires current password" \
  "module:auth"

create_issue \
  "[Auth] JWT token blacklisting on logout" \
  "## Overview
Invalidate JWT tokens when a merchant explicitly logs out.

## Tasks
- [ ] Create \`POST /api/v1/auth/logout\` endpoint
- [ ] Store token jti (JWT ID) in a blacklist (Redis)
- [ ] Check blacklist in JWT validation middleware
- [ ] Auto-expire blacklist entries at token expiry

## Acceptance Criteria
- Logged-out token returns 401 on subsequent requests
- Blacklist entry expires when token would naturally expire
- Logout clears refresh token if present" \
  "module:auth"

create_issue \
  "[Auth] Passkey / WebAuthn authentication support" \
  "## Overview
Support passwordless login via WebAuthn (passkeys) for merchants.

## Tasks
- [ ] Integrate \`@simplewebauthn/server\`
- [ ] Create registration challenge endpoint
- [ ] Create authentication challenge endpoint
- [ ] Store authenticator credentials in DB
- [ ] Support multiple devices per merchant

## Acceptance Criteria
- Merchant can register a passkey
- Passkey login works without password
- Multiple passkeys supported per account" \
  "module:auth"

create_issue \
  "[Auth] Auth module unit tests" \
  "## Overview
Write comprehensive unit tests for the auth module.

## Tasks
- [ ] Test \`AuthService.register\` (success, duplicate email)
- [ ] Test \`AuthService.login\` (success, wrong password, locked)
- [ ] Test \`JwtStrategy.validate\`
- [ ] Test \`ApiKeyStrategy\`
- [ ] Mock \`MerchantsRepository\` and \`JwtService\`
- [ ] Achieve 90%+ coverage on auth service

## Acceptance Criteria
- All happy paths covered
- All error paths covered
- No real DB calls in unit tests" \
  "module:auth"

create_issue \
  "[Auth] Swagger documentation for auth endpoints" \
  "## Overview
Document all auth endpoints in Swagger/OpenAPI.

## Tasks
- [ ] Add \`@ApiTags\`, \`@ApiOperation\` to all auth endpoints
- [ ] Add \`@ApiResponse\` for all status codes (200, 400, 401, 409, 429)
- [ ] Add \`@ApiBody\` with DTO examples
- [ ] Document Bearer auth scheme

## Acceptance Criteria
- All auth endpoints visible in \`/docs\`
- Request/response schemas shown
- Error responses documented" \
  "module:auth"

create_issue \
  "[Auth] Session activity logging" \
  "## Overview
Log all authentication events for security auditing.

## Tasks
- [ ] Log login attempts (success/failure) with IP and user agent
- [ ] Log password resets, email verifications
- [ ] Store in \`auth_events\` table
- [ ] Expose \`GET /api/v1/merchants/me/activity\` endpoint
- [ ] Retain logs for 90 days

## Acceptance Criteria
- Every login attempt is logged
- IP address and timestamp recorded
- Merchant can view their own login history" \
  "module:auth"

# ─────────────────────────────────────────────
# MODULE: MERCHANTS (15 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Merchants] Merchant profile CRUD" \
  "## Overview
Allow merchants to view and update their business profile.

## Tasks
- [ ] \`GET /api/v1/merchants/me\` — fetch profile
- [ ] \`PATCH /api/v1/merchants/me\` — update profile fields
- [ ] Validate allowed update fields (businessName, country, etc.)
- [ ] Return sanitized response (no secrets)

## Acceptance Criteria
- Profile update is partial (PATCH semantics)
- Cannot update email via this endpoint
- Returns updated merchant object" \
  "module:merchants"

create_issue \
  "[Merchants] Bank account management" \
  "## Overview
Allow merchants to configure bank account details for fiat settlement.

## Tasks
- [ ] Add bank fields to merchant entity (accountNumber, bankCode, bankName, currency)
- [ ] \`PATCH /api/v1/merchants/me/bank\` — update bank details
- [ ] Validate bank account format by country
- [ ] Mask account number in API responses

## Acceptance Criteria
- Bank details saved and retrievable
- Account number masked in responses (show last 4 digits)
- Required before first settlement can process" \
  "module:merchants"

create_issue \
  "[Merchants] API key generation and rotation" \
  "## Overview
Generate and rotate API keys for server-side integration.

## Tasks
- [ ] \`POST /api/v1/merchants/api-keys\` — generate new key
- [ ] Prefix key with \`cpk_live_\` or \`cpk_test_\`
- [ ] Store only the hash in DB
- [ ] Show full key only once on creation
- [ ] Support key rotation (invalidate old key)

## Acceptance Criteria
- Raw key shown only at creation time
- Old key invalid immediately on rotation
- Key is at least 48 characters" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant status lifecycle management" \
  "## Overview
Manage merchant account states: pending, active, suspended.

## Tasks
- [ ] Add status enum to merchant entity
- [ ] Block API access for suspended merchants
- [ ] Admin endpoint to change merchant status
- [ ] Email notification on status change
- [ ] Record reason for suspension

## Acceptance Criteria
- Suspended merchants receive 403 on all protected routes
- Status history is auditable
- Merchants notified by email on status change" \
  "module:merchants"

create_issue \
  "[Merchants] KYC document upload" \
  "## Overview
Allow merchants to upload KYC documents for verification.

## Tasks
- [ ] \`POST /api/v1/merchants/me/kyc\` — upload documents
- [ ] Accept ID card, business registration certificate
- [ ] Store files in S3/Cloudflare R2
- [ ] Track KYC status: pending, verified, rejected
- [ ] Admin endpoint to approve/reject KYC

## Acceptance Criteria
- File size limit: 10MB per document
- Supported formats: PDF, JPG, PNG
- KYC status exposed in merchant profile" \
  "module:merchants"

create_issue \
  "[Merchants] Fee rate configuration per merchant" \
  "## Overview
Support per-merchant custom fee rates (overriding the global default).

## Tasks
- [ ] Add \`feeRate\` field to merchant entity (default 1.5%)
- [ ] Admin endpoint to set custom fee rate
- [ ] Apply merchant-specific rate in settlement calculation
- [ ] Expose current fee rate in merchant profile

## Acceptance Criteria
- Default fee rate is 1.5%
- Admin can set rates between 0% and 10%
- Fee rate used in settlement is logged" \
  "module:merchants"

create_issue \
  "[Merchants] Multi-user merchant accounts (team members)" \
  "## Overview
Allow merchants to invite team members to access their dashboard.

## Tasks
- [ ] Create \`merchant_users\` join table (merchantId, userId, role)
- [ ] \`POST /api/v1/merchants/me/members/invite\` — send invite email
- [ ] Accept invite via token link
- [ ] Roles: owner, admin, viewer
- [ ] \`DELETE /api/v1/merchants/me/members/:id\` — remove member

## Acceptance Criteria
- Invite expires after 48 hours
- Viewer cannot create payments or modify settings
- Owner cannot be removed" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant notification preferences" \
  "## Overview
Allow merchants to configure which events trigger email/webhook notifications.

## Tasks
- [ ] Add \`notificationPrefs\` JSON field to merchant
- [ ] Options: payment.confirmed, payment.settled, payment.failed
- [ ] \`PATCH /api/v1/merchants/me/notifications\` endpoint
- [ ] Respect preferences when dispatching emails

## Acceptance Criteria
- Preferences persisted and respected
- Disabling a notification stops that email type
- Webhook delivery unaffected by email prefs" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant data export (GDPR)" \
  "## Overview
Allow merchants to export all their data in JSON/CSV format.

## Tasks
- [ ] \`POST /api/v1/merchants/me/export\` — trigger export
- [ ] Compile payments, settlements, webhooks, profile
- [ ] Generate downloadable ZIP
- [ ] Email download link when ready (async)
- [ ] Delete export file after 24 hours

## Acceptance Criteria
- Export includes all merchant-owned data
- Download link expires after 24 hours
- One export job at a time per merchant" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant onboarding checklist" \
  "## Overview
Guide new merchants through completing their account setup.

## Tasks
- [ ] Track onboarding steps: email verified, bank added, first payment created
- [ ] \`GET /api/v1/merchants/me/onboarding\` — return checklist with completion %
- [ ] Mark steps complete automatically as actions are taken
- [ ] Show completion badge once 100%

## Acceptance Criteria
- Checklist reflects real-time state
- Completion percentage calculated correctly
- Steps cannot be manually marked complete" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant business verification" \
  "## Overview
Verify merchant business details before enabling live payments.

## Tasks
- [ ] Add \`businessVerified\` flag to merchant entity
- [ ] Define required fields for verification (CAC number, tax ID)
- [ ] Admin endpoint to approve verification
- [ ] Block live payments until verified (allow testnet)

## Acceptance Criteria
- Unverified merchants can only use testnet
- Verification status visible in profile
- Admin notified when merchant submits for verification" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant audit log" \
  "## Overview
Record all sensitive merchant account changes for compliance.

## Tasks
- [ ] Log profile updates, bank changes, API key generation, member changes
- [ ] Store actor (who made the change), action, before/after values
- [ ] \`GET /api/v1/merchants/me/audit-log\` — paginated list
- [ ] Retain for 1 year

## Acceptance Criteria
- Every sensitive action creates an audit entry
- Logs are immutable (no update/delete endpoints)
- Timestamp and actor always recorded" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant dashboard statistics summary" \
  "## Overview
Provide a summary stats endpoint for the merchant dashboard overview.

## Tasks
- [ ] \`GET /api/v1/merchants/me/stats\` — return aggregated stats
- [ ] Include: total volume (USD), payment count by status, settlement count
- [ ] Support date range query parameters
- [ ] Cache result for 60 seconds

## Acceptance Criteria
- Stats update within 60 seconds of new payment
- Date range filtering works correctly
- Response time < 200ms with caching" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant settlement currency preference" \
  "## Overview
Let merchants choose their preferred fiat currency for settlement (NGN, USD, EUR, GBP).

## Tasks
- [ ] Add \`settlementCurrency\` field to merchant entity
- [ ] Default to NGN for Nigerian merchants
- [ ] Validate supported currencies
- [ ] Pass preference to settlement service

## Acceptance Criteria
- Only supported currencies accepted
- Currency preference used in all future settlements
- Existing settlements unaffected by currency change" \
  "module:merchants"

create_issue \
  "[Merchants] Merchant module unit tests" \
  "## Overview
Comprehensive unit tests for the merchants module.

## Tasks
- [ ] Test \`MerchantsService.findOne\` (found, not found)
- [ ] Test \`MerchantsService.update\` (valid, invalid fields)
- [ ] Test \`MerchantsService.generateApiKey\`
- [ ] Test \`MerchantsService.getProfile\` (sanitization)
- [ ] Mock repository with TypeORM testing utilities

## Acceptance Criteria
- 90%+ branch coverage on merchants service
- All error paths tested
- No actual DB connections" \
  "module:merchants"

# ─────────────────────────────────────────────
# MODULE: PAYMENTS (20 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Payments] Create payment request with QR code" \
  "## Overview
Allow merchants to create a payment request that generates a Stellar-compatible QR code.

## Tasks
- [ ] \`POST /api/v1/payments\` endpoint
- [ ] Generate unique reference (PAY-timestamp-random)
- [ ] Generate Stellar URI (\`web+stellar:pay?...\`)
- [ ] Generate QR code as data URL using \`qrcode\`
- [ ] Set expiry based on \`expiryMinutes\` param

## Acceptance Criteria
- QR code encodes Stellar payment URI
- Unique memo generated per payment
- Returns payment with qrCode, stellarMemo, depositAddress" \
  "module:payments"

create_issue \
  "[Payments] Payment expiry management" \
  "## Overview
Automatically expire pending payments that are not paid within the configured time window.

## Tasks
- [ ] Store \`expiresAt\` timestamp on payment creation
- [ ] Cron job checks for expired pending payments every minute
- [ ] Update status to \`expired\`
- [ ] Fire \`payment.expired\` webhook event
- [ ] Default expiry: 30 minutes, configurable per request

## Acceptance Criteria
- Expired payments cannot be confirmed
- Webhook fired within 1 minute of expiry
- Expired payments visible in list with correct status" \
  "module:payments"

create_issue \
  "[Payments] Payment list with pagination, filtering and sorting" \
  "## Overview
Allow merchants to list and filter their payments.

## Tasks
- [ ] \`GET /api/v1/payments\` with query params
- [ ] Filter by: status, dateFrom, dateTo, network, minAmount, maxAmount
- [ ] Sort by: createdAt (default desc), amountUsd
- [ ] Paginate with \`page\` and \`limit\` params
- [ ] Return total count in response

## Acceptance Criteria
- Filters are combinable
- Default page size is 20
- Response includes \`{ payments, total, page, limit }\`" \
  "module:payments"

create_issue \
  "[Payments] Payment search by reference or customer email" \
  "## Overview
Allow merchants to search payments by reference number or customer email.

## Tasks
- [ ] Add \`search\` query param to \`GET /api/v1/payments\`
- [ ] Match against reference, customerEmail
- [ ] Use ILIKE for case-insensitive search
- [ ] Return matching results with pagination

## Acceptance Criteria
- Partial reference match works
- Case-insensitive email match works
- Empty search returns all (no filter)" \
  "module:payments"

create_issue \
  "[Payments] Payment export to CSV" \
  "## Overview
Allow merchants to export their payment history as a CSV file.

## Tasks
- [ ] \`GET /api/v1/payments/export?format=csv\`
- [ ] Include all fields: reference, amount, status, network, date, txHash
- [ ] Support date range filter on export
- [ ] Stream response as CSV download
- [ ] Limit to 10,000 records per export

## Acceptance Criteria
- CSV headers match field names
- Date range filter respected
- File downloads with correct Content-Disposition header" \
  "module:payments"

create_issue \
  "[Payments] Payment detail page — public endpoint" \
  "## Overview
Provide a public endpoint for the customer payment page to retrieve payment details.

## Tasks
- [ ] \`GET /api/v1/pay/:reference\` — no auth required
- [ ] Return: amount, network, status, memo, address, expiresAt, QR code
- [ ] Exclude sensitive merchant fields
- [ ] Return 404 for unknown reference

## Acceptance Criteria
- No authentication required
- QR code and Stellar URI included
- Status updates visible on poll" \
  "module:payments"

create_issue \
  "[Payments] Real-time payment status updates via SSE" \
  "## Overview
Push payment status updates to the customer payment page via Server-Sent Events.

## Tasks
- [ ] \`GET /api/v1/pay/:reference/stream\` — SSE endpoint
- [ ] Emit status change events when payment status changes
- [ ] Close stream when payment reaches terminal state (settled, failed, expired)
- [ ] Handle client disconnect gracefully

## Acceptance Criteria
- Customer page receives status updates without polling
- Stream closes automatically on terminal status
- Heartbeat sent every 15 seconds to keep connection alive" \
  "module:payments"

create_issue \
  "[Payments] Payment cancellation by merchant" \
  "## Overview
Allow merchants to cancel a pending payment request.

## Tasks
- [ ] \`DELETE /api/v1/payments/:id\` endpoint
- [ ] Only \`pending\` payments can be cancelled
- [ ] Update status to \`cancelled\`
- [ ] Fire \`payment.cancelled\` webhook

## Acceptance Criteria
- Non-pending payments return 422 when cancelled
- Merchant can only cancel their own payments
- Cancellation is immediate" \
  "module:payments"

create_issue \
  "[Payments] Payment receipt generation (PDF)" \
  "## Overview
Generate a PDF receipt for settled payments.

## Tasks
- [ ] \`GET /api/v1/payments/:id/receipt\` endpoint
- [ ] Only available for \`settled\` payments
- [ ] Include: merchant name, amount, reference, date, tx hash, fee
- [ ] Generate PDF using \`pdfkit\` or \`puppeteer\`

## Acceptance Criteria
- Receipt only available for settled payments
- PDF includes all required fields
- Downloadable via browser" \
  "module:payments"

create_issue \
  "[Payments] Payment metadata handling" \
  "## Overview
Allow merchants to attach arbitrary metadata to payment requests for internal use.

## Tasks
- [ ] Accept \`metadata\` JSON object on payment creation
- [ ] Store as JSONB in PostgreSQL
- [ ] Return metadata in payment detail response
- [ ] Validate: max 20 keys, string values only, max 500 chars per value

## Acceptance Criteria
- Metadata preserved through payment lifecycle
- Validation errors return 400
- Metadata searchable via exact key-value match" \
  "module:payments"

create_issue \
  "[Payments] Payment amount validation and limits" \
  "## Overview
Enforce minimum and maximum payment amounts per merchant.

## Tasks
- [ ] Minimum payment: $0.50 USD
- [ ] Maximum payment: $10,000 USD (configurable per merchant tier)
- [ ] Validate on payment creation
- [ ] Return clear error message with allowed range

## Acceptance Criteria
- Sub-minimum amounts rejected with 400
- Over-limit amounts rejected with 400
- Error message states the allowed range" \
  "module:payments"

create_issue \
  "[Payments] Payment notification emails to customer" \
  "## Overview
Send email notifications to customers when payment status changes.

## Tasks
- [ ] Send confirmation email when payment confirmed
- [ ] Send receipt email when payment settled
- [ ] Email sent to \`customerEmail\` if provided on payment creation
- [ ] Use HTML email templates

## Acceptance Criteria
- Emails only sent when customerEmail is present
- Settled email includes receipt details
- Unsubscribe link included in footer" \
  "module:payments"

create_issue \
  "[Payments] Shareable payment link generation" \
  "## Overview
Generate a short, shareable URL that customers can open to make payment.

## Tasks
- [ ] Payment link format: \`https://cheesepay.xyz/pay/{reference}\`
- [ ] Include link in payment creation response
- [ ] Optionally generate short link via URL shortener
- [ ] QR code encodes the payment link URL as alternative

## Acceptance Criteria
- Payment link opens the customer payment page
- Link works without authentication
- QR code can encode either Stellar URI or payment link" \
  "module:payments"

create_issue \
  "[Payments] Batch payment creation" \
  "## Overview
Allow merchants to create multiple payment requests in a single API call.

## Tasks
- [ ] \`POST /api/v1/payments/batch\` endpoint
- [ ] Accept array of payment objects (max 50)
- [ ] Create all atomically (transaction)
- [ ] Return array of created payments with individual success/error per item

## Acceptance Criteria
- Partial failure returns per-item status
- Maximum 50 payments per batch
- Each payment has unique reference and memo" \
  "module:payments"

create_issue \
  "[Payments] Payment retry for failed settlements" \
  "## Overview
Allow merchants to retry settlement for payments that failed during fiat transfer.

## Tasks
- [ ] \`POST /api/v1/payments/:id/retry-settlement\`
- [ ] Only payments in \`failed\` status can be retried
- [ ] Re-trigger settlement flow
- [ ] Limit: 3 manual retries per payment

## Acceptance Criteria
- Cannot retry non-failed payments
- Retry limit enforced
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
- Gaps (days with no payments) filled with zeros
- Response cached for 5 minutes" \
  "module:payments"

create_issue \
  "[Payments] Refund processing" \
  "## Overview
Support refunds for settled payments where merchant initiates a crypto refund.

## Tasks
- [ ] \`POST /api/v1/payments/:id/refund\` endpoint
- [ ] Only settled payments can be refunded
- [ ] Merchant provides customer Stellar address for refund
- [ ] Send equivalent USDC/XLM back to customer wallet
- [ ] Log refund transaction

## Acceptance Criteria
- Refund sends crypto (not fiat) back to customer
- Partial refunds supported (specify amount)
- Refund status tracked on payment record" \
  "module:payments"

create_issue \
  "[Payments] Payment confirmation tracking (blockchain confirmations)" \
  "## Overview
Track the number of Stellar ledger confirmations before marking a payment confirmed.

## Tasks
- [ ] Require minimum 5 ledger closes before confirming
- [ ] Track confirmation count on payment entity
- [ ] Update confirmation count in background
- [ ] Expose \`confirmations\` in payment response

## Acceptance Criteria
- Payment not confirmed until min confirmations reached
- Confirmation count updated in real-time
- Configurable minimum confirmations per environment" \
  "module:payments"

create_issue \
  "[Payments] Exchange rate snapshot on payment creation" \
  "## Overview
Capture and store the XLM/USD exchange rate at the time of payment creation.

## Tasks
- [ ] Fetch rate from Stellar DEX at creation time
- [ ] Store rate as \`exchangeRateSnapshot\` on payment
- [ ] Use snapshot for amount calculation, not live rate
- [ ] Expose rate in payment response

## Acceptance Criteria
- Rate is locked at creation time
- Subsequent rate changes do not affect payment amount
- Rate source logged for auditing" \
  "module:payments"

create_issue \
  "[Payments] Payment module unit and integration tests" \
  "## Overview
Comprehensive tests for the payments module.

## Tasks
- [ ] Unit test \`PaymentsService.create\` (valid, invalid amount, expired)
- [ ] Unit test \`PaymentsService.findAll\` (pagination, filters)
- [ ] Integration test payment creation → Stellar monitoring → confirmation
- [ ] Mock \`StellarService\` for unit tests
- [ ] Test QR code generation

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
Initialize Stellar SDK with Horizon connection, keypair, and network configuration.

## Tasks
- [ ] Configure Horizon URL from env (testnet/mainnet)
- [ ] Load deposit wallet keypair from \`STELLAR_ACCOUNT_SECRET\`
- [ ] Set USDC asset with issuer address
- [ ] Health check on module init
- [ ] Log network and account public key on startup

## Acceptance Criteria
- Module fails to start if secret key invalid
- Testnet and mainnet both supported
- Health check logs connection status" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar Horizon connection health check" \
  "## Overview
Implement a health check endpoint that verifies connectivity to Stellar Horizon.

## Tasks
- [ ] \`GET /api/v1/health/stellar\` endpoint
- [ ] Ping Horizon server status
- [ ] Fetch deposit account details to verify key validity
- [ ] Return latency and network info

## Acceptance Criteria
- Returns degraded status if Horizon unreachable
- Returns account public key and balance in response
- Health check timeout: 5 seconds" \
  "module:stellar"

create_issue \
  "[Stellar] XLM/USDC to USD exchange rate fetching" \
  "## Overview
Fetch live exchange rates from Stellar DEX for payment amount calculation.

## Tasks
- [ ] Query Stellar DEX orderbook for XLM/USDC pair
- [ ] Fallback to CoinGecko API if DEX orderbook empty
- [ ] Cache rate for 30 seconds
- [ ] Expose \`GET /api/v1/rates/xlm\` endpoint

## Acceptance Criteria
- Rate always available (fallback works)
- Cached rate served within 30-second window
- Rate includes timestamp of last fetch" \
  "module:stellar"

create_issue \
  "[Stellar] Payment monitoring cron job (Horizon polling)" \
  "## Overview
Poll Stellar Horizon every 30 seconds to detect incoming payments to the deposit address.

## Tasks
- [ ] Cron job runs every 30 seconds
- [ ] Fetch transactions for deposit address using cursor-based pagination
- [ ] Persist cursor to avoid re-processing
- [ ] Match transactions by memo to pending payments
- [ ] Trigger confirmation flow on match

## Acceptance Criteria
- No payment is processed twice (idempotent)
- Cursor persisted across service restarts
- Runs even when no pending payments exist (noop)" \
  "module:stellar"

create_issue \
  "[Stellar] Transaction verification by memo" \
  "## Overview
Verify that an incoming Stellar transaction matches a pending payment by memo.

## Tasks
- [ ] Extract memo from transaction
- [ ] Match memo against pending payments in DB
- [ ] Verify asset type (XLM or USDC)
- [ ] Verify amount within ±2% tolerance of expected
- [ ] Handle memo_text and memo_hash types

## Acceptance Criteria
- Wrong memo → no match
- Correct memo but wrong asset → rejected
- Amount tolerance handles minor fee deductions" \
  "module:stellar"

create_issue \
  "[Stellar] USDC payment support on Stellar" \
  "## Overview
Support USDC (Centre/Circle USDC on Stellar) in addition to XLM payments.

## Tasks
- [ ] Configure USDC asset issuer from env
- [ ] Accept USDC in payment monitoring
- [ ] Display USDC payment option in QR code
- [ ] Convert USDC amount to USD at 1:1 rate
- [ ] Log asset type on payment confirmation

## Acceptance Criteria
- USDC payments detected and confirmed
- 1 USDC = 1 USD for settlement calculation
- XLM and USDC payments both supported on same deposit address" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar streaming (real-time transaction events)" \
  "## Overview
Replace polling with Stellar Horizon streaming for real-time payment detection.

## Tasks
- [ ] Use Horizon \`stream()\` API to subscribe to account transactions
- [ ] Handle stream reconnect on disconnect
- [ ] Process streamed events same as polled transactions
- [ ] Disable cron polling when streaming active

## Acceptance Criteria
- Payment detected within 6 seconds of blockchain confirmation
- Stream reconnects automatically on network error
- No duplicate processing between stream and cron" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar account balance monitoring" \
  "## Overview
Monitor the deposit wallet balance and alert when it falls below thresholds.

## Tasks
- [ ] \`GET /api/v1/admin/stellar/balance\` — return XLM and USDC balance
- [ ] Alert admin if XLM balance falls below 10 XLM (minimum reserve)
- [ ] Log balance check results
- [ ] Scheduled check every 10 minutes

## Acceptance Criteria
- Balance fetched from Horizon
- Admin alerted via email if reserve threshold breached
- Balance visible in admin dashboard" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar transaction fee estimation" \
  "## Overview
Estimate Stellar transaction fees before submitting operations.

## Tasks
- [ ] Fetch fee stats from Horizon \`/fee_stats\`
- [ ] Use p90 fee for reliable submission
- [ ] Expose estimated fee in payment creation response
- [ ] Cache fee stats for 60 seconds

## Acceptance Criteria
- Estimated fee in stroops returned in response
- P90 fee used by default
- Cache prevents excessive Horizon calls" \
  "module:stellar"

create_issue \
  "[Stellar] Multi-signature Stellar transactions" \
  "## Overview
Support multi-sig for high-value outgoing transactions (settlements/refunds).

## Tasks
- [ ] Configure threshold: transactions > $1,000 require multi-sig
- [ ] Support adding co-signers to the deposit account
- [ ] Queue high-value transactions for manual approval
- [ ] Admin endpoint to approve pending multi-sig transactions

## Acceptance Criteria
- Low-value transactions signed and submitted automatically
- High-value transactions held for approval
- Co-signer keys never stored in server memory" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar path payment for currency conversion" \
  "## Overview
Use Stellar path payments to convert XLM to USDC before settlement.

## Tasks
- [ ] Implement \`pathPaymentStrictReceive\` operation
- [ ] Find best conversion path via Stellar DEX
- [ ] Validate slippage tolerance (max 1%)
- [ ] Log conversion rate and path used

## Acceptance Criteria
- XLM automatically converted to USDC via DEX
- Slippage > 1% causes transaction to fail
- Path payment recorded in settlement details" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar testnet vs mainnet environment switching" \
  "## Overview
Support seamless switching between Stellar testnet and mainnet via configuration.

## Tasks
- [ ] \`STELLAR_NETWORK\` env var controls network (TESTNET/PUBLIC)
- [ ] Different USDC issuer addresses per network
- [ ] Testnet payments do not trigger real settlement
- [ ] Sandbox mode flag prevents real fiat transfers

## Acceptance Criteria
- Single env var change switches all Stellar interactions
- Testnet mode clearly labeled in API responses
- No real money movement in testnet mode" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar transaction history for admin" \
  "## Overview
Provide admin access to full Stellar transaction history for the deposit account.

## Tasks
- [ ] \`GET /api/v1/admin/stellar/transactions\` — paginated list
- [ ] Fetch from Horizon with cursor pagination
- [ ] Display memo, amount, sender, timestamp
- [ ] Link to matched payment record where applicable

## Acceptance Criteria
- Full history available to admin
- Unmatched transactions visible (edge case detection)
- Cursor-based pagination for efficiency" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar account creation for merchant sub-wallets" \
  "## Overview
Create dedicated Stellar sub-accounts per merchant for isolated fund tracking.

## Tasks
- [ ] Generate new Stellar keypair on merchant creation
- [ ] Fund new account with minimum XLM reserve
- [ ] Assign \`merchantStellarPublicKey\` to merchant entity
- [ ] Route payments to merchant-specific address

## Acceptance Criteria
- Each merchant has unique deposit address
- Minimum reserve (1.5 XLM) funded automatically
- Keypairs encrypted at rest" \
  "module:stellar"

create_issue \
  "[Stellar] Stellar module unit tests" \
  "## Overview
Unit tests for StellarService and StellarMonitorService.

## Tasks
- [ ] Test \`StellarService.verifyPayment\` (match, wrong memo, wrong asset)
- [ ] Test \`StellarService.getXlmUsdRate\` (DEX available, fallback)
- [ ] Test \`StellarMonitorService.scanPendingPayments\` (match found, no match)
- [ ] Mock Horizon server with \`stellar-sdk\` test utilities

## Acceptance Criteria
- All verification logic paths tested
- No real Horizon calls in unit tests
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
- [ ] Listen for \`payment.confirmed\` event
- [ ] Calculate fee and net amount
- [ ] Create settlement record in DB
- [ ] Update payment status to \`settling\`
- [ ] Fire \`payment.settling\` webhook

## Acceptance Criteria
- Settlement created within 5 seconds of payment confirmation
- Fee calculation uses merchant-specific rate
- Settlement ID linked to payment record" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement fee calculation" \
  "## Overview
Calculate the platform fee for each settlement based on merchant fee rate.

## Tasks
- [ ] Fee = amountUsd × merchant.feeRate
- [ ] Net = amountUsd - fee
- [ ] Store fee, net, and gross separately on settlement
- [ ] Support minimum fee floor ($0.10)
- [ ] Return fee breakdown in settlement response

## Acceptance Criteria
- Fee calculation is accurate to 6 decimal places
- Minimum fee floor applied
- Breakdown visible to merchant" \
  "module:settlements"

create_issue \
  "[Settlements] Fiat transfer via partner API" \
  "## Overview
Execute the fiat bank transfer via a partner liquidity/payment provider.

## Tasks
- [ ] POST to partner API with net amount and merchant bank details
- [ ] Handle partner API errors gracefully
- [ ] Store \`partnerReference\` from partner response
- [ ] Retry on transient errors (502, 503) with exponential backoff

## Acceptance Criteria
- Successful transfer updates settlement to \`completed\`
- Failed transfer updates to \`failed\` with reason stored
- Partner reference stored for reconciliation" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement status tracking and lifecycle" \
  "## Overview
Track settlement through its full lifecycle: pending → processing → completed/failed.

## Tasks
- [ ] Define SettlementStatus enum
- [ ] Update status at each lifecycle stage
- [ ] Record timestamps: processingAt, completedAt, failedAt
- [ ] Expose status in \`GET /api/v1/settlements/:id\`

## Acceptance Criteria
- All status transitions logged with timestamp
- Terminal states (completed, failed) cannot transition further
- Status history queryable" \
  "module:settlements"

create_issue \
  "[Settlements] Batch settlement optimization" \
  "## Overview
Group multiple small confirmed payments into a single settlement batch to reduce bank transfer fees.

## Tasks
- [ ] Queue confirmed payments for batch every 15 minutes
- [ ] Combine payments from same merchant into one settlement
- [ ] Minimum batch threshold: $10 USD
- [ ] Individual settlement option for amounts > $500

## Acceptance Criteria
- Payments under $10 batched together
- Batch size capped at 50 payments
- Large payments settled individually immediately" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement retry logic with exponential backoff" \
  "## Overview
Automatically retry failed settlements with increasing delays.

## Tasks
- [ ] Retry on partner API failure up to 3 times
- [ ] Delays: 1 min, 5 min, 30 min
- [ ] After 3 failures, mark as permanently failed and alert admin
- [ ] Log each retry attempt

## Acceptance Criteria
- Transient failures recovered automatically
- Permanent failure triggers admin alert
- Retry count stored on settlement record" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement reporting and export" \
  "## Overview
Allow merchants to view and export their settlement history.

## Tasks
- [ ] \`GET /api/v1/settlements\` with pagination and date filter
- [ ] \`GET /api/v1/settlements/export?format=csv\`
- [ ] CSV includes: date, gross, fee, net, currency, status, bankRef
- [ ] Monthly settlement summary endpoint

## Acceptance Criteria
- CSV downloadable with all fields
- Date range filter works correctly
- Summary includes totals for filtered period" \
  "module:settlements"

create_issue \
  "[Settlements] Multi-currency settlement support" \
  "## Overview
Support settlement in multiple fiat currencies (NGN, USD, EUR, GBP).

## Tasks
- [ ] Fetch live USD→fiat conversion rate from partner API
- [ ] Apply conversion at settlement time
- [ ] Store \`fiatAmount\` and \`fiatCurrency\` on settlement
- [ ] Support merchant preference for settlement currency

## Acceptance Criteria
- Rate fetched fresh for each settlement
- NGN default for Nigerian merchants
- Conversion rate stored for audit purposes" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement notification to merchant" \
  "## Overview
Notify merchants when their settlement is completed or fails.

## Tasks
- [ ] Send email when settlement completes
- [ ] Send email when settlement fails
- [ ] Email includes: amount, bank reference, date
- [ ] Respect merchant notification preferences

## Acceptance Criteria
- Email sent within 1 minute of status change
- Email includes bank transfer reference
- Failure email includes reason and retry info" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement reconciliation report" \
  "## Overview
Generate a reconciliation report matching Stellar transactions to settlements.

## Tasks
- [ ] Admin endpoint: \`GET /api/v1/admin/reconciliation\`
- [ ] Match each settlement to its originating Stellar tx hash
- [ ] Flag discrepancies (missing tx hash, amount mismatch)
- [ ] Export as CSV for accounting

## Acceptance Criteria
- Every settlement traceable to a Stellar transaction
- Discrepancies highlighted in report
- Report filterable by date range" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement approval workflow for large amounts" \
  "## Overview
Require manual admin approval before processing settlements above a threshold.

## Tasks
- [ ] Configure approval threshold (default: $5,000 USD)
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
Maintain a full audit trail of all actions taken on a settlement record.

## Tasks
- [ ] Log: created, status_changed, retry_attempted, approved, completed, failed
- [ ] Include actor (system or admin user), timestamp, metadata
- [ ] \`GET /api/v1/admin/settlements/:id/audit\` endpoint
- [ ] Immutable log (no updates or deletes)

## Acceptance Criteria
- Every state change creates an audit entry
- System actions logged as \`actor: system\`
- Audit log queryable by settlement ID" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement webhook events" \
  "## Overview
Fire webhook events at each stage of the settlement lifecycle.

## Tasks
- [ ] Fire \`payment.settling\` when settlement starts
- [ ] Fire \`payment.settled\` when settlement completes
- [ ] Fire \`payment.failed\` when settlement permanently fails
- [ ] Include settlement details in payload

## Acceptance Criteria
- All three events fired at correct lifecycle stage
- Payload includes settlement ID, amount, currency
- Events retried on webhook delivery failure" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement scheduling (deferred settlement)" \
  "## Overview
Allow merchants to schedule settlements at specific times (e.g., end of business day).

## Tasks
- [ ] Merchant setting: instant vs scheduled (daily/weekly)
- [ ] Queue confirmed payments for scheduled batch
- [ ] Process batch at configured time (e.g., 5pm WAT)
- [ ] Merchant can trigger manual settlement early

## Acceptance Criteria
- Scheduled settlement fires at configured time
- Manual trigger available within schedule window
- Accumulated payments included in batch" \
  "module:settlements"

create_issue \
  "[Settlements] Settlement module unit tests" \
  "## Overview
Comprehensive tests for the settlements module.

## Tasks
- [ ] Test \`SettlementsService.initiateSettlement\` (success, failed partner call)
- [ ] Test fee calculation accuracy
- [ ] Test retry logic (backoff timing)
- [ ] Mock partner API with \`nock\` or \`jest\`
- [ ] Test webhook dispatch calls

## Acceptance Criteria
- 90%+ coverage on SettlementsService
- Partner API failures handled correctly in tests
- Fee edge cases covered (minimum fee, zero fee)" \
  "module:settlements"

# ─────────────────────────────────────────────
# MODULE: WEBHOOKS (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Webhooks] Webhook endpoint registration" \
  "## Overview
Allow merchants to register webhook endpoints for payment event notifications.

## Tasks
- [ ] \`POST /api/v1/webhooks\` — create webhook
- [ ] Accept URL, events array, optional secret
- [ ] Validate URL reachability (optional ping on create)
- [ ] Store signing secret (auto-generated if not provided)
- [ ] \`GET /api/v1/webhooks\` — list webhooks
- [ ] \`DELETE /api/v1/webhooks/:id\` — remove webhook

## Acceptance Criteria
- URL must be HTTPS
- Events validated against allowed list
- Secret generated if not provided" \
  "module:webhooks"

create_issue \
  "[Webhooks] HMAC-SHA256 webhook signature" \
  "## Overview
Sign webhook payloads with HMAC-SHA256 so receivers can verify authenticity.

## Tasks
- [ ] Sign payload body with merchant webhook secret
- [ ] Include \`X-CheesePay-Signature\` header
- [ ] Include \`X-CheesePay-Event\` and \`X-CheesePay-Timestamp\` headers
- [ ] Document signature verification in API docs

## Acceptance Criteria
- Signature computed from raw body, not parsed JSON
- Signature format: \`sha256=<hex>\`
- Timestamp included to prevent replay attacks" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook retry logic with exponential backoff" \
  "## Overview
Retry failed webhook deliveries with increasing delays.

## Tasks
- [ ] Retry up to 5 times on delivery failure (non-2xx or timeout)
- [ ] Delays: 1m, 5m, 30m, 2h, 12h
- [ ] Mark webhook as inactive after 10 consecutive failures
- [ ] Log each delivery attempt and response code

## Acceptance Criteria
- Retry schedule followed strictly
- Webhook deactivated after 10 total failures
- All attempts logged with response body" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook delivery logs" \
  "## Overview
Maintain a log of all webhook delivery attempts for debugging.

## Tasks
- [ ] Store delivery log: webhook ID, event, payload, response code, latency, timestamp
- [ ] \`GET /api/v1/webhooks/:id/deliveries\` — paginated delivery history
- [ ] Retain logs for 30 days
- [ ] Filter by event type and status (success/failed)

## Acceptance Criteria
- Every delivery attempt logged
- Response code and latency recorded
- Failed deliveries searchable" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook test ping endpoint" \
  "## Overview
Allow merchants to send a test event to their webhook URL to verify it works.

## Tasks
- [ ] \`POST /api/v1/webhooks/:id/ping\` endpoint
- [ ] Send sample \`payment.created\` payload to webhook URL
- [ ] Return delivery result (success/fail, response code, latency)
- [ ] Do not create a real payment for the ping

## Acceptance Criteria
- Ping sends real HTTP request to webhook URL
- Returns response within 10-second timeout
- Ping events logged in delivery history" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook event filtering" \
  "## Overview
Allow merchants to subscribe to specific event types per webhook endpoint.

## Tasks
- [ ] Accept \`events\` array on webhook creation (e.g., \`[\"payment.settled\"]\`)
- [ ] Support wildcard \`*\` for all events
- [ ] Only dispatch to webhooks subscribed to the event
- [ ] \`PATCH /api/v1/webhooks/:id\` — update subscribed events

## Acceptance Criteria
- Merchant receives only subscribed events
- Wildcard subscription receives all events
- Event list updatable after creation" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook secret rotation" \
  "## Overview
Allow merchants to rotate the signing secret for a webhook endpoint.

## Tasks
- [ ] \`POST /api/v1/webhooks/:id/rotate-secret\` endpoint
- [ ] Generate new secret
- [ ] Return new secret once (not stored in plaintext)
- [ ] Old secret invalid immediately
- [ ] Log rotation event in audit log

## Acceptance Criteria
- New secret returned only at rotation time
- Deliveries after rotation use new secret
- Rotation logged with timestamp" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook payload versioning" \
  "## Overview
Version webhook payloads to support backward-compatible schema evolution.

## Tasks
- [ ] Include \`apiVersion\` field in all webhook payloads (e.g., \`2024-01\`)
- [ ] Allow merchants to set preferred payload version per webhook
- [ ] Maintain payload transformers for each version
- [ ] Document migration path between versions

## Acceptance Criteria
- Version header \`X-CheesePay-Api-Version\` included
- Old payload format preserved for merchants on older version
- Default version is latest" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhook endpoint deactivation and reactivation" \
  "## Overview
Allow merchants and the system to deactivate/reactivate webhook endpoints.

## Tasks
- [ ] \`PATCH /api/v1/webhooks/:id\` — set \`isActive: false\`
- [ ] System auto-deactivates after 10 failures
- [ ] \`POST /api/v1/webhooks/:id/activate\` — reactivate
- [ ] Reset failure count on reactivation

## Acceptance Criteria
- Deactivated webhooks receive no deliveries
- Reactivation resets failure counter
- Deactivation reason stored (manual vs auto)" \
  "module:webhooks"

create_issue \
  "[Webhooks] Webhooks module unit tests" \
  "## Overview
Unit and integration tests for the webhooks module.

## Tasks
- [ ] Test \`WebhooksService.dispatch\` (matches events, no match)
- [ ] Test HMAC signature generation
- [ ] Test retry backoff scheduling
- [ ] Test deactivation after 10 failures
- [ ] Mock axios with \`nock\`

## Acceptance Criteria
- Dispatch only calls matching webhook URLs
- Signature verified in tests
- Deactivation threshold tested" \
  "module:webhooks"

# ─────────────────────────────────────────────
# MODULE: WAITLIST (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Waitlist] Waitlist registration endpoint" \
  "## Overview
Allow potential merchants to join the waitlist before full launch.

## Tasks
- [ ] \`POST /api/v1/waitlist/join\` endpoint
- [ ] Accept: email, username, businessName, country
- [ ] Reject duplicate emails with 409
- [ ] Send confirmation email on join

## Acceptance Criteria
- Duplicate email returns 409
- Confirmation email sent within 1 minute
- Entry visible in admin waitlist view" \
  "module:waitlist"

create_issue \
  "[Waitlist] Username availability check" \
  "## Overview
Allow users to check if a username is available before joining the waitlist.

## Tasks
- [ ] \`GET /api/v1/waitlist/check/:username\` endpoint
- [ ] Return \`{ available: boolean }\`
- [ ] Case-insensitive comparison
- [ ] Rate limit: 10 checks per minute per IP

## Acceptance Criteria
- Returns \`available: false\` for taken usernames
- Case-insensitive (john = JOHN)
- Rate limited to prevent enumeration" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist position and stats" \
  "## Overview
Show users their position in the waitlist and display total signups.

## Tasks
- [ ] \`GET /api/v1/waitlist/stats\` — return total count
- [ ] \`GET /api/v1/waitlist/position?email=xxx\` — return position number
- [ ] Position based on \`createdAt\` order

## Acceptance Criteria
- Position is accurate (1-indexed)
- Stats cached for 60 seconds
- Unknown email returns 404" \
  "module:waitlist"

create_issue \
  "[Waitlist] Referral system for waitlist" \
  "## Overview
Allow waitlist members to refer others and jump ahead in the queue.

## Tasks
- [ ] Generate unique referral code on join
- [ ] Accept \`referralCode\` on join request
- [ ] Track referral count per member
- [ ] Move referrer up 5 positions per successful referral

## Acceptance Criteria
- Referral code unique per member
- Self-referral rejected
- Position update immediate on successful referral" \
  "module:waitlist"

create_issue \
  "[Waitlist] Admin waitlist management" \
  "## Overview
Allow admins to view, approve, and notify waitlist members.

## Tasks
- [ ] Admin endpoint: \`GET /api/v1/admin/waitlist\` — full list with pagination
- [ ] Admin endpoint: \`POST /api/v1/admin/waitlist/:id/approve\` — grant access
- [ ] Approved members receive onboarding email
- [ ] Filter by country, date range

## Acceptance Criteria
- Approval triggers merchant account creation
- Approved member receives login credentials
- Admin can filter and sort waitlist" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist notification campaign" \
  "## Overview
Send bulk email campaigns to waitlist members (launch announcements, updates).

## Tasks
- [ ] Admin endpoint: \`POST /api/v1/admin/waitlist/notify\`
- [ ] Accept subject, body (markdown)
- [ ] Send to all or filtered subset
- [ ] Track open/click rates via email provider

## Acceptance Criteria
- Bulk email respects unsubscribe preferences
- Preview mode available before sending
- Delivery report available after send" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist export for marketing" \
  "## Overview
Export waitlist data for CRM import.

## Tasks
- [ ] Admin endpoint: \`GET /api/v1/admin/waitlist/export\`
- [ ] CSV format: email, username, businessName, country, position, createdAt
- [ ] Filter by country or date range
- [ ] Exclude unsubscribed members

## Acceptance Criteria
- CSV includes all required fields
- Unsubscribed members excluded
- File downloadable immediately" \
  "module:waitlist"

create_issue \
  "[Waitlist] Waitlist unsubscribe and GDPR deletion" \
  "## Overview
Allow waitlist members to unsubscribe from emails or delete their entry entirely.

## Tasks
- [ ] Unsubscribe link in all waitlist emails
- [ ] \`POST /api/v1/waitlist/unsubscribe?token=xxx\` endpoint
- [ ] \`DELETE /api/v1/waitlist?email=xxx&token=xxx\` — full deletion
- [ ] Confirm deletion via email

## Acceptance Criteria
- Unsubscribe link works without login
- Deletion removes all PII within 30 days
- Confirmation email sent on deletion" \
  "module:waitlist"

# ─────────────────────────────────────────────
# MODULE: ADMIN (15 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Admin] Admin authentication and authorization" \
  "## Overview
Separate authentication flow for admin users with elevated privileges.

## Tasks
- [ ] Admin user entity with email + password
- [ ] \`POST /api/v1/admin/auth/login\` endpoint
- [ ] Admin JWT with \`role: admin\` claim
- [ ] Restrict all \`/admin/*\` routes to admin role
- [ ] Admin accounts created via CLI seed script

## Acceptance Criteria
- Merchant JWT cannot access admin routes
- Admin login uses separate credentials
- Admin JWT expiry: 8 hours" \
  "module:admin"

create_issue \
  "[Admin] Admin dashboard overview metrics" \
  "## Overview
Provide admins with a real-time overview of platform health and activity.

## Tasks
- [ ] \`GET /api/v1/admin/stats\` endpoint
- [ ] Return: total merchants, total payments, total volume (USD), settlement volume
- [ ] Active payments in last 24 hours
- [ ] System health indicators (DB, Stellar connection)

## Acceptance Criteria
- Stats computed from live DB
- Cached for 30 seconds
- Stellar connectivity status included" \
  "module:admin"

create_issue \
  "[Admin] Merchant management — list, view, update" \
  "## Overview
Admin CRUD for merchant accounts.

## Tasks
- [ ] \`GET /api/v1/admin/merchants\` — paginated list with search
- [ ] \`GET /api/v1/admin/merchants/:id\` — full merchant detail
- [ ] \`PATCH /api/v1/admin/merchants/:id\` — update any field
- [ ] \`PATCH /api/v1/admin/merchants/:id/status\` — change status

## Acceptance Criteria
- Search by email, businessName, country
- All fields editable by admin
- Status change triggers notification to merchant" \
  "module:admin"

create_issue \
  "[Admin] Payment oversight — view all payments across merchants" \
  "## Overview
Allow admins to view all payments on the platform across all merchants.

## Tasks
- [ ] \`GET /api/v1/admin/payments\` — paginated, filterable
- [ ] Filter by: merchantId, status, network, dateRange, minAmount
- [ ] \`GET /api/v1/admin/payments/:id\` — full payment detail
- [ ] Link to Stellar transaction on Stellar.expert

## Acceptance Criteria
- Platform-wide view not filtered by merchant
- Stellar tx link generated automatically
- All payment fields visible including internal fields" \
  "module:admin"

create_issue \
  "[Admin] Settlement oversight and manual triggering" \
  "## Overview
Admin view of all settlements with ability to manually trigger or retry.

## Tasks
- [ ] \`GET /api/v1/admin/settlements\` — all settlements with filters
- [ ] \`POST /api/v1/admin/settlements/:id/retry\` — manual retry
- [ ] \`POST /api/v1/admin/settlements/:id/approve\` — approve large settlements
- [ ] View partner API reference per settlement

## Acceptance Criteria
- Admin can force retry any failed settlement
- Approval workflow for large settlements enforced
- Partner reference visible for bank reconciliation" \
  "module:admin"

create_issue \
  "[Admin] Platform fee configuration" \
  "## Overview
Allow admins to set global and per-merchant fee rates.

## Tasks
- [ ] \`GET /api/v1/admin/fees\` — current global fee config
- [ ] \`PATCH /api/v1/admin/fees\` — update global default fee
- [ ] Per-merchant override via merchant update endpoint
- [ ] Fee change takes effect on next settlement

## Acceptance Criteria
- Global fee change affects all merchants without custom rate
- Custom rate preserved when global changes
- Fee history auditable" \
  "module:admin"

create_issue \
  "[Admin] Platform-wide audit log viewer" \
  "## Overview
Admin view of all system audit events across all modules.

## Tasks
- [ ] \`GET /api/v1/admin/audit-log\` — paginated event log
- [ ] Filter by: actor, action, resourceType, dateRange
- [ ] Export to CSV
- [ ] Alert on suspicious patterns (many failed logins)

## Acceptance Criteria
- All audit events from all modules visible
- Export includes all fields
- Log is read-only" \
  "module:admin"

create_issue \
  "[Admin] Transaction monitoring for AML compliance" \
  "## Overview
Flag suspicious transaction patterns for AML (Anti-Money Laundering) review.

## Tasks
- [ ] Flag payments > $10,000 USD
- [ ] Flag merchants with > 50 payments/day velocity
- [ ] Flag unusual geographic patterns
- [ ] Admin dashboard for flagged items
- [ ] Admin can clear or escalate flags

## Acceptance Criteria
- Flagged payments do not block settlement (flag only)
- Admin notified of new flags via email
- Flag history maintained per merchant" \
  "module:admin"

create_issue \
  "[Admin] System health monitoring dashboard" \
  "## Overview
Admin endpoint showing health of all system components.

## Tasks
- [ ] DB connectivity and query latency
- [ ] Stellar Horizon connectivity
- [ ] Partner API reachability
- [ ] Queue depth (pending settlements, webhooks)
- [ ] \`GET /api/v1/admin/health\` aggregates all checks

## Acceptance Criteria
- All components checked on each request
- Response includes per-component status and latency
- Overall status: healthy / degraded / down" \
  "module:admin"

create_issue \
  "[Admin] Compliance reporting (PCI-DSS readiness)" \
  "## Overview
Generate compliance reports for PCI-DSS and financial regulation requirements.

## Tasks
- [ ] Access control report (who accessed what)
- [ ] Data retention policy enforcement report
- [ ] Failed authentication report
- [ ] Settlement reconciliation report
- [ ] Export as PDF for auditors

## Acceptance Criteria
- Reports cover required PCI-DSS scope
- Generated on demand
- Downloadable PDF format" \
  "module:admin"

create_issue \
  "[Admin] Admin bulk actions on merchants" \
  "## Overview
Allow admins to perform actions on multiple merchants at once.

## Tasks
- [ ] Bulk suspend: \`POST /api/v1/admin/merchants/bulk/suspend\`
- [ ] Bulk activate: \`POST /api/v1/admin/merchants/bulk/activate\`
- [ ] Accept array of merchant IDs (max 100)
- [ ] Log each action individually in audit log

## Acceptance Criteria
- Partial success supported (individual errors reported)
- Max 100 IDs per request
- All actions audited" \
  "module:admin"

create_issue \
  "[Admin] Admin notification and alert system" \
  "## Overview
Notify admins of critical platform events requiring attention.

## Tasks
- [ ] Alert types: low Stellar balance, settlement failure spike, suspicious activity
- [ ] Email and in-app notifications
- [ ] Admin can configure alert thresholds
- [ ] Alert acknowledgment workflow

## Acceptance Criteria
- Alerts sent within 1 minute of trigger condition
- Each alert type configurable threshold
- Acknowledged alerts not re-sent" \
  "module:admin"

create_issue \
  "[Admin] Admin user management (create/remove admin users)" \
  "## Overview
Allow super-admins to create and manage admin user accounts.

## Tasks
- [ ] Super-admin role above admin
- [ ] \`POST /api/v1/admin/users\` — create admin
- [ ] \`DELETE /api/v1/admin/users/:id\` — remove admin
- [ ] Admin accounts require 2FA
- [ ] IP allowlisting for admin login

## Acceptance Criteria
- Only super-admin can create/delete admins
- 2FA enforced for all admin accounts
- Admin creation logged" \
  "module:admin"

create_issue \
  "[Admin] Sandbox environment management" \
  "## Overview
Manage the sandbox/testnet environment for developer testing.

## Tasks
- [ ] Toggle sandbox mode per merchant
- [ ] Sandbox payments use Stellar testnet
- [ ] Sandbox settlements are simulated (no real fiat)
- [ ] Seed test data for sandbox merchants
- [ ] Admin endpoint to reset sandbox data

## Acceptance Criteria
- Sandbox payments never trigger real settlements
- Sandbox clearly indicated in all responses
- Test USDC faucet available for sandbox merchants" \
  "module:admin"

create_issue \
  "[Admin] Admin module unit tests" \
  "## Overview
Tests for admin module services and controllers.

## Tasks
- [ ] Test admin auth (valid, invalid, insufficient role)
- [ ] Test merchant management CRUD
- [ ] Test bulk actions (partial failure)
- [ ] Test stats aggregation
- [ ] Mock all service dependencies

## Acceptance Criteria
- Admin auth tests cover role enforcement
- Bulk action partial failure tested
- 85%+ coverage on admin service" \
  "module:admin"

# ─────────────────────────────────────────────
# MODULE: ANALYTICS (12 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Analytics] Payment volume time-series metrics" \
  "## Overview
Track payment volume over time for merchant and admin analytics.

## Tasks
- [ ] Daily volume aggregation (USD, count)
- [ ] Monthly volume aggregation
- [ ] \`GET /api/v1/analytics/volume?period=daily&dateFrom=&dateTo=\`
- [ ] Fill gaps with zeros for days with no activity
- [ ] Cache results for 5 minutes

## Acceptance Criteria
- Returns array of {date, count, volumeUsd}
- Gaps filled with zero entries
- Merchant-scoped and admin-global versions" \
  "module:analytics"

create_issue \
  "[Analytics] Revenue analytics (fees earned)" \
  "## Overview
Track platform fee revenue over time for merchant and admin views.

## Tasks
- [ ] Aggregate fee revenue by day/month
- [ ] \`GET /api/v1/analytics/revenue\`
- [ ] Merchant view: their fees paid
- [ ] Admin view: total platform revenue

## Acceptance Criteria
- Fee revenue matches settlement fee records
- Period-over-period comparison available
- Response includes totals and breakdown" \
  "module:analytics"

create_issue \
  "[Analytics] Settlement rate and conversion funnel" \
  "## Overview
Track what percentage of created payments result in settled transactions.

## Tasks
- [ ] Calculate: created → confirmed → settled conversion rate
- [ ] Identify drop-off at each stage
- [ ] \`GET /api/v1/analytics/funnel\`
- [ ] Break down by network and date range

## Acceptance Criteria
- Funnel shows count and % at each stage
- Expired and failed payments tracked separately
- Period comparison supported" \
  "module:analytics"

create_issue \
  "[Analytics] Merchant growth metrics (admin)" \
  "## Overview
Track merchant signups and activation over time for admin analytics.

## Tasks
- [ ] Daily new merchant signups
- [ ] Activation rate (registered → first payment)
- [ ] Merchant retention (active in last 30 days)
- [ ] \`GET /api/v1/admin/analytics/merchants\`

## Acceptance Criteria
- Signup trends visible by day/week/month
- Activation funnel calculated
- Churn rate estimated" \
  "module:analytics"

create_issue \
  "[Analytics] Geographic distribution of payments" \
  "## Overview
Track which countries merchants and payments originate from.

## Tasks
- [ ] Extract country from merchant profile
- [ ] Group payment volume by merchant country
- [ ] \`GET /api/v1/admin/analytics/geography\`
- [ ] Return: country, merchantCount, paymentCount, volumeUsd

## Acceptance Criteria
- Data grouped by ISO country code
- Sortable by volume or merchant count
- Used for heatmap visualization on admin dashboard" \
  "module:analytics"

create_issue \
  "[Analytics] Top merchants by volume report" \
  "## Overview
Identify the highest-volume merchants for the admin overview.

## Tasks
- [ ] \`GET /api/v1/admin/analytics/top-merchants?limit=10\`
- [ ] Rank by total USD volume in selected period
- [ ] Include: merchant name, volume, payment count, settlement count
- [ ] Cache for 10 minutes

## Acceptance Criteria
- Returns top N merchants by volume
- Period filterable (7d, 30d, 90d)
- Tied merchants ordered by payment count" \
  "module:analytics"

create_issue \
  "[Analytics] Real-time dashboard metrics (live counts)" \
  "## Overview
Provide live-updating counters for the admin dashboard.

## Tasks
- [ ] \`GET /api/v1/admin/analytics/live\` — current stats
- [ ] Payments in last 1 hour
- [ ] Pending settlements count
- [ ] Active Stellar monitor status
- [ ] Refresh every 30 seconds from frontend

## Acceptance Criteria
- Data fresher than 60 seconds
- Endpoint responds in < 100ms
- Frontend polls automatically" \
  "module:analytics"

create_issue \
  "[Analytics] Comparative period analytics" \
  "## Overview
Compare current period metrics against previous period.

## Tasks
- [ ] Accept \`compareWith=previous\` query param
- [ ] Return current and previous period side-by-side
- [ ] Calculate % change for each metric
- [ ] Support custom date range comparison

## Acceptance Criteria
- % change calculated correctly (handles zero previous)
- Positive change = growth, negative = decline
- Both periods returned in single response" \
  "module:analytics"

create_issue \
  "[Analytics] Analytics export (PDF report)" \
  "## Overview
Generate a PDF analytics report for a given period.

## Tasks
- [ ] \`POST /api/v1/analytics/export?format=pdf\`
- [ ] Include: volume chart, top stats, settlement summary
- [ ] Merchant-branded with business name
- [ ] Generated async, download link emailed

## Acceptance Criteria
- PDF includes all key metrics
- Merchant logo/name in header
- Download link expires after 24 hours" \
  "module:analytics"

create_issue \
  "[Analytics] Analytics caching layer" \
  "## Overview
Cache analytics query results to avoid expensive DB aggregations on every request.

## Tasks
- [ ] Redis cache for all analytics endpoints
- [ ] TTL: 5 minutes for merchant stats, 10 minutes for admin
- [ ] Cache key includes merchantId and date range
- [ ] Invalidate on relevant data changes

## Acceptance Criteria
- Cached response served in < 20ms
- Uncached response computed within 2 seconds
- Stale cache invalidated on new payment settled" \
  "module:analytics"

create_issue \
  "[Analytics] Network breakdown analytics" \
  "## Overview
Break down payment volume by blockchain network (Stellar, Polygon, etc.).

## Tasks
- [ ] Group payments by \`network\` field
- [ ] \`GET /api/v1/analytics/networks\`
- [ ] Return: network, count, volumeUsd, % of total
- [ ] Historical trend per network

## Acceptance Criteria
- All networks represented even with zero volume
- Percentage calculated correctly
- Sortable by volume" \
  "module:analytics"

create_issue \
  "[Analytics] Analytics module tests" \
  "## Overview
Tests for analytics queries and aggregations.

## Tasks
- [ ] Test volume aggregation (daily, monthly)
- [ ] Test funnel calculation
- [ ] Test period comparison (including zero previous)
- [ ] Test caching behavior
- [ ] Use in-memory DB for tests

## Acceptance Criteria
- Edge cases tested (no data, single record)
- Cache hit/miss both tested
- Date range boundaries tested" \
  "module:analytics"

# ─────────────────────────────────────────────
# MODULE: SECURITY (12 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Security] Global rate limiting middleware" \
  "## Overview
Apply rate limiting across all API endpoints to prevent abuse.

## Tasks
- [ ] \`@nestjs/throttler\` global guard
- [ ] Default: 100 req/min per IP
- [ ] Higher limits for authenticated merchants
- [ ] Return 429 with \`Retry-After\` header
- [ ] Exempt health check endpoints

## Acceptance Criteria
- IP-based limiting for unauthenticated requests
- Merchant-based limiting for authenticated requests
- Health endpoint excluded from limits" \
  "module:security"

create_issue \
  "[Security] Helmet.js security headers" \
  "## Overview
Add standard security HTTP headers to all API responses.

## Tasks
- [ ] Install and configure \`helmet\` in NestJS
- [ ] Enable: CSP, HSTS, X-Frame-Options, X-XSS-Protection
- [ ] Customize CSP for Swagger UI
- [ ] Disable headers that expose implementation details (X-Powered-By)

## Acceptance Criteria
- All Helmet defaults enabled
- Swagger UI still works with CSP
- X-Powered-By removed from responses" \
  "module:security"

create_issue \
  "[Security] CORS configuration" \
  "## Overview
Configure CORS to only allow requests from trusted origins.

## Tasks
- [ ] Restrict to configured \`ALLOWED_ORIGINS\` env var
- [ ] Allow frontend domain in production
- [ ] Allow all origins in development
- [ ] Proper OPTIONS preflight handling

## Acceptance Criteria
- Unknown origins blocked with CORS error
- Preflight responds with correct headers
- Credentials mode supported for cookies" \
  "module:security"

create_issue \
  "[Security] Input validation and sanitization" \
  "## Overview
Validate and sanitize all incoming request data to prevent injection attacks.

## Tasks
- [ ] Global \`ValidationPipe\` with \`whitelist: true\`
- [ ] Strip unknown properties from request bodies
- [ ] Sanitize string inputs (trim, escape HTML)
- [ ] Validate UUIDs in path params

## Acceptance Criteria
- Unknown body fields silently stripped
- Invalid UUIDs in path return 400
- HTML in string fields escaped" \
  "module:security"

create_issue \
  "[Security] API key scoping" \
  "## Overview
Allow merchant API keys to be scoped to specific operations.

## Tasks
- [ ] Define scopes: \`payments:read\`, \`payments:write\`, \`settlements:read\`
- [ ] Store scopes on API key record
- [ ] Enforce scope check in ApiKeyGuard
- [ ] Return 403 if scope insufficient

## Acceptance Criteria
- Read-only key cannot create payments
- Scope validated per endpoint
- Scope list returned in merchant profile" \
  "module:security"

create_issue \
  "[Security] Encrypted field storage for sensitive data" \
  "## Overview
Encrypt sensitive fields (bank account numbers, Stellar private keys) at rest.

## Tasks
- [ ] Implement \`EncryptionService\` using AES-256-GCM
- [ ] TypeORM column transformer for encrypted fields
- [ ] Encryption key from \`ENCRYPTION_KEY\` env var (32 bytes)
- [ ] Decrypt only when needed, never log plaintext

## Acceptance Criteria
- Encrypted fields unreadable in DB without key
- Key rotation process documented
- Decryption failures logged as security events" \
  "module:security"

create_issue \
  "[Security] Audit logging service" \
  "## Overview
Centralized audit logging for all security-relevant events.

## Tasks
- [ ] \`AuditService\` injectable across all modules
- [ ] Log: actor, action, resource, before, after, IP, timestamp
- [ ] Store in \`audit_logs\` table (append-only)
- [ ] Auto-called via interceptor for sensitive endpoints

## Acceptance Criteria
- No audit log entry can be modified or deleted
- All sensitive actions produce audit entries
- Log queryable by actor, action, date" \
  "module:security"

create_issue \
  "[Security] IP allowlisting for admin endpoints" \
  "## Overview
Restrict admin endpoint access to specific IP addresses.

## Tasks
- [ ] \`ADMIN_ALLOWED_IPS\` env var (comma-separated)
- [ ] IP whitelist guard applied to all \`/admin/*\` routes
- [ ] Return 403 for disallowed IPs
- [ ] Log blocked access attempts

## Acceptance Criteria
- Admin routes inaccessible from non-whitelisted IPs
- Empty allowlist defaults to block all (secure default)
- Development mode can bypass allowlist" \
  "module:security"

create_issue \
  "[Security] Request signing validation for webhooks received" \
  "## Overview
Validate signatures on incoming webhook callbacks from partner APIs.

## Tasks
- [ ] Partner API sends \`X-Partner-Signature\` header
- [ ] Validate HMAC-SHA256 against shared partner secret
- [ ] Reject invalid signatures with 403
- [ ] Log verification failures

## Acceptance Criteria
- Invalid signature returns 403
- Timing-safe comparison used
- Verification failure logged as security event" \
  "module:security"

create_issue \
  "[Security] SQL injection prevention" \
  "## Overview
Ensure all DB queries are parameterized to prevent SQL injection.

## Tasks
- [ ] Use TypeORM query builder with parameters only
- [ ] Ban raw SQL strings with user input
- [ ] Add \`eslint-plugin-security\` to lint for dangerous patterns
- [ ] Pen test key endpoints

## Acceptance Criteria
- No raw SQL concatenation in codebase
- ESLint rule flags dangerous patterns
- TypeORM \`QueryBuilder\` used for all dynamic queries" \
  "module:security"

create_issue \
  "[Security] PCI-DSS compliance checklist" \
  "## Overview
Assess and document PCI-DSS compliance requirements for the platform.

## Tasks
- [ ] Document scope of cardholder data (none — crypto only)
- [ ] Implement access control per PCI requirement 7
- [ ] Encryption in transit (TLS 1.2+) enforced
- [ ] Vulnerability management process documented
- [ ] Security testing schedule

## Acceptance Criteria
- PCI-DSS SAQ-A or SAQ-D scope determined
- All applicable controls documented
- Annual review process established" \
  "module:security"

create_issue \
  "[Security] Dependency vulnerability scanning" \
  "## Overview
Automate scanning for known vulnerabilities in npm dependencies.

## Tasks
- [ ] Add \`npm audit\` to CI pipeline
- [ ] Configure \`dependabot\` for automatic PRs
- [ ] Block CI on high/critical vulnerabilities
- [ ] Weekly audit report to admin email

## Acceptance Criteria
- CI fails on high/critical vulnerabilities
- Dependabot PRs auto-created for patches
- Weekly report generated automatically" \
  "module:security"

# ─────────────────────────────────────────────
# MODULE: NOTIFICATIONS (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Notifications] Email notification service with templates" \
  "## Overview
Implement a reusable email notification service using an email provider.

## Tasks
- [ ] Integrate \`nodemailer\` with SMTP or \`@sendgrid/mail\`
- [ ] HTML email templates using \`handlebars\`
- [ ] Template variables: merchant name, amount, reference, etc.
- [ ] Fallback to plaintext for unsupported clients

## Acceptance Criteria
- Emails render correctly in major clients
- Template variables populated correctly
- Failed sends logged and retried once" \
  "module:notifications"

create_issue \
  "[Notifications] Payment confirmation email" \
  "## Overview
Send email to merchant when a payment is confirmed on Stellar.

## Tasks
- [ ] Template: payment confirmed, amount, reference, tx hash
- [ ] Link to Stellar.expert for tx verification
- [ ] Respect merchant notification preferences
- [ ] Send within 30 seconds of confirmation

## Acceptance Criteria
- Sent to merchant email within 30 seconds
- Stellar tx link included
- Skipped if merchant disabled this notification type" \
  "module:notifications"

create_issue \
  "[Notifications] Settlement completion email" \
  "## Overview
Email merchant when fiat settlement is completed.

## Tasks
- [ ] Template: settlement completed, net amount, currency, bank reference
- [ ] Include itemized fee breakdown
- [ ] Link to settlement detail page
- [ ] Sent within 1 minute of settlement completion

## Acceptance Criteria
- Net amount and fee shown separately
- Bank reference included
- Sent within 1 minute of status change" \
  "module:notifications"

create_issue \
  "[Notifications] Settlement failure alert email" \
  "## Overview
Alert merchant immediately when a settlement fails.

## Tasks
- [ ] Template: settlement failed, reason, payment reference
- [ ] Include link to retry or contact support
- [ ] Also alert admin on settlement failure
- [ ] Sent within 1 minute of failure

## Acceptance Criteria
- Merchant email sent immediately on failure
- Admin also notified
- Reason for failure included in email" \
  "module:notifications"

create_issue \
  "[Notifications] Customer payment confirmation email" \
  "## Overview
Send payment confirmation to the customer who made the payment.

## Tasks
- [ ] Template: payment received, merchant name, amount, receipt reference
- [ ] Only sent when \`customerEmail\` provided on payment
- [ ] Sent on \`payment.settled\` status
- [ ] Include link to receipt download

## Acceptance Criteria
- Sent only when customerEmail present
- Merchant name shown (not internal merchant ID)
- Sent on settled, not just confirmed" \
  "module:notifications"

create_issue \
  "[Notifications] Webhook failure alert" \
  "## Overview
Alert merchant when their webhook endpoint fails repeatedly.

## Tasks
- [ ] Alert after 3 consecutive delivery failures
- [ ] Template: webhook failing, URL, last error, link to fix
- [ ] Alert again at 7 and 10 failures
- [ ] Stop alerts after deactivation

## Acceptance Criteria
- First alert at 3 failures
- Alerts sent at escalating failure counts
- No duplicate alerts within same failure streak" \
  "module:notifications"

create_issue \
  "[Notifications] Push notification support (PWA)" \
  "## Overview
Send push notifications to merchants using the web app.

## Tasks
- [ ] Integrate Web Push API (\`web-push\` package)
- [ ] Store push subscription on merchant
- [ ] Send push on payment confirmed, settled
- [ ] \`POST /api/v1/merchants/me/push-subscription\` to register

## Acceptance Criteria
- Push notification received within 5 seconds of event
- Works on Chrome and Firefox
- Merchant can disable push notifications" \
  "module:notifications"

create_issue \
  "[Notifications] In-app notification system" \
  "## Overview
Store and serve in-app notifications for the merchant dashboard.

## Tasks
- [ ] \`notifications\` entity (merchantId, type, message, read, createdAt)
- [ ] \`GET /api/v1/notifications\` — list unread
- [ ] \`PATCH /api/v1/notifications/:id/read\` — mark as read
- [ ] \`PATCH /api/v1/notifications/read-all\`
- [ ] Unread count badge in dashboard nav

## Acceptance Criteria
- Notifications created on payment events
- Unread count accurate
- Old notifications (> 30 days) auto-deleted" \
  "module:notifications"

create_issue \
  "[Notifications] Notification preference management" \
  "## Overview
Let merchants control which notifications they receive and via which channel.

## Tasks
- [ ] \`GET /api/v1/merchants/me/notification-prefs\`
- [ ] \`PATCH /api/v1/merchants/me/notification-prefs\`
- [ ] Channels: email, push, in-app
- [ ] Event types: payment.confirmed, payment.settled, settlement.failed

## Acceptance Criteria
- Preferences persisted per channel per event
- Disabling email for an event stops that email type
- In-app notifications always created (cannot disable)" \
  "module:notifications"

create_issue \
  "[Notifications] Notifications module unit tests" \
  "## Overview
Tests for the notifications module.

## Tasks
- [ ] Test email template rendering
- [ ] Test notification dispatch respects preferences
- [ ] Test push subscription registration
- [ ] Test in-app notification CRUD
- [ ] Mock email provider

## Acceptance Criteria
- Email templates tested with all variable combinations
- Preference enforcement tested
- All CRUD operations for in-app notifications tested" \
  "module:notifications"

# ─────────────────────────────────────────────
# MODULE: DATABASE (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Database] TypeORM entity configuration and relationships" \
  "## Overview
Define all TypeORM entities with proper relationships, indices, and constraints.

## Tasks
- [ ] Define foreign key constraints for all relationships
- [ ] Add composite unique constraints where needed
- [ ] Add indices for frequently queried columns
- [ ] Ensure cascade delete where appropriate

## Acceptance Criteria
- All FK constraints defined
- Unique constraints prevent data duplication
- Query planner uses indices (EXPLAIN ANALYZE)" \
  "module:database"

create_issue \
  "[Database] Database migration system" \
  "## Overview
Set up TypeORM migrations for production-safe schema changes.

## Tasks
- [ ] Configure TypeORM CLI for migration generation
- [ ] \`npm run migration:generate\` — generate from entity changes
- [ ] \`npm run migration:run\` — apply pending migrations
- [ ] \`npm run migration:revert\` — rollback last migration
- [ ] CI checks for uncommitted migrations

## Acceptance Criteria
- Migrations run without data loss on existing data
- Revert undoes migration cleanly
- All schema changes go through migrations (no \`synchronize: true\` in prod)" \
  "module:database"

create_issue \
  "[Database] Database seeding for development" \
  "## Overview
Provide seed data for local development and testing.

## Tasks
- [ ] Seed: admin user, 3 test merchants, sample payments in all statuses
- [ ] \`npm run db:seed\` command
- [ ] \`npm run db:reset\` — drop, migrate, seed
- [ ] Separate seed for test environment

## Acceptance Criteria
- Seed runs idempotently
- Test seed creates predictable IDs for tests
- Reset command usable in CI" \
  "module:database"

create_issue \
  "[Database] Connection pooling configuration" \
  "## Overview
Configure PostgreSQL connection pooling for production scalability.

## Tasks
- [ ] Set pool min/max based on expected load (min: 2, max: 20)
- [ ] Configure \`acquireTimeoutMillis\` and \`idleTimeoutMillis\`
- [ ] PgBouncer configuration for horizontal scaling
- [ ] Monitor pool exhaustion via metrics

## Acceptance Criteria
- No connection leaks under load
- Pool exhaustion logged as alert
- Configuration tunable via env vars" \
  "module:database"

create_issue \
  "[Database] Soft delete implementation" \
  "## Overview
Implement soft delete for merchant-sensitive records (payments, merchants).

## Tasks
- [ ] Add \`deletedAt\` column (nullable timestamp) to relevant entities
- [ ] TypeORM \`@DeleteDateColumn\` decorator
- [ ] All queries filter out soft-deleted records by default
- [ ] Admin endpoint to view and restore soft-deleted records

## Acceptance Criteria
- Soft-deleted records excluded from normal queries
- Restore endpoint available for admin
- Hard delete only by super-admin" \
  "module:database"

create_issue \
  "[Database] Database indexing strategy" \
  "## Overview
Define and implement indices to optimize common query patterns.

## Tasks
- [ ] Index: \`payments.merchantId\`, \`payments.status\`, \`payments.createdAt\`
- [ ] Index: \`payments.stellarMemo\` (used in matching)
- [ ] Index: \`settlements.merchantId\`, \`settlements.status\`
- [ ] Composite index: (merchantId, createdAt) for paginated lists
- [ ] Analyze slow queries with EXPLAIN

## Acceptance Criteria
- All list queries use indices
- Payment matching by memo uses index
- No sequential scans on large tables" \
  "module:database"

create_issue \
  "[Database] Query optimization for analytics" \
  "## Overview
Optimize heavy analytics aggregation queries.

## Tasks
- [ ] Materialized view for daily payment volumes
- [ ] Refresh materialized view on schedule (every hour)
- [ ] Partition \`payments\` table by month for large datasets
- [ ] Query timeout: 10 seconds for analytics queries

## Acceptance Criteria
- Analytics queries complete in < 500ms with materialized views
- Materialized view refresh does not block queries
- Partition pruning verified via EXPLAIN" \
  "module:database"

create_issue \
  "[Database] Database backup and recovery strategy" \
  "## Overview
Implement automated backups and test recovery procedures.

## Tasks
- [ ] Daily automated PostgreSQL dumps to S3/R2
- [ ] Retain backups for 30 days
- [ ] Point-in-time recovery (WAL archiving)
- [ ] Quarterly recovery drill
- [ ] Alert if backup job fails

## Acceptance Criteria
- Backup job runs daily and succeeds
- Recovery from backup tested quarterly
- RTO < 1 hour, RPO < 24 hours" \
  "module:database"

# ─────────────────────────────────────────────
# MODULE: CACHING (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Cache] Redis integration with NestJS CacheModule" \
  "## Overview
Integrate Redis for caching across the application.

## Tasks
- [ ] Install \`ioredis\` and \`@nestjs/cache-manager\`
- [ ] Configure Redis connection from env vars
- [ ] Global cache module with TTL defaults
- [ ] Graceful degradation if Redis unavailable

## Acceptance Criteria
- App starts without Redis (cache miss fallback)
- Redis connection logged on startup
- TTL configurable per cache key" \
  "module:cache"

create_issue \
  "[Cache] Exchange rate caching" \
  "## Overview
Cache XLM/USD exchange rates to avoid excessive Stellar DEX queries.

## Tasks
- [ ] Cache rate for 30 seconds
- [ ] Cache key: \`rate:xlm:usd\`
- [ ] Force refresh endpoint for admin
- [ ] Log cache hit/miss ratio

## Acceptance Criteria
- Within 30 seconds, same rate returned
- After 30 seconds, fresh rate fetched
- Cache miss logs at debug level" \
  "module:cache"

create_issue \
  "[Cache] Analytics results caching" \
  "## Overview
Cache expensive analytics aggregation query results.

## Tasks
- [ ] Cache key: \`analytics:{merchantId}:{endpoint}:{dateRange}\`
- [ ] TTL: 5 minutes for merchant analytics, 10 minutes for admin
- [ ] Invalidate on new payment.settled event
- [ ] Cache compression for large payloads

## Acceptance Criteria
- Cached responses served in < 20ms
- Cache invalidated when relevant new data arrives
- Large payloads compressed before storage" \
  "module:cache"

create_issue \
  "[Cache] Session caching for auth tokens" \
  "## Overview
Cache validated JWT claims to avoid DB lookup on every request.

## Tasks
- [ ] Cache merchant claims for duration of token TTL
- [ ] Cache key: \`session:{jti}\`
- [ ] Invalidate on logout (blacklist)
- [ ] Fallback to DB if cache miss

## Acceptance Criteria
- After first request, subsequent requests hit cache
- Logout immediately invalidates cache entry
- DB not queried on cached requests" \
  "module:cache"

create_issue \
  "[Cache] Cache warming on application startup" \
  "## Overview
Pre-populate critical caches on application startup to avoid cold start latency.

## Tasks
- [ ] Warm exchange rate cache on startup
- [ ] Warm platform fee config cache
- [ ] Log warm-up completion time
- [ ] Skip warm-up in test environment

## Acceptance Criteria
- Warm-up completes before first request served
- Warm-up logged with duration
- First request has same latency as subsequent requests" \
  "module:cache"

create_issue \
  "[Cache] Distributed cache configuration for multi-instance" \
  "## Overview
Ensure cache works correctly in multi-instance (horizontally scaled) deployments.

## Tasks
- [ ] Shared Redis instance across all app instances
- [ ] Cache invalidation broadcasts to all instances
- [ ] No in-memory cache (all cache through Redis)
- [ ] Cache namespace per environment (dev/staging/prod)

## Acceptance Criteria
- Cache invalidation on one instance reflected on others
- No stale data served after invalidation
- Namespace prevents cross-environment pollution" \
  "module:cache"

create_issue \
  "[Cache] Cache metrics and hit rate monitoring" \
  "## Overview
Track cache performance metrics to optimize cache strategy.

## Tasks
- [ ] Track hit rate, miss rate, eviction rate per cache key pattern
- [ ] Expose metrics via \`/metrics\` endpoint (Prometheus format)
- [ ] Alert if hit rate drops below 80% for exchange rate cache
- [ ] Dashboard in Grafana

## Acceptance Criteria
- Hit/miss rates tracked per endpoint
- Prometheus metrics exported
- Alert triggered on low hit rate" \
  "module:cache"

create_issue \
  "[Cache] Cache invalidation strategy" \
  "## Overview
Define and implement cache invalidation rules to prevent stale data.

## Tasks
- [ ] Event-driven invalidation: payment.settled → invalidate analytics cache
- [ ] TTL-based invalidation for time-sensitive data (rates)
- [ ] Manual invalidation endpoint for admin
- [ ] Document invalidation rules per cache key

## Acceptance Criteria
- No stale cache served after relevant data change
- Manual invalidation available for admin
- Invalidation rules documented" \
  "module:cache"

# ─────────────────────────────────────────────
# MODULE: QUEUE (8 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Queue] Bull queue integration with Redis" \
  "## Overview
Set up Bull queues for async task processing (settlements, webhooks, emails).

## Tasks
- [ ] Install \`@nestjs/bull\` and \`bull\`
- [ ] Configure Redis connection for Bull
- [ ] Create queue modules: settlement, webhook, notification
- [ ] Bull Board UI for admin queue monitoring

## Acceptance Criteria
- Queues operational with Redis backend
- Bull Board accessible at \`/admin/queues\`
- Queue names match job types" \
  "module:queue"

create_issue \
  "[Queue] Settlement processing queue" \
  "## Overview
Process settlement jobs asynchronously via a dedicated Bull queue.

## Tasks
- [ ] Add settlement job to queue on payment confirmation
- [ ] Worker processes one settlement at a time per merchant
- [ ] Retry on failure with exponential backoff
- [ ] Alert on dead letter queue (DLQ) entries

## Acceptance Criteria
- Settlement processing does not block payment confirmation
- Concurrency configurable per queue
- Failed jobs move to DLQ after 3 retries" \
  "module:queue"

create_issue \
  "[Queue] Webhook delivery queue" \
  "## Overview
Deliver webhook notifications asynchronously via Bull queue.

## Tasks
- [ ] Add webhook delivery job on every payment event
- [ ] Worker delivers to each subscribed endpoint
- [ ] Retry failed deliveries per retry schedule
- [ ] Log delivery result back to webhook delivery log

## Acceptance Criteria
- Webhook delivery does not block event dispatch
- Each endpoint gets its own job (parallel delivery)
- Retry schedule: 1m, 5m, 30m, 2h, 12h" \
  "module:queue"

create_issue \
  "[Queue] Email notification queue" \
  "## Overview
Send email notifications asynchronously to avoid blocking API responses.

## Tasks
- [ ] Email jobs added to queue from notification service
- [ ] Worker sends via email provider
- [ ] Retry once on transient SMTP failure
- [ ] Log email send result

## Acceptance Criteria
- Emails sent without delaying API response
- SMTP transient errors retried once
- Send failures logged with error detail" \
  "module:queue"

create_issue \
  "[Queue] Stellar monitoring queue (replacing cron)" \
  "## Overview
Replace the cron-based Stellar monitor with a recurring Bull job for reliability.

## Tasks
- [ ] Repeating Bull job every 30 seconds
- [ ] Job fetches and processes new Stellar transactions
- [ ] Job locked to single instance (prevent parallel runs)
- [ ] Reschedule after failure

## Acceptance Criteria
- Only one monitor job runs at a time
- Job reschedules even after failure
- Job logs run duration and transactions processed" \
  "module:queue"

create_issue \
  "[Queue] Dead letter queue (DLQ) handling" \
  "## Overview
Handle jobs that have exhausted all retries.

## Tasks
- [ ] Configure DLQ per queue
- [ ] Admin endpoint to view DLQ contents
- [ ] Admin endpoint to requeue a DLQ job
- [ ] Alert admin when DLQ size exceeds threshold

## Acceptance Criteria
- Failed jobs land in DLQ automatically
- Admin can inspect and requeue DLQ jobs
- DLQ size alert threshold configurable" \
  "module:queue"

create_issue \
  "[Queue] Queue monitoring and health" \
  "## Overview
Monitor queue health and surface metrics to the admin dashboard.

## Tasks
- [ ] Expose queue depth, processing rate, failure rate per queue
- [ ] Prometheus metrics from Bull
- [ ] Alert if queue depth exceeds 1,000 jobs
- [ ] Alert if processing rate drops to zero

## Acceptance Criteria
- Queue metrics in Prometheus format
- Dashboard shows real-time queue depths
- Alerts fire within 1 minute of threshold breach" \
  "module:queue"

create_issue \
  "[Queue] Queue retry configuration tuning" \
  "## Overview
Fine-tune retry configuration for each queue type.

## Tasks
- [ ] Settlement queue: 3 retries, exponential backoff starting at 1 min
- [ ] Webhook queue: 5 retries, backoff matching webhook retry schedule
- [ ] Email queue: 1 retry, 5 min delay
- [ ] Configurable via env vars

## Acceptance Criteria
- Each queue has appropriate retry config
- Backoff delays configurable per queue
- Config documented in \`.env.example\`" \
  "module:queue"

# ─────────────────────────────────────────────
# MODULE: API / CORE (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[API] API versioning strategy" \
  "## Overview
Implement API versioning to support non-breaking evolution.

## Tasks
- [ ] URL-based versioning: \`/api/v1/\`
- [ ] Version header support: \`Accept: application/vnd.cheesepay.v1+json\`
- [ ] Deprecation notice header for old versions
- [ ] Plan for v2 migration path

## Acceptance Criteria
- v1 prefix on all endpoints
- Version header sets response version
- Deprecated endpoints return \`Deprecation\` header" \
  "module:api"

create_issue \
  "[API] OpenAPI / Swagger documentation" \
  "## Overview
Comprehensive OpenAPI documentation for all endpoints.

## Tasks
- [ ] Swagger UI at \`/docs\`
- [ ] All endpoints documented with \`@ApiOperation\`, \`@ApiResponse\`
- [ ] Request/response schemas from DTOs
- [ ] Bearer auth and API key auth configured in Swagger
- [ ] Export OpenAPI JSON at \`/docs-json\`

## Acceptance Criteria
- Every endpoint visible in Swagger
- All response codes documented
- Swagger usable as sandbox for testing" \
  "module:api"

create_issue \
  "[API] Global exception filter" \
  "## Overview
Standardize error responses across all endpoints.

## Tasks
- [ ] Global \`HttpExceptionFilter\`
- [ ] Standard error format: \`{ statusCode, message, error, timestamp }\`
- [ ] Log unhandled errors with stack trace
- [ ] Sentry capture for 5xx errors

## Acceptance Criteria
- All errors return consistent format
- 500 errors logged with full stack trace
- Validation errors include field-level details" \
  "module:api"

create_issue \
  "[API] Request/response logging interceptor" \
  "## Overview
Log all API requests and responses for debugging and audit.

## Tasks
- [ ] Log: method, path, status, duration, merchantId (if auth)
- [ ] Exclude sensitive fields (password, apiKey, secret)
- [ ] Structured JSON logs for log aggregation
- [ ] Log level: INFO for 2xx, WARN for 4xx, ERROR for 5xx

## Acceptance Criteria
- All requests logged with duration
- Passwords never logged
- Log format parseable by ELK/Loki" \
  "module:api"

create_issue \
  "[API] Standardized pagination utility" \
  "## Overview
Consistent pagination across all list endpoints.

## Tasks
- [ ] \`PaginationDto\` with page, limit, defaults
- [ ] Max limit: 100 per page
- [ ] Response wrapper: \`{ data, total, page, limit, totalPages }\`
- [ ] \`PaginatedResponseDto\` generic wrapper

## Acceptance Criteria
- All list endpoints use PaginationDto
- totalPages calculated and returned
- Out-of-range page returns empty data array" \
  "module:api"

create_issue \
  "[API] Health check endpoint" \
  "## Overview
Expose a health check endpoint for load balancer and monitoring integration.

## Tasks
- [ ] \`GET /health\` — basic liveness check
- [ ] \`GET /health/ready\` — readiness (DB + Stellar + Redis connected)
- [ ] \`@nestjs/terminus\` for structured health checks
- [ ] Return 503 if any critical dependency down

## Acceptance Criteria
- Liveness always returns 200 if app running
- Readiness returns 503 if DB disconnected
- Response includes per-dependency status" \
  "module:api"

create_issue \
  "[API] Response transformation and serialization" \
  "## Overview
Standardize how entities are serialized to API responses.

## Tasks
- [ ] \`ClassSerializerInterceptor\` globally applied
- [ ] \`@Exclude()\` on sensitive entity fields (passwordHash, apiKeyHash)
- [ ] \`@Transform()\` for computed fields (masked account numbers)
- [ ] Consistent date format (ISO 8601)

## Acceptance Criteria
- Excluded fields never appear in any response
- Dates always in ISO 8601 format
- Circular references handled" \
  "module:api"

create_issue \
  "[API] API filtering utility" \
  "## Overview
Reusable filtering utility for list endpoints.

## Tasks
- [ ] \`FilterDto\` with common filter fields
- [ ] TypeORM query builder integration
- [ ] Support: eq, gte, lte, like, in operators
- [ ] Validate filter field names against allowed list

## Acceptance Criteria
- Filters work correctly for all supported operators
- Unknown filter fields rejected with 400
- Filters combine correctly with pagination" \
  "module:api"

create_issue \
  "[API] API key rate limiting per merchant" \
  "## Overview
Apply per-merchant rate limits when using API key authentication.

## Tasks
- [ ] 1,000 requests/hour per API key by default
- [ ] Higher limits for verified/enterprise merchants
- [ ] Rate limit headers: \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`
- [ ] Redis-based counter for API key rate tracking

## Acceptance Criteria
- Rate counter resets hourly
- Headers returned on every request
- 429 response when limit exceeded" \
  "module:api"

create_issue \
  "[API] Idempotency key support" \
  "## Overview
Support idempotency keys to prevent duplicate payment creation on retries.

## Tasks
- [ ] Accept \`Idempotency-Key\` header on POST requests
- [ ] Store request hash + response for 24 hours in Redis
- [ ] Return cached response for duplicate key
- [ ] Apply to: payment creation, settlement trigger

## Acceptance Criteria
- Same idempotency key returns identical response
- Different keys for same body treated as separate requests
- Cached responses served for 24 hours" \
  "module:api"

# ─────────────────────────────────────────────
# MODULE: TESTING (10 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Testing] Unit test setup and Jest configuration" \
  "## Overview
Configure Jest for unit testing across all backend modules.

## Tasks
- [ ] Jest configuration in \`package.json\`
- [ ] TypeScript support via \`ts-jest\`
- [ ] Module name mapping for path aliases
- [ ] Coverage thresholds: 80% lines, 75% branches
- [ ] Test watch mode for development

## Acceptance Criteria
- \`npm test\` runs all unit tests
- Coverage report generated
- CI fails if coverage below threshold" \
  "module:testing"

create_issue \
  "[Testing] Integration test setup with test database" \
  "## Overview
Set up integration test environment with a real PostgreSQL test database.

## Tasks
- [ ] Separate test DB via \`DB_NAME_TEST\` env var
- [ ] Test module bootstraps with real TypeORM connection
- [ ] Database reset between test suites
- [ ] Seed test data per suite

## Acceptance Criteria
- Integration tests use real DB, not mocks
- DB reset between suites (no test pollution)
- Integration tests in separate \`*.integration-spec.ts\` files" \
  "module:testing"

create_issue \
  "[Testing] E2E test suite configuration" \
  "## Overview
Set up end-to-end tests that test the full HTTP request/response cycle.

## Tasks
- [ ] \`@nestjs/testing\` + \`supertest\`
- [ ] Start full NestJS app for E2E tests
- [ ] Test happy paths for all core flows
- [ ] Run E2E in CI against test environment

## Acceptance Criteria
- E2E tests boot real NestJS app
- Full auth → payment → confirmation flow tested
- \`npm run test:e2e\` runs E2E suite" \
  "module:testing"

create_issue \
  "[Testing] Mock Stellar service for unit tests" \
  "## Overview
Provide a mock implementation of StellarService for unit testing.

## Tasks
- [ ] \`MockStellarService\` with all methods returning predictable values
- [ ] Configurable mock responses (success, failure, rate)
- [ ] Reusable across all test files
- [ ] Factory function for per-test customization

## Acceptance Criteria
- No real Horizon calls in unit tests
- Mock configurable per test case
- All StellarService methods mocked" \
  "module:testing"

create_issue \
  "[Testing] Payment flow integration test" \
  "## Overview
Integration test covering the complete payment lifecycle.

## Tasks
- [ ] Create merchant → login → create payment → simulate Stellar tx → confirm → settle
- [ ] Mock partner API in integration tests
- [ ] Verify webhooks dispatched
- [ ] Verify settlement record created

## Acceptance Criteria
- Full lifecycle tested in one test suite
- Partner API mocked with \`nock\`
- Webhook dispatch verified via spy" \
  "module:testing"

create_issue \
  "[Testing] Auth module E2E tests" \
  "## Overview
E2E tests for authentication flows.

## Tasks
- [ ] Test register → login → access protected route
- [ ] Test invalid credentials → 401
- [ ] Test rate limiting → 429
- [ ] Test JWT expiry → 401

## Acceptance Criteria
- All auth flows tested end-to-end
- Rate limit test uses short window for speed
- JWT expiry simulated by manipulating time" \
  "module:testing"

create_issue \
  "[Testing] Test coverage reporting in CI" \
  "## Overview
Generate and track test coverage in CI pipeline.

## Tasks
- [ ] Jest coverage output in lcov format
- [ ] Upload to Codecov or Coveralls
- [ ] GitHub PR comment with coverage diff
- [ ] Fail CI if coverage drops below threshold

## Acceptance Criteria
- Coverage report on every PR
- Coverage delta shown in PR comment
- CI fails on coverage regression > 2%" \
  "module:testing"

create_issue \
  "[Testing] Factory functions for test data" \
  "## Overview
Create factory functions to easily generate test fixtures.

## Tasks
- [ ] \`merchantFactory(overrides)\` — create test merchant
- [ ] \`paymentFactory(overrides)\` — create test payment
- [ ] \`settlementFactory(overrides)\` — create test settlement
- [ ] Integration with TypeORM for DB persistence

## Acceptance Criteria
- Factories support partial overrides
- Sensible defaults for all required fields
- Factories usable in both unit and integration tests" \
  "module:testing"

create_issue \
  "[Testing] Performance testing with k6" \
  "## Overview
Load test key endpoints to verify performance under stress.

## Tasks
- [ ] k6 scripts for: login, create payment, list payments
- [ ] Target: 100 concurrent users, 1,000 req/min
- [ ] Measure: p95 latency, error rate
- [ ] Run weekly in CI against staging

## Acceptance Criteria
- p95 latency < 500ms under 100 concurrent users
- Error rate < 0.1% under target load
- Performance regression alerts" \
  "module:testing"

create_issue \
  "[Testing] Contract tests for partner API integration" \
  "## Overview
Contract tests to verify the partner API integration stays in sync.

## Tasks
- [ ] Define partner API contract (Pact)
- [ ] Consumer-driven contract tests for settlement endpoint
- [ ] Run contract tests in CI
- [ ] Alert if partner changes API contract

## Acceptance Criteria
- Contract tests fail if partner API changes response schema
- Tests run without real partner API call
- Contract published to Pact Broker" \
  "module:testing"

# ─────────────────────────────────────────────
# MODULE: MONITORING (9 issues)
# ─────────────────────────────────────────────

create_issue \
  "[Monitoring] Prometheus metrics integration" \
  "## Overview
Export application metrics in Prometheus format for monitoring.

## Tasks
- [ ] Install \`@willsoto/nestjs-prometheus\`
- [ ] Custom metrics: payment_created_total, payment_settled_total, settlement_duration_seconds
- [ ] Default Node.js metrics (CPU, memory, event loop)
- [ ] Expose at \`/metrics\` (secured for internal access)

## Acceptance Criteria
- All custom metrics increment correctly
- /metrics returns valid Prometheus format
- Endpoint restricted to internal network" \
  "module:monitoring"

create_issue \
  "[Monitoring] Sentry error tracking integration" \
  "## Overview
Capture and track unhandled errors and exceptions with Sentry.

## Tasks
- [ ] Install \`@sentry/nestjs\`
- [ ] Configure DSN from \`SENTRY_DSN\` env var
- [ ] Capture all 5xx exceptions with context (merchantId, route)
- [ ] Set up Sentry alerts for error spikes

## Acceptance Criteria
- All unhandled exceptions appear in Sentry
- User context attached to errors
- Sentry performance traces enabled" \
  "module:monitoring"

create_issue \
  "[Monitoring] Application performance monitoring (APM)" \
  "## Overview
Track request latency and throughput across all endpoints.

## Tasks
- [ ] Track p50, p95, p99 latency per endpoint
- [ ] Track requests per second
- [ ] Slow request alert (> 1 second p95)
- [ ] Expose via Prometheus histograms

## Acceptance Criteria
- Latency histograms per route
- Slow request alerts configured
- Dashboard in Grafana shows latency trends" \
  "module:monitoring"

create_issue \
  "[Monitoring] Grafana dashboard templates" \
  "## Overview
Create Grafana dashboard templates for the platform.

## Tasks
- [ ] Dashboard: payment volume (time-series)
- [ ] Dashboard: settlement success rate
- [ ] Dashboard: API latency (p95 per endpoint)
- [ ] Dashboard: queue depths
- [ ] Export as JSON for version control

## Acceptance Criteria
- All dashboards load with sample data
- Dashboards importable via JSON
- Alerts configured on each dashboard" \
  "module:monitoring"

create_issue \
  "[Monitoring] Structured logging with correlation IDs" \
  "## Overview
Add request correlation IDs to all logs for distributed tracing.

## Tasks
- [ ] Generate UUID correlation ID per request
- [ ] Pass via \`X-Correlation-ID\` header (accept incoming, generate if missing)
- [ ] Include correlation ID in all log entries for that request
- [ ] Include in error responses

## Acceptance Criteria
- Every log line includes correlation ID
- Correlation ID returned in response header
- Client-supplied ID respected" \
  "module:monitoring"

create_issue \
  "[Monitoring] Uptime monitoring and alerting" \
  "## Overview
Monitor platform uptime and alert on downtime.

## Tasks
- [ ] External uptime monitor (UptimeRobot or Better Uptime)
- [ ] Monitor: API health endpoint, Stellar connection
- [ ] Alert via email/Slack on downtime
- [ ] Status page at \`status.cheesepay.xyz\`

## Acceptance Criteria
- Downtime detected within 2 minutes
- Alert sent to on-call within 5 minutes
- Status page shows real-time status" \
  "module:monitoring"

create_issue \
  "[Monitoring] Transaction tracing with OpenTelemetry" \
  "## Overview
Implement distributed tracing across services using OpenTelemetry.

## Tasks
- [ ] Install \`@opentelemetry/sdk-node\`
- [ ] Auto-instrument HTTP, PostgreSQL, Redis
- [ ] Export traces to Jaeger or Tempo
- [ ] Trace Stellar monitoring job execution

## Acceptance Criteria
- Full request trace from HTTP to DB visible
- Stellar job execution traced
- Slow spans identifiable in trace UI" \
  "module:monitoring"

create_issue \
  "[Monitoring] Log aggregation setup (ELK / Loki)" \
  "## Overview
Aggregate application logs into a centralized log management system.

## Tasks
- [ ] Configure structured JSON logs (Winston)
- [ ] Ship logs to Loki or Elasticsearch
- [ ] Grafana Loki dashboard for log exploration
- [ ] Alert on ERROR log spike

## Acceptance Criteria
- All log levels shipped to central store
- Logs searchable by correlation ID
- Error spike alert fires within 1 minute" \
  "module:monitoring"

create_issue \
  "[Monitoring] Alerting rules for critical metrics" \
  "## Overview
Define and configure alerts for critical platform metrics.

## Tasks
- [ ] Alert: settlement failure rate > 5%
- [ ] Alert: API error rate > 1%
- [ ] Alert: Stellar balance below reserve
- [ ] Alert: queue depth > 1,000
- [ ] Alert: no payments in 1 hour (platform idle)
- [ ] Route alerts to Slack and email

## Acceptance Criteria
- All alerts configured in Prometheus/Alertmanager
- Alert routing tested end-to-end
- Runbook linked in each alert" \
  "module:monitoring"

echo ""
echo "✅ All $COUNT issues created successfully!"
