#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const BPS_DENOM: i128 = 10_000;

#[contracttype]
enum DataKey {
    Admin,
    DefaultFeeBps,
    MerchantFee(Address),
}

#[contract]
pub struct FeeCalculatorContract;

#[contractimpl]
impl FeeCalculatorContract {
    pub fn __constructor(env: Env, admin: Address, default_fee_bps: i128) {
        assert!(default_fee_bps >= 0 && default_fee_bps <= BPS_DENOM, "bps out of range");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::DefaultFeeBps, &default_fee_bps);
    }

    /// Set the global default fee in basis points. Admin-only.
    pub fn set_default_fee(env: Env, caller: Address, bps: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        assert!(bps >= 0 && bps <= BPS_DENOM, "bps out of range");
        env.storage().instance().set(&DataKey::DefaultFeeBps, &bps);
    }

    /// Set a per-merchant fee override in basis points. Admin-only.
    pub fn set_merchant_fee(env: Env, caller: Address, merchant_id: Address, bps: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        assert!(bps >= 0 && bps <= BPS_DENOM, "bps out of range");
        env.storage().persistent().set(&DataKey::MerchantFee(merchant_id), &bps);
    }

    /// Returns (fee, net) for a given merchant and amount.
    /// Merchant-specific fee takes precedence over the global default.
    pub fn calculate_fee(env: Env, merchant_id: Address, amount: i128) -> (i128, i128) {
        assert!(amount >= 0, "amount must be non-negative");

        let bps: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::MerchantFee(merchant_id))
            .unwrap_or_else(|| {
                env.storage()
                    .instance()
                    .get(&DataKey::DefaultFeeBps)
                    .unwrap()
            });

        // fee = amount * bps / 10_000  (i128 — no overflow for realistic values)
        let fee = amount.checked_mul(bps).expect("overflow").checked_div(BPS_DENOM).expect("div zero");
        let net = amount.checked_sub(fee).expect("underflow");
        (fee, net)
    }

    pub fn get_default_fee(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::DefaultFeeBps).unwrap()
    }

    pub fn get_merchant_fee(env: Env, merchant_id: Address) -> Option<i128> {
        env.storage().persistent().get(&DataKey::MerchantFee(merchant_id))
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(caller == &admin, "not admin");
    }
}
