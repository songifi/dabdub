#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, BytesN, Env, Address};

// ── storage keys ────────────────────────────────────────────────────────────

#[contracttype]
enum DataKey {
    Admin,
    ConfirmationCount,          // required ledger-close count (u32)
    PaymentConfs(BytesN<32>),   // confirmed count so far for a payment (u32)
    PaymentFirstLedger(BytesN<32>), // ledger_seq of the first confirmation
    PaymentSettling(BytesN<32>),    // bool — already transitioned
}

// ── events ───────────────────────────────────────────────────────────────────

#[contracttype]
struct ConfirmationRecordedEvent {
    payment_id: BytesN<32>,
    ledger_seq: u32,
    confirmations: u32,
    required: u32,
}

#[contracttype]
struct SettlementAuthorisedEvent {
    payment_id: BytesN<32>,
    ledger_seq: u32,   // ledger that pushed count over threshold
    amount: i128,      // informational — set by caller
    merchant: Address, // informational — set by caller
}

// ── contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct StellarConfirmationsContract;

#[contractimpl]
impl StellarConfirmationsContract {
    pub fn __constructor(env: Env, admin: Address, confirmation_count: u32) {
        assert!(confirmation_count > 0, "confirmation_count must be > 0");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ConfirmationCount, &confirmation_count);
    }

    /// Called by the NestJS monitor once per observed Stellar ledger close.
    /// `ledger_seq` is the sequence number of the closed ledger.
    /// `amount` and `merchant` are forwarded into the SettlementAuthorised event
    /// so NestJS can trigger the fiat payout without a second lookup.
    ///
    /// Returns the current confirmation count after this call.
    pub fn confirm_payment(
        env: Env,
        caller: Address,
        payment_id: BytesN<32>,
        ledger_seq: u32,
        amount: i128,
        merchant: Address,
    ) -> u32 {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        // Guard: already settling — idempotent no-op after threshold
        let settling_key = DataKey::PaymentSettling(payment_id.clone());
        if env.storage().persistent().get::<_, bool>(&settling_key).unwrap_or(false) {
            panic!("payment already settling");
        }

        // Increment confirmation counter
        let confs_key = DataKey::PaymentConfs(payment_id.clone());
        let confs: u32 = env.storage().persistent().get(&confs_key).unwrap_or(0);
        let new_confs = confs.checked_add(1).expect("overflow");
        env.storage().persistent().set(&confs_key, &new_confs);

        // Record first-seen ledger for auditability
        let first_key = DataKey::PaymentFirstLedger(payment_id.clone());
        if !env.storage().persistent().has(&first_key) {
            env.storage().persistent().set(&first_key, &ledger_seq);
        }

        let required: u32 = env.storage().instance().get(&DataKey::ConfirmationCount).unwrap();

        env.events().publish(
            ("STELLAR_CONFS", "confirmation_recorded"),
            ConfirmationRecordedEvent {
                payment_id: payment_id.clone(),
                ledger_seq,
                confirmations: new_confs,
                required,
            },
        );

        // Transition to Settling when threshold is reached
        if new_confs >= required {
            env.storage().persistent().set(&settling_key, &true);

            env.events().publish(
                ("STELLAR_CONFS", "settlement_authorised"),
                SettlementAuthorisedEvent {
                    payment_id,
                    ledger_seq,
                    amount,
                    merchant,
                },
            );
        }

        new_confs
    }

    /// Admin: update the required confirmation count.
    pub fn set_confirmation_count(env: Env, caller: Address, count: u32) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        assert!(count > 0, "confirmation_count must be > 0");
        env.storage().instance().set(&DataKey::ConfirmationCount, &count);
    }

    pub fn get_confirmation_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::ConfirmationCount).unwrap()
    }

    pub fn get_payment_confirmations(env: Env, payment_id: BytesN<32>) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PaymentConfs(payment_id))
            .unwrap_or(0)
    }

    pub fn is_settling(env: Env, payment_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::PaymentSettling(payment_id))
            .unwrap_or(false)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(caller == &admin, "not admin");
    }
}
