#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

/// Lifecycle states for a registered merchant.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MerchantStatus {
    Approved,
    Suspended,
    Terminated,
}

/// On-chain merchant record stored in Persistent storage.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MerchantRecord {
    pub status: MerchantStatus,
    pub fee_bps: u32,
    pub kyc_verified: bool,
    pub created_at: u64,
}

/// Storage keys used by the registry.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Merchant(Address),
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contracttype]
struct MerchantRegisteredEvent {
    merchant: Address,
    fee_bps: u32,
    created_at: u64,
}

#[contracttype]
struct MerchantSuspendedEvent {
    merchant: Address,
}

#[contracttype]
struct MerchantReactivatedEvent {
    merchant: Address,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct MerchantRegistryContract;

#[contractimpl]
impl MerchantRegistryContract {
    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // ------------------------------------------------------------------
    // Admin – merchant lifecycle
    // ------------------------------------------------------------------

    /// Register a new merchant.  Callable by admin only.
    pub fn register_merchant(env: Env, caller: Address, merchant: Address, fee_bps: u32) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        if fee_bps > 10_000 {
            panic!("fee_bps must be <= 10000");
        }

        let key = DataKey::Merchant(merchant.clone());
        if env.storage().persistent().has(&key) {
            panic!("Merchant already registered");
        }

        let record = MerchantRecord {
            status: MerchantStatus::Approved,
            fee_bps,
            kyc_verified: true,
            created_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            ("REGISTRY", "merchant_registered"),
            MerchantRegisteredEvent {
                merchant: merchant.clone(),
                fee_bps,
                created_at: record.created_at,
            },
        );
    }

    /// Suspend a merchant.  Callable by admin only.
    /// After suspension, the Escrow contract will reject new deposits for
    /// this merchant.
    pub fn suspend_merchant(env: Env, caller: Address, merchant: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let key = DataKey::Merchant(merchant.clone());
        let mut record: MerchantRecord = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Merchant not found");

        if record.status == MerchantStatus::Suspended {
            panic!("Merchant already suspended");
        }
        if record.status == MerchantStatus::Terminated {
            panic!("Merchant is terminated");
        }

        record.status = MerchantStatus::Suspended;
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            ("REGISTRY", "merchant_suspended"),
            MerchantSuspendedEvent {
                merchant: merchant.clone(),
            },
        );
    }

    /// Reactivate a previously suspended merchant.  Callable by admin only.
    pub fn reactivate_merchant(env: Env, caller: Address, merchant: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let key = DataKey::Merchant(merchant.clone());
        let mut record: MerchantRecord = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Merchant not found");

        if record.status == MerchantStatus::Approved {
            panic!("Merchant already active");
        }
        if record.status == MerchantStatus::Terminated {
            panic!("Cannot reactivate terminated merchant");
        }

        record.status = MerchantStatus::Approved;
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            ("REGISTRY", "merchant_reactivated"),
            MerchantReactivatedEvent {
                merchant: merchant.clone(),
            },
        );
    }

    // ------------------------------------------------------------------
    // Queries
    // ------------------------------------------------------------------

    pub fn get_merchant(env: Env, merchant: Address) -> MerchantRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Merchant(merchant))
            .expect("Merchant not found")
    }

    /// Returns `true` when the merchant is registered, approved, and KYC-verified.
    pub fn is_approved(env: Env, merchant: Address) -> bool {
        let key = DataKey::Merchant(merchant);
        if !env.storage().persistent().has(&key) {
            return false;
        }
        let record: MerchantRecord = env.storage().persistent().get(&key).unwrap();
        record.status == MerchantStatus::Approved && record.kyc_verified
    }

    /// Compatibility alias used by existing contracts that gate merchant activity.
    pub fn is_merchant_active(env: Env, merchant: Address) -> bool {
        Self::is_approved(env, merchant)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != &admin {
            panic!("Not admin");
        }
    }
}
