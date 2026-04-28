#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, BytesN, Env, String, Vec};

const PAGE_SIZE: u32 = 20;

// ── types ────────────────────────────────────────────────────────────────────

/// Immutable on-chain settlement record.
#[contracttype]
#[derive(Clone, Debug)]
pub struct SettlementRecord {
    pub payment_id: BytesN<32>,
    pub merchant: Address,
    pub amount: i128,   // gross amount paid
    pub fee: i128,      // platform fee deducted
    pub net: i128,      // amount remitted to merchant (amount - fee)
    pub timestamp: u64, // Unix timestamp supplied by the caller (NestJS)
    pub fiat_ref: String, // bank / fiat-rail reference ID
}

#[contracttype]
enum DataKey {
    Admin,
    /// SettlementRecord keyed by payment_id
    Settlement(BytesN<32>),
    /// Vec<BytesN<32>> — ordered list of payment_ids per merchant
    MerchantIndex(Address),
}

// ── events ───────────────────────────────────────────────────────────────────

#[contracttype]
struct SettlementRecordedEvent {
    payment_id: BytesN<32>,
    merchant: Address,
    amount: i128,
    fee: i128,
    net: i128,
    fiat_ref: String,
}

// ── contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct SettlementLedgerContract;

#[contractimpl]
impl SettlementLedgerContract {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Write an immutable settlement record. Admin-only (called by NestJS backend).
    /// Panics if a record for `payment_id` already exists — records are append-only.
    pub fn record_settlement(
        env: Env,
        caller: Address,
        payment_id: BytesN<32>,
        merchant: Address,
        amount: i128,
        fee: i128,
        net: i128,
        timestamp: u64,
        fiat_ref: String,
    ) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        assert!(amount > 0, "amount must be > 0");
        assert!(fee >= 0, "fee must be >= 0");
        assert!(net >= 0, "net must be >= 0");
        assert!(fee + net == amount, "fee + net must equal amount");

        let key = DataKey::Settlement(payment_id.clone());
        assert!(!env.storage().persistent().has(&key), "settlement already recorded");

        let record = SettlementRecord {
            payment_id: payment_id.clone(),
            merchant: merchant.clone(),
            amount,
            fee,
            net,
            timestamp,
            fiat_ref: fiat_ref.clone(),
        };

        env.storage().persistent().set(&key, &record);

        // Append payment_id to the merchant's index list
        let idx_key = DataKey::MerchantIndex(merchant.clone());
        let mut index: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&idx_key)
            .unwrap_or_else(|| vec![&env]);
        index.push_back(payment_id.clone());
        env.storage().persistent().set(&idx_key, &index);

        env.events().publish(
            ("SETTLEMENT_LEDGER", "settlement_recorded"),
            SettlementRecordedEvent {
                payment_id,
                merchant,
                amount,
                fee,
                net,
                fiat_ref,
            },
        );
    }

    /// Fetch a single settlement record by payment_id. Callable by anyone.
    pub fn get_settlement(env: Env, payment_id: BytesN<32>) -> SettlementRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Settlement(payment_id))
            .expect("settlement not found")
    }

    /// Paginated list of settlement records for a merchant.
    /// `page` is 0-indexed; returns up to PAGE_SIZE (20) records per page.
    pub fn list_settlements(env: Env, merchant: Address, page: u32) -> Vec<SettlementRecord> {
        let idx_key = DataKey::MerchantIndex(merchant);
        let index: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&idx_key)
            .unwrap_or_else(|| vec![&env]);

        let total = index.len();
        let start = page.saturating_mul(PAGE_SIZE);
        if start >= total {
            return vec![&env];
        }

        let end = (start + PAGE_SIZE).min(total);
        let mut results: Vec<SettlementRecord> = vec![&env];
        for i in start..end {
            let pid = index.get(i).unwrap();
            let record: SettlementRecord = env
                .storage()
                .persistent()
                .get(&DataKey::Settlement(pid))
                .unwrap();
            results.push_back(record);
        }
        results
    }

    /// Total number of settlements recorded for a merchant.
    pub fn settlement_count(env: Env, merchant: Address) -> u32 {
        let idx_key = DataKey::MerchantIndex(merchant);
        env.storage()
            .persistent()
            .get::<_, Vec<BytesN<32>>>(&idx_key)
            .map(|v| v.len())
            .unwrap_or(0)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(caller == &admin, "not admin");
    }
}
