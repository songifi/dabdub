# Payment Escrow Emergency Drain Runbook

## Purpose

Use `emergency_drain` only during a confirmed critical security incident that risks escrowed USDC.

## Preconditions

- Incident commander has declared emergency mode.
- At least 2 authorized emergency signers (from the configured 3) are available.
- The treasury address is verified as the platform multisig wallet.
- Cooldown window from the previous emergency drain has elapsed.

## Execution Steps

1. Confirm current escrow contract USDC balance is non-zero.
2. Prepare a transaction calling:
   - `emergency_drain(caller, signer_one, signer_two)`
3. Ensure both `signer_one` and `signer_two` provide signatures.
4. Submit and confirm transaction success.

## Expected Contract Behavior

- Contract enforces:
  - signer_one and signer_two are distinct
  - both are members of the configured emergency signer set
  - cooldown is not active
- Entire USDC balance held by the escrow contract is transferred atomically to treasury.
- `EmergencyDrain` event (`ESCROW`, `emergency_drain`) is emitted with:
  - `amount`
  - `caller`

## Post-Execution Checks

- Escrow contract USDC balance is `0`.
- Treasury USDC balance increased by the drained amount.
- Event stream contains the emergency drain event for audit trail.

## Cooldown and Repeat Protection

- A successful drain records the ledger sequence.
- Any subsequent drain attempts before `emergency_cooldown_ledgers` elapses must fail.

