#!/usr/bin/env bash
set -euo pipefail

REPO="songifi/dabdub"
DELAY=2
COUNT=0

# Ensure labels exist
for label in "soroban" "smart-contract" "stellar" "enhancement"; do
  gh label create "$label" --repo "$REPO" --color "#0075ca" 2>/dev/null || true
done

create_issue() {
  local title="$1"
  local body="$2"
  COUNT=$((COUNT + 1))
  echo "[$COUNT/50] Creating: $title"
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "soroban,smart-contract,stellar,enhancement" \
    --body "$body" 2>/dev/null || \
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body"
  sleep "$DELAY"
}

# ─── ESCROW CONTRACT (8) ──────────────────────────────────────────────────────

create_issue \
  "[Soroban] Payment escrow contract — hold funds until settlement confirmed" \
  "## Overview
Implement a Soroban smart contract that holds USDC in escrow after a customer payment and releases funds only after the NestJS backend confirms settlement.

## Tasks
- [ ] Define contract storage: payment_id, amount, merchant, customer, status, expiry
- [ ] Implement \`deposit()\` function callable by customer
- [ ] Implement \`release()\` function callable only by platform admin keypair
- [ ] Implement \`expire()\` callable after TTL elapsed
- [ ] Emit contract events on deposit, release, and expiry
- [ ] Write unit tests using soroban-sdk testutils

## Acceptance Criteria
- Funds are locked in contract after customer deposit
- Only authorised admin can trigger release
- Expired payments auto-refund to customer"

create_issue \
  "[Soroban] Escrow dispute resolution mechanism" \
  "## Overview
Add a dispute window to the escrow contract allowing merchants or customers to raise a dispute before funds are released.

## Tasks
- [ ] Add \`dispute()\` function with reason string
- [ ] Pause auto-release during open dispute
- [ ] Add admin \`resolve_dispute(winner)\` function
- [ ] Emit \`DisputeOpened\` and \`DisputeResolved\` events
- [ ] Set maximum dispute window (e.g., 72 hours)
- [ ] Unit tests for dispute lifecycle

## Acceptance Criteria
- Either party can raise a dispute within the dispute window
- Admin resolves and directs funds to correct party"

create_issue \
  "[Soroban] Time-locked escrow release with configurable TTL" \
  "## Overview
Allow the escrow contract TTL (time-to-live) to be set per payment at deposit time so merchants can offer custom expiry windows.

## Tasks
- [ ] Accept \`ttl_ledgers\` param in \`deposit()\`
- [ ] Store expiry as absolute ledger sequence number
- [ ] Enforce expiry in \`release()\` and \`refund()\`
- [ ] Add \`get_expiry(payment_id)\` view function
- [ ] Test with both short and long TTL values

## Acceptance Criteria
- Each escrow has an independently configurable TTL
- Expired escrows cannot be released; only refunded"

create_issue \
  "[Soroban] Escrow partial release for split payment support" \
  "## Overview
Extend the escrow contract to support releasing a portion of locked funds, enabling split-payment and partial settlement scenarios.

## Tasks
- [ ] Add \`release_partial(payment_id, amount)\` function
- [ ] Track released vs remaining balance per payment
- [ ] Prevent over-release beyond deposited amount
- [ ] Emit \`PartialRelease\` event with released amount
- [ ] Update \`get_balance(payment_id)\` to reflect remaining

## Acceptance Criteria
- Admin can release partial amounts multiple times
- Total released never exceeds deposited amount"

create_issue \
  "[Soroban] Emergency escrow drain to admin multisig" \
  "## Overview
Implement a contract-level emergency function to drain all locked escrow funds to the platform multisig wallet in case of a critical security incident.

## Tasks
- [ ] Restrict \`emergency_drain()\` to multisig threshold (2-of-3)
- [ ] Transfer all USDC balance to predefined treasury address
- [ ] Emit \`EmergencyDrain\` event with amount and caller
- [ ] Add a cooldown period to prevent repeated drains
- [ ] Document emergency runbook

## Acceptance Criteria
- Only multisig quorum can trigger emergency drain
- All funds moved atomically to treasury"

create_issue \
  "[Soroban] Escrow contract upgrade path via proxy pattern" \
  "## Overview
Design the escrow contract to be upgradeable via Soroban's built-in \`update_current_contract_wasm\` so bugs can be patched without redeploying and migrating state.

## Tasks
- [ ] Add \`upgrade(new_wasm_hash)\` admin function
- [ ] Restrict upgrade to multisig admin
- [ ] Add version storage key to contract
- [ ] Write migration test from v1 to v2 stub
- [ ] Document upgrade procedure

## Acceptance Criteria
- Contract WASM can be replaced without losing storage state
- Version field increments on each upgrade"

create_issue \
  "[Soroban] Escrow event emission for off-chain NestJS monitoring" \
  "## Overview
Ensure all escrow state transitions emit Soroban contract events that the NestJS StellarMonitorService can consume via the RPC \`getEvents\` endpoint.

## Tasks
- [ ] Define event topics: \`deposit\`, \`release\`, \`refund\`, \`expired\`, \`dispute\`
- [ ] Include payment_id and amount in every event
- [ ] Update NestJS StellarMonitorService to poll contract events
- [ ] Parse and map events to PaymentStatus updates
- [ ] Add integration test confirming event → DB state sync

## Acceptance Criteria
- Every escrow state change produces a queryable on-chain event
- NestJS processes events within one cron cycle (30s)"

create_issue \
  "[Soroban] Escrow contract deployment and initialization scripts" \
  "## Overview
Create reproducible scripts to deploy and initialise the escrow contract on both Stellar testnet and mainnet using the Soroban CLI.

## Tasks
- [ ] Write \`deploy.sh\` using \`stellar contract deploy\`
- [ ] Write \`init.sh\` calling \`contract invoke --fn init\`
- [ ] Parameterise network (testnet/mainnet) via env var
- [ ] Store deployed contract ID in \`.env.example\`
- [ ] Add deployment step to CI workflow
- [ ] Document rollback procedure

## Acceptance Criteria
- Single command deploys and initialises contract on target network
- Contract ID is captured and committed to config"

# ─── USDC / TOKEN HANDLING (6) ──────────────────────────────────────────────

create_issue \
  "[Soroban] USDC SEP-41 token interface integration" \
  "## Overview
Integrate the Circle USDC SEP-41 token contract interface so the escrow and payment contracts can invoke transfer, allowance, and balance functions.

## Tasks
- [ ] Import SEP-41 token client trait into contract
- [ ] Use \`token::Client::new(env, usdc_contract_id)\` for all transfers
- [ ] Store USDC contract address in contract admin storage
- [ ] Validate USDC contract on init
- [ ] Mock SEP-41 in unit tests

## Acceptance Criteria
- All fund movements use the official SEP-41 interface
- Contract is parameterised with USDC contract ID, not hardcoded"

create_issue \
  "[Soroban] Token allowance management for escrow deposits" \
  "## Overview
Require customers to approve a USDC allowance to the escrow contract before calling \`deposit()\`, following the SEP-41 approve → transferFrom pattern.

## Tasks
- [ ] Document customer flow: \`approve(escrow_contract, amount)\` → \`deposit()\`
- [ ] Use \`token::Client::transfer_from\` in deposit function
- [ ] Validate allowance ≥ amount before transfer
- [ ] Return clear error if allowance insufficient
- [ ] Update frontend payment flow to prompt approval first

## Acceptance Criteria
- Deposit reverts if allowance not set
- No direct custody of private keys required from customer"

create_issue \
  "[Soroban] Token balance verification before payment confirmation" \
  "## Overview
Add a pre-confirmation check in the NestJS StellarService that verifies the escrow contract holds the expected USDC balance before marking a payment as confirmed.

## Tasks
- [ ] Add \`get_balance(payment_id)\` view fn to escrow contract
- [ ] Call it from StellarService after detecting deposit event
- [ ] Reject confirmation if balance < expected amount
- [ ] Log discrepancies to Sentry
- [ ] Unit test balance mismatch handling

## Acceptance Criteria
- Payments are only confirmed when on-chain balance matches expected amount
- Short-paid deposits are flagged and not auto-settled"

create_issue \
  "[Soroban] Fee deduction in token contract before settlement release" \
  "## Overview
Implement platform fee deduction within the escrow contract's \`release()\` function, sending the fee portion to the treasury and net amount to the merchant.

## Tasks
- [ ] Store fee_bps (basis points) in contract admin storage
- [ ] Calculate fee = amount * fee_bps / 10_000
- [ ] Transfer fee to treasury address, net to merchant
- [ ] Emit \`FeeCollected\` event with fee amount
- [ ] Allow admin to update fee_bps via governance function
- [ ] Unit test fee calculation edge cases (0%, 100%, rounding)

## Acceptance Criteria
- Fee split happens atomically in a single contract invocation
- Fee basis points are configurable by admin without redeployment"

create_issue \
  "[Soroban] Token contract event hooks for NestJS monitoring" \
  "## Overview
Subscribe the NestJS Stellar monitor to SEP-41 USDC transfer events on the escrow contract address as a secondary confirmation signal alongside escrow events.

## Tasks
- [ ] Use Soroban RPC \`getEvents\` filtered by contract + topic \`transfer\`
- [ ] Correlate transfer events to pending payments by amount and destination
- [ ] Use as fallback if escrow events are missed
- [ ] Add de-duplication to avoid double-processing
- [ ] Integration test: verify monitor handles both event sources

## Acceptance Criteria
- USDC transfer events serve as an independent confirmation path
- No double-processing when both escrow and token events arrive"

create_issue \
  "[Soroban] Multi-asset support — XLM native + USDC in payment contract" \
  "## Overview
Extend the payment and escrow contracts to accept both native XLM and USDC, automatically routing to the correct token interface at runtime.

## Tasks
- [ ] Add \`asset_type\` enum (XLM, USDC) to deposit params
- [ ] Handle native XLM via \`env.current_contract_address()\` balance
- [ ] Handle USDC via SEP-41 \`transfer_from\`
- [ ] Store asset_type per payment in contract storage
- [ ] Update NestJS StellarService to pass asset_type when creating payments
- [ ] Unit test both asset paths

## Acceptance Criteria
- Single contract handles both XLM and USDC deposits
- Asset type is stored and enforced — can't release wrong asset"

# ─── MERCHANT REGISTRY CONTRACT (5) ─────────────────────────────────────────

create_issue \
  "[Soroban] Merchant registry contract — on-chain merchant state" \
  "## Overview
Create a Soroban contract that maintains an on-chain registry of approved merchants, their fee tiers, and status, serving as a decentralised source of truth alongside the PostgreSQL database.

## Tasks
- [ ] Define storage schema: merchant_id → {status, fee_bps, kyc_verified, created_at}
- [ ] Implement \`register_merchant(id, fee_bps)\` admin function
- [ ] Implement \`get_merchant(id)\` view function
- [ ] Implement \`is_approved(id)\` boolean view
- [ ] Emit \`MerchantRegistered\` event
- [ ] Write unit tests for all functions

## Acceptance Criteria
- Any Soroban contract or off-chain caller can verify merchant approval on-chain
- Admin is the only entity that can register merchants"

create_issue \
  "[Soroban] Merchant KYC status flag on-chain" \
  "## Overview
Add a KYC verified flag to the merchant registry contract, updated by the admin after off-chain KYC review, which the escrow contract checks before releasing funds.

## Tasks
- [ ] Add \`kyc_verified: bool\` field to merchant storage
- [ ] Implement \`set_kyc_status(merchant_id, verified)\` admin fn
- [ ] Escrow \`release()\` reads \`is_kyc_verified(merchant_id)\` and reverts if false
- [ ] Emit \`KYCStatusUpdated\` event
- [ ] Unit test release blocked for unverified merchant

## Acceptance Criteria
- Escrow cannot release funds to a merchant without KYC flag
- Admin can flip KYC status at any time"

create_issue \
  "[Soroban] Merchant fee tier storage in registry contract" \
  "## Overview
Store each merchant's fee tier (in basis points) in the registry contract so the fee deduction in the escrow contract is always read from on-chain state, not off-chain config.

## Tasks
- [ ] Add \`fee_bps\` to merchant storage (default 150 = 1.5%)
- [ ] Implement \`update_fee_tier(merchant_id, fee_bps)\` admin fn
- [ ] Escrow contract cross-contract calls registry to fetch fee_bps at release time
- [ ] Cap fee_bps at 1000 (10%) in contract validation
- [ ] Emit \`FeeTierUpdated\` event

## Acceptance Criteria
- Fee tier is always sourced from on-chain registry
- Changes take effect on the next \`release()\` call"

create_issue \
  "[Soroban] Merchant suspension and reactivation via admin" \
  "## Overview
Allow the platform admin to suspend a merchant in the registry contract, which immediately blocks new escrow deposits and pending releases for that merchant.

## Tasks
- [ ] Add \`status: MerchantStatus\` enum (Active, Suspended, Terminated)
- [ ] Implement \`suspend_merchant(id)\` and \`reactivate_merchant(id)\` admin fns
- [ ] Escrow \`deposit()\` checks merchant status and reverts if Suspended
- [ ] Emit \`MerchantSuspended\` / \`MerchantReactivated\` events
- [ ] Unit test deposit blocked for suspended merchant

## Acceptance Criteria
- Suspended merchants cannot receive new payments via contract
- Reactivation immediately re-enables deposit acceptance"

create_issue \
  "[Soroban] Merchant registry access control (admin-only writes)" \
  "## Overview
Implement strict access control in the merchant registry contract so only the designated admin address (or multisig) can mutate state.

## Tasks
- [ ] Store admin address in contract persistent storage on init
- [ ] Add \`require_admin(env)\` helper that checks \`env.invoker()\`
- [ ] Apply \`require_admin\` to all mutating functions
- [ ] Add \`transfer_admin(new_admin)\` for admin rotation
- [ ] Unit test unauthorised caller is rejected

## Acceptance Criteria
- All write operations revert for non-admin callers
- Admin can be safely transferred to a new address or multisig"

# ─── PAYMENT CONTRACT (9) ────────────────────────────────────────────────────

create_issue \
  "[Soroban] Payment request contract — on-chain payment state machine" \
  "## Overview
Implement a Soroban contract representing the full payment lifecycle state machine (Pending → Confirmed → Settling → Settled / Expired / Failed) mirroring the NestJS PaymentStatus enum.

## Tasks
- [ ] Define \`PaymentStatus\` enum in contract
- [ ] Store payment struct: id, merchant, amount, asset, status, created_at, expiry
- [ ] Implement \`create_payment()\`, \`confirm()\`, \`settle()\`, \`expire()\`, \`fail()\`
- [ ] Enforce valid transitions (e.g., can't settle from Pending)
- [ ] Emit status-change events for each transition
- [ ] Unit test all valid and invalid transitions

## Acceptance Criteria
- Contract enforces state machine — invalid transitions revert
- NestJS can mirror on-chain state to PostgreSQL via events"

create_issue \
  "[Soroban] Payment reference (memo) validation in contract" \
  "## Overview
Store the expected payment memo in the contract and validate that incoming deposits reference it correctly, preventing funds from being credited to the wrong payment.

## Tasks
- [ ] Store \`memo: Bytes\` per payment in contract storage
- [ ] Add \`validate_memo(payment_id, memo)\` view function
- [ ] NestJS calls \`validate_memo\` before confirming payment
- [ ] Return error code for memo mismatch
- [ ] Unit test mismatched and correct memo scenarios

## Acceptance Criteria
- Deposits with wrong memo cannot be confirmed
- NestJS double-checks memo via contract before DB update"

create_issue \
  "[Soroban] Payment expiry enforcement on-chain" \
  "## Overview
Enforce payment expiry in the contract by comparing current ledger sequence to stored expiry, so expired payments cannot be confirmed even if NestJS is delayed.

## Tasks
- [ ] Store \`expiry_ledger: u32\` per payment
- [ ] \`confirm()\` reverts if \`env.ledger().sequence() > expiry_ledger\`
- [ ] Add \`expire_payment(id)\` for NestJS cron to call
- [ ] Emit \`PaymentExpired\` event with refund instruction
- [ ] Unit test expiry boundary conditions

## Acceptance Criteria
- Expired payments cannot be confirmed regardless of NestJS state
- Expiry is deterministic based on ledger sequence, not wall clock"

create_issue \
  "[Soroban] Refund contract — initiate on-chain refund to customer" \
  "## Overview
Implement a \`refund()\` function in the payment/escrow contract that releases held USDC back to the customer's address, triggered by the NestJS backend after merchant approval.

## Tasks
- [ ] Add \`refund(payment_id, customer_address)\` admin function
- [ ] Validate payment is in \`Settled\` or \`Confirmed\` state
- [ ] Transfer USDC from escrow back to customer
- [ ] Update payment status to \`Refunded\`
- [ ] Emit \`PaymentRefunded\` event
- [ ] Unit and integration tests for refund flow

## Acceptance Criteria
- Only admin can trigger on-chain refund
- Funds reach customer in same transaction as status update"

create_issue \
  "[Soroban] Payment cancellation by merchant via contract call" \
  "## Overview
Allow merchants to cancel a pending (not yet confirmed) payment by invoking the contract, which releases the escrow back to the customer if already deposited.

## Tasks
- [ ] Add \`cancel_payment(payment_id)\` callable by merchant address
- [ ] Only allow cancellation in \`Pending\` state
- [ ] Refund customer if deposit already made
- [ ] Emit \`PaymentCancelled\` event
- [ ] NestJS listens to event and updates DB status
- [ ] Unit test cancellation before and after deposit

## Acceptance Criteria
- Merchants can cancel pending payments on-chain
- Any deposited funds are auto-refunded on cancellation"

create_issue \
  "[Soroban] Batch payment creation contract" \
  "## Overview
Add a batch endpoint to the payment contract allowing a merchant to create up to 20 payment requests in a single contract invocation to reduce transaction overhead.

## Tasks
- [ ] Implement \`create_batch(payments: Vec<PaymentInput>)\` function
- [ ] Validate each payment input (amount > 0, non-empty memo)
- [ ] Emit \`PaymentCreated\` event for each entry in batch
- [ ] Return Vec of created payment IDs
- [ ] Update NestJS batch payments API to use contract batch fn
- [ ] Unit test batch of 1, 10, and 20 payments

## Acceptance Criteria
- Up to 20 payments created atomically
- Entire batch reverts if any single input is invalid"

create_issue \
  "[Soroban] Payment contract integration with NestJS StellarService" \
  "## Overview
Wire the NestJS StellarService to invoke the Soroban payment contract for create, confirm, settle, and expire operations instead of relying solely on Horizon transaction monitoring.

## Tasks
- [ ] Add \`soroban_contract_id\` config env var
- [ ] Use Soroban RPC \`simulateTransaction\` before submitting
- [ ] Implement \`invokeContract(fn, args)\` helper in StellarService
- [ ] Replace direct Horizon calls with contract invocations where applicable
- [ ] Handle Soroban-specific error codes in exception filter
- [ ] Integration test full payment lifecycle via contract

## Acceptance Criteria
- NestJS drives all payment state via contract invocations
- Soroban RPC errors are caught and mapped to HTTP errors"

create_issue \
  "[Soroban] Payment amount validation and configurable limits in contract" \
  "## Overview
Enforce minimum and maximum payment amounts in the contract itself so invalid amounts cannot be created regardless of API validation.

## Tasks
- [ ] Store \`min_amount\` and \`max_amount\` in contract admin storage
- [ ] Validate amount in \`create_payment()\` — revert outside bounds
- [ ] Add \`set_limits(min, max)\` admin function
- [ ] Emit \`LimitsUpdated\` event on change
- [ ] Unit test boundary amounts (min-1, min, max, max+1)

## Acceptance Criteria
- Contract reverts payments outside configured limits
- Admin can update limits without contract redeployment"

create_issue \
  "[Soroban] Payment contract unit and integration tests with soroban-sdk testutils" \
  "## Overview
Write comprehensive tests for the payment Soroban contract using the soroban-sdk testutils environment to cover all state transitions and edge cases.

## Tasks
- [ ] Set up \`soroban_sdk::testutils::Env\` test harness
- [ ] Test full happy-path lifecycle: create → deposit → confirm → settle
- [ ] Test expiry, cancellation, and refund paths
- [ ] Test access control — non-admin calls rejected
- [ ] Test amount boundary conditions
- [ ] Generate code coverage report

## Acceptance Criteria
- ≥90% line coverage on contract code
- All state transitions covered by at least one test"

# ─── FEE & SETTLEMENT CONTRACTS (7) ─────────────────────────────────────────

create_issue \
  "[Soroban] Fee calculation contract — configurable platform fee in basis points" \
  "## Overview
Implement a standalone fee calculator Soroban contract that computes platform fees in basis points, callable by the escrow contract at settlement time.

## Tasks
- [ ] Store global \`default_fee_bps\` and per-merchant overrides
- [ ] Implement \`calculate_fee(merchant_id, amount) -> (fee, net)\`
- [ ] Handle integer overflow safely (i128 arithmetic)
- [ ] Add \`set_default_fee(bps)\` admin function
- [ ] Add \`set_merchant_fee(merchant_id, bps)\` admin function
- [ ] Unit test rounding, zero fee, and 100% fee edge cases

## Acceptance Criteria
- Fee calculation is deterministic and on-chain verifiable
- Merchant-specific fees take precedence over global default"

create_issue \
  "[Soroban] Fee distribution contract — split between platform and liquidity provider" \
  "## Overview
Create a contract that splits collected fees between the CheesePay treasury and a partner liquidity provider address according to a configurable ratio.

## Tasks
- [ ] Store \`treasury_address\`, \`lp_address\`, \`lp_share_bps\`
- [ ] Implement \`distribute(total_fee)\` — transfers to both addresses atomically
- [ ] Emit \`FeeDistributed\` event with amounts to each party
- [ ] Allow admin to update split ratio and addresses
- [ ] Unit test various split ratios including 0% and 100% LP

## Acceptance Criteria
- Fee split is atomic — partial transfers revert the whole call
- Split ratio is on-chain and auditable"

create_issue \
  "[Soroban] Settlement trigger contract — fire after N ledger confirmations" \
  "## Overview
Implement a contract function that the NestJS monitor calls after observing N Stellar ledger closes, which then transitions the payment to Settling and authorises the fiat payout.

## Tasks
- [ ] Store required \`confirmation_count\` in admin storage
- [ ] Implement \`confirm_payment(payment_id, ledger_seq)\`
- [ ] Track confirmation count per payment
- [ ] Transition to \`Settling\` when threshold reached
- [ ] Emit \`SettlementAuthorised\` event for NestJS to pick up
- [ ] Unit test confirmation threshold logic

## Acceptance Criteria
- Payment only reaches Settling after required confirmations
- NestJS triggers fiat payout on \`SettlementAuthorised\` event"

create_issue \
  "[Soroban] On-chain settlement record for immutable audit trail" \
  "## Overview
Write a settlement record to contract storage once a payment is settled, creating an immutable on-chain log that merchants and auditors can query independently of the PostgreSQL database.

## Tasks
- [ ] Define \`SettlementRecord\` struct: payment_id, amount, fee, net, timestamp, fiat_ref
- [ ] Store records in contract persistent storage keyed by payment_id
- [ ] Implement \`get_settlement(payment_id)\` view function
- [ ] Implement \`list_settlements(merchant_id, page)\` with pagination
- [ ] Emit \`SettlementRecorded\` event

## Acceptance Criteria
- Settlement records are permanently stored on-chain
- Any party can query settlement details without database access"

create_issue \
  "[Soroban] Fee treasury contract — accumulate and batch-withdraw platform fees" \
  "## Overview
Create a treasury contract that accumulates platform fee income and allows admin-controlled batch withdrawals to minimise transaction overhead.

## Tasks
- [ ] Accept USDC fee deposits from escrow contract
- [ ] Track total accumulated and per-period balances
- [ ] Implement \`withdraw(amount, destination)\` multisig-only function
- [ ] Emit \`TreasuryDeposit\` and \`TreasuryWithdrawal\` events
- [ ] Add \`get_balance()\` view function
- [ ] Unit test accumulation and withdrawal

## Acceptance Criteria
- Treasury accumulates fees over time from multiple payments
- Only multisig can withdraw — single admin cannot drain alone"

create_issue \
  "[Soroban] Dynamic fee adjustment based on payment volume tiers" \
  "## Overview
Add a volume-tiered fee model to the fee contract where merchants processing higher monthly volumes automatically receive lower fee rates.

## Tasks
- [ ] Define fee tiers: [{threshold_usdc, fee_bps}] stored in contract
- [ ] Track rolling 30-day volume per merchant in contract storage
- [ ] \`calculate_fee()\` applies the correct tier based on current volume
- [ ] Admin can update tier thresholds and rates
- [ ] Emit \`TierApplied\` event on each fee calculation
- [ ] Unit test tier boundary conditions

## Acceptance Criteria
- Fee rate decreases automatically as volume crosses tier thresholds
- Volume tracking is reset every 30 days (by ledger count)"

create_issue \
  "[Soroban] Settlement reconciliation contract — match on-chain vs off-chain records" \
  "## Overview
Implement a reconciliation contract that compares on-chain settlement records against a Merkle root submitted by the NestJS backend to detect discrepancies.

## Tasks
- [ ] Accept Merkle root of off-chain settlement batch from admin
- [ ] Store root with timestamp in contract
- [ ] Implement \`verify_settlement(payment_id, proof)\` view function
- [ ] Return mismatch flag if proof fails
- [ ] Emit \`ReconciliationSubmitted\` event
- [ ] Unit test valid and invalid Merkle proofs

## Acceptance Criteria
- Any settlement can be verified on-chain with a Merkle proof
- Mismatches are detectable without trusting the backend"

# ─── MULTI-SIG & SECURITY (6) ────────────────────────────────────────────────

create_issue \
  "[Soroban] Multi-sig admin contract for treasury and high-value operations" \
  "## Overview
Implement a 2-of-3 multisig contract that gates high-value operations (emergency drain, fee changes, merchant termination) requiring multiple admin signatures.

## Tasks
- [ ] Store 3 admin public keys in contract
- [ ] Implement \`propose(operation, args)\` callable by any admin
- [ ] Implement \`approve(proposal_id)\` callable by other admins
- [ ] Auto-execute proposal when threshold (2) reached
- [ ] Add proposal expiry (24 hours)
- [ ] Emit \`ProposalCreated\`, \`ProposalApproved\`, \`ProposalExecuted\` events
- [ ] Unit test threshold and expiry logic

## Acceptance Criteria
- No single admin can execute sensitive operations alone
- Proposals expire if not approved within 24 hours"

create_issue \
  "[Soroban] Time-lock contract for admin parameter changes" \
  "## Overview
Add a time-lock (24-hour delay) to sensitive parameter changes like fee updates and contract upgrades, giving users time to react before changes take effect.

## Tasks
- [ ] Queue changes with \`schedule_change(param, value, delay_ledgers)\`
- [ ] Execute with \`apply_change(change_id)\` after delay elapsed
- [ ] Cancel with \`cancel_change(change_id)\` before execution
- [ ] Emit \`ChangeScheduled\`, \`ChangeApplied\`, \`ChangeCancelled\` events
- [ ] Unit test early execution rejected, late execution succeeds

## Acceptance Criteria
- Parameter changes cannot take effect before delay period
- All scheduled changes are publicly visible on-chain"

create_issue \
  "[Soroban] Contract access control with role-based permissions" \
  "## Overview
Implement a role-based access control (RBAC) system in the contracts with roles: SuperAdmin, OperationsAdmin, ComplianceAdmin, and ReadOnly.

## Tasks
- [ ] Define Role enum and store role assignments per address
- [ ] Implement \`grant_role(address, role)\` and \`revoke_role()\` SuperAdmin-only
- [ ] Create \`require_role(env, role)\` guard function
- [ ] Apply role guards to all sensitive contract functions
- [ ] Emit \`RoleGranted\` / \`RoleRevoked\` events
- [ ] Unit test that each role can only call permitted functions

## Acceptance Criteria
- Each function enforces minimum required role
- SuperAdmin can delegate roles without giving up own access"

create_issue \
  "[Soroban] Contract pause/unpause mechanism for security incidents" \
  "## Overview
Add a global pause switch to all contracts allowing the admin to halt all state-changing operations instantly during a security incident.

## Tasks
- [ ] Store \`paused: bool\` in contract persistent storage
- [ ] Implement \`pause()\` and \`unpause()\` admin functions
- [ ] Add \`require_not_paused(env)\` guard at top of all mutable functions
- [ ] Allow view functions to remain callable while paused
- [ ] Emit \`ContractPaused\` / \`ContractUnpaused\` events

## Acceptance Criteria
- Single admin call halts all deposits, releases, and cancellations
- View functions remain accessible for read-only monitoring while paused"

create_issue \
  "[Soroban] Reentrancy guard pattern for escrow contract" \
  "## Overview
Implement a reentrancy guard in Soroban (using a mutex-style storage flag) to prevent cross-contract reentrant calls exploiting the escrow release flow.

## Tasks
- [ ] Add \`locked: bool\` temporary storage flag
- [ ] Set flag true at start of \`release()\`, \`refund()\`, \`deposit()\`
- [ ] Revert with \`ReentrantCall\` error if flag already true
- [ ] Clear flag at end of function
- [ ] Write exploit simulation test confirming guard blocks reentrant call

## Acceptance Criteria
- Reentrant calls are rejected at contract level
- Normal sequential calls are unaffected"

create_issue \
  "[Soroban] Contract key expiration and storage TTL management" \
  "## Overview
Configure appropriate Soroban storage TTL (time-to-live) for all contract data keys to prevent ledger bloat and manage archival costs.

## Tasks
- [ ] Classify storage by type: Persistent (merchant registry, settlements), Temporary (active payments), Instance (admin config)
- [ ] Set appropriate \`bump_ttl\` calls in each function
- [ ] Implement \`extend_payment_ttl(id)\` callable by admin for long-running payments
- [ ] Document TTL strategy per storage key type
- [ ] Test key expiry and restoration via \`restoreFootprint\`

## Acceptance Criteria
- No critical data expires unexpectedly during normal operation
- Long-running payments can have TTL extended by admin"

# ─── DEX / LIQUIDITY (4) ────────────────────────────────────────────────────

create_issue \
  "[Soroban] Soroban AMM integration for XLM-to-USDC swap on settlement" \
  "## Overview
Integrate with a Stellar DEX / Soroban AMM contract to atomically swap XLM received from customers into USDC before releasing to the merchant's settlement account.

## Tasks
- [ ] Identify target AMM contract (e.g., Soroswap or Phoenix DEX)
- [ ] Implement \`swap_xlm_to_usdc(amount, min_out)\` using cross-contract call
- [ ] Apply slippage tolerance (default 1%)
- [ ] Revert if \`min_out\` not met
- [ ] Emit \`SwapExecuted\` event with in/out amounts
- [ ] Integration test on testnet with real AMM

## Acceptance Criteria
- XLM-to-USDC swap happens atomically with escrow release
- Slippage protection prevents bad-rate swaps"

create_issue \
  "[Soroban] Path payment contract for best-rate routing across Stellar DEX" \
  "## Overview
Use Stellar's native path payment operation wrapped in a Soroban contract to find the best rate when converting received assets to the settlement currency.

## Tasks
- [ ] Implement \`path_pay(send_asset, dest_asset, amount, send_max)\`
- [ ] Use Horizon path-finding API to pre-compute path off-chain
- [ ] Pass path as argument to contract for on-chain execution
- [ ] Fall back to direct offer if no path found
- [ ] Emit \`PathPaymentExecuted\` event with effective rate
- [ ] Unit test with mock path and real testnet integration test

## Acceptance Criteria
- Best available DEX rate is used for all conversions
- Contract fails gracefully if no viable path exists"

create_issue \
  "[Soroban] Slippage protection contract for on-chain swaps" \
  "## Overview
Implement a standalone slippage protection module used by the AMM integration and path payment contracts to reject swaps where the rate deviates beyond an acceptable threshold.

## Tasks
- [ ] Store \`max_slippage_bps\` in admin storage (default 100 = 1%)
- [ ] Implement \`check_slippage(expected, actual)\` — revert if exceeded
- [ ] Expose \`set_max_slippage(bps)\` admin function
- [ ] Emit \`SlippageExceeded\` event with expected vs actual
- [ ] Unit test at exactly the boundary and one bps over

## Acceptance Criteria
- Swaps with slippage above threshold always revert
- Admin can tighten or relax slippage tolerance on-chain"

create_issue \
  "[Soroban] Liquidity pool health check and fallback routing contract" \
  "## Overview
Add a pre-swap liquidity check that verifies the AMM pool has sufficient depth before routing a swap through it, falling back to Stellar classic DEX offers if depth is insufficient.

## Tasks
- [ ] Query AMM pool reserves via cross-contract call
- [ ] Compare required swap size against pool depth (e.g., <10% of reserves)
- [ ] Route to classic DEX if pool depth insufficient
- [ ] Emit \`FallbackRouteUsed\` event when DEX fallback triggered
- [ ] Unit test routing decision with shallow and deep pool mock

## Acceptance Criteria
- Large swaps that would cause excessive price impact use fallback routing
- Routing decision is deterministic and auditable via events"

# ─── INFRASTRUCTURE & TOOLING (5) ───────────────────────────────────────────

create_issue \
  "[Soroban] Soroban RPC configuration and NestJS integration module" \
  "## Overview
Create a dedicated NestJS SorobanModule that initialises the Soroban RPC client, handles transaction simulation, signing, and submission, and exposes a clean service API to other modules.

## Tasks
- [ ] Install \`@stellar/stellar-sdk\` Soroban RPC client
- [ ] Create \`SorobanService\` with \`simulateTx()\`, \`submitTx()\`, \`invokeContract()\`
- [ ] Configure RPC URL via \`SOROBAN_RPC_URL\` env var
- [ ] Add retry logic with exponential backoff for RPC failures
- [ ] Handle \`simulateTransaction\` error decoding (XDR → human-readable)
- [ ] Module unit tests with mocked RPC client

## Acceptance Criteria
- All Soroban interactions go through SorobanService
- RPC errors are translated to NestJS HttpExceptions"

create_issue \
  "[Soroban] Contract deployment pipeline — testnet to mainnet promotion" \
  "## Overview
Set up a CI/CD pipeline step that deploys Soroban contracts to testnet on every PR merge and promotes to mainnet on release tags.

## Tasks
- [ ] Add \`contracts/\` directory with Rust workspace
- [ ] Configure \`Cargo.toml\` with soroban-sdk dependency
- [ ] Write GitHub Actions job: build WASM, deploy to testnet, record contract ID
- [ ] Add mainnet deploy job triggered by \`v*\` tags with manual approval gate
- [ ] Store contract IDs as GitHub Actions outputs and in repo secrets
- [ ] Document rollback procedure (redeploy previous WASM hash)

## Acceptance Criteria
- PRs automatically deploy to testnet and output contract ID
- Mainnet deployments require manual approval"

create_issue \
  "[Soroban] Contract WASM build optimisation and size reduction" \
  "## Overview
Optimise the compiled Soroban WASM binaries to minimise ledger upload costs and meet the Soroban WASM size limits.

## Tasks
- [ ] Add \`opt-level = \"z\"\` and \`lto = true\` to Cargo.toml release profile
- [ ] Run \`wasm-opt -Oz\` post-build via Makefile target
- [ ] Track WASM size in CI and fail if > 64 KB limit
- [ ] Profile contract with \`soroban contract inspect\` for unused exports
- [ ] Document build process in \`contracts/README.md\`

## Acceptance Criteria
- All contract WASMs pass Soroban size validation on upload
- CI fails if WASM size regresses above threshold"

create_issue \
  "[Soroban] Soroban contract event indexer service for NestJS" \
  "## Overview
Build a NestJS service that continuously polls the Soroban RPC \`getEvents\` endpoint, parses contract events into typed DTOs, and dispatches them to the appropriate domain handlers.

## Tasks
- [ ] Implement \`SorobanEventIndexer\` as a \`@nestjs/schedule\` cron (every 5s)
- [ ] Store last processed ledger cursor in Redis
- [ ] Define typed event DTOs for each contract event topic
- [ ] Dispatch to \`PaymentsService\`, \`SettlementsService\` via EventEmitter2
- [ ] Add dead-letter queue for unprocessable events
- [ ] Integration test: emit contract event → verify DB state update

## Acceptance Criteria
- All contract events are processed within one polling cycle
- Cursor ensures no events are skipped or double-processed"

create_issue \
  "[Soroban] Soroban contract local development environment setup" \
  "## Overview
Provide a reproducible local development environment for Soroban contracts using the Stellar Quickstart Docker image and the Soroban CLI so developers can test contracts without hitting testnet.

## Tasks
- [ ] Add \`docker-compose.dev.yml\` with \`stellar/quickstart:soroban-dev\`
- [ ] Write \`Makefile\` targets: \`make build\`, \`make test\`, \`make deploy-local\`
- [ ] Document local setup in \`contracts/README.md\`
- [ ] Add \`SOROBAN_RPC_URL=http://localhost:8000/soroban/rpc\` to \`.env.example\`
- [ ] Verify all contracts deploy and pass tests locally

## Acceptance Criteria
- \`make deploy-local\` deploys all contracts to local node in under 60 seconds
- All contract tests pass locally without external network access"

echo "✅ All $COUNT Soroban issues created!"
