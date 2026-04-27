#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, BytesN, Env, String, Vec};

const MAX_BATCH_SIZE: u32 = 20;

/// A single payment input in the batch.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentInput {
    /// Amount in stroops (must be > 0).
    pub amount: i128,
    /// Non-empty human-readable memo for the payment.
    pub memo: String,
    /// Optional customer Stellar address.
    pub customer: Option<Address>,
}

/// The result record for each created payment.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentRecord {
    /// Unique payment ID (32-byte hash derived from ledger sequence + index).
    pub id: BytesN<32>,
    pub amount: i128,
    pub memo: String,
    pub merchant: Address,
}

#[contract]
pub struct BatchPaymentContract;

#[contractimpl]
impl BatchPaymentContract {
    /// Create up to 20 payments atomically in a single contract invocation.
    ///
    /// Validates every input before any state is written — if any item is
    /// invalid the entire batch reverts. Emits a `PaymentCreated` event for
    /// each created payment, matching the NestJS service event log.
    ///
    /// Returns a `Vec<BytesN<32>>` of the created payment IDs.
    pub fn create_batch(
        env: Env,
        merchant: Address,
        payments: Vec<PaymentInput>,
    ) -> Vec<BytesN<32>> {
        merchant.require_auth();

        let count = payments.len();
        if count == 0 {
            panic!("batch must contain at least one payment");
        }
        if count > MAX_BATCH_SIZE {
            panic!("batch exceeds maximum of 20 payments");
        }

        // ── Validation pass (all items checked before any state write) ────────
        for i in 0..count {
            let item = payments.get(i).unwrap();
            if item.amount <= 0 {
                panic!("payment at index {}: amount must be > 0");
            }
            if item.memo.len() == 0 {
                panic!("payment at index {}: memo must not be empty");
            }
        }

        // ── Creation pass ─────────────────────────────────────────────────────
        let mut payment_ids: Vec<BytesN<32>> = vec![&env];

        for i in 0..count {
            let item = payments.get(i).unwrap();

            // Derive a deterministic payment ID from ledger sequence + batch index.
            // In production this would be a proper UUID or hash of inputs.
            let seed: u64 = (env.ledger().sequence() as u64) * 1000 + i as u64;
            let id_bytes: BytesN<32> = env.crypto().sha256(
                &soroban_sdk::Bytes::from_slice(&env, &seed.to_be_bytes()),
            );

            // Emit PaymentCreated event — one per batch entry.
            env.events().publish(
                (soroban_sdk::Symbol::new(&env, "PaymentCreated"),),
                (id_bytes.clone(), merchant.clone(), item.amount, item.memo.clone()),
            );

            payment_ids.push_back(id_bytes);
        }

        payment_ids
    }

    /// Returns the maximum allowed batch size.
    pub fn max_batch_size(_env: Env) -> u32 {
        MAX_BATCH_SIZE
    }
}
