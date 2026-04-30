#![no_std]

mod test;

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String,
};

/// Lifecycle states for a registered merchant.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MerchantStatus {
    Active,
    Suspended,
    Terminated,
}

/// On-chain merchant record stored in Persistent storage.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MerchantRecord {
    pub merchant: Address,
    pub name: String,
    pub status: MerchantStatus,
    pub kyc_verified: bool,
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
    name: String,
}

#[contracttype]
struct MerchantSuspendedEvent {
    merchant: Address,
}

#[contracttype]
struct MerchantReactivatedEvent {
    merchant: Address,
}

#[contracttype]
struct KYCStatusUpdatedEvent {
    merchant: Address,
    verified: bool,
}

#[contracttype]
struct AdminTransferredEvent {
    old_admin: Address,
    new_admin: Address,
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
    pub fn register_merchant(env: Env, caller: Address, merchant: Address, name: String) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let key = DataKey::Merchant(merchant.clone());
        if env.storage().persistent().has(&key) {
            panic!("Merchant already registered");
        }

        let record = MerchantRecord {
            merchant: merchant.clone(),
            name: name.clone(),
            status: MerchantStatus::Active,
            kyc_verified: false,
        };
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            ("REGISTRY", "merchant_registered"),
            MerchantRegisteredEvent { merchant: merchant.clone(), name: name.clone() },
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
            MerchantSuspendedEvent { merchant: merchant.clone() },
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

        if record.status == MerchantStatus::Active {
            panic!("Merchant already active");
        }
        if record.status == MerchantStatus::Terminated {
            panic!("Cannot reactivate terminated merchant");
        }

        record.status = MerchantStatus::Active;
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            ("REGISTRY", "merchant_reactivated"),
            MerchantReactivatedEvent { merchant: merchant.clone() },
        );
    }

    /// Set the KYC verification status for a merchant.  Admin-only.
    pub fn set_kyc_status(env: Env, caller: Address, merchant: Address, verified: bool) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let key = DataKey::Merchant(merchant.clone());
        let mut record: MerchantRecord = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Merchant not found");

        record.kyc_verified = verified;
        env.storage().persistent().set(&key, &record);

        env.events().publish(
            ("REGISTRY", "kyc_status_updated"),
            KYCStatusUpdatedEvent { merchant: merchant.clone(), verified },
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

    /// Returns `true` when the merchant is registered and Active.
    pub fn is_merchant_active(env: Env, merchant: Address) -> bool {
        let key = DataKey::Merchant(merchant);
        if !env.storage().persistent().has(&key) {
            return false;
        }
        let record: MerchantRecord = env.storage().persistent().get(&key).unwrap();
        record.status == MerchantStatus::Active
    }

    /// Returns `true` when the merchant is KYC verified.
    /// Returns `false` for unregistered merchants.
    pub fn is_kyc_verified(env: Env, merchant: Address) -> bool {
        let key = DataKey::Merchant(merchant);
        if !env.storage().persistent().has(&key) {
            return false;
        }
        let record: MerchantRecord = env.storage().persistent().get(&key).unwrap();
        record.kyc_verified
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ------------------------------------------------------------------
    // Admin management
    // ------------------------------------------------------------------

    /// Transfer admin to a new address.  Callable by current admin only.
    pub fn transfer_admin(env: Env, caller: Address, new_admin: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let old_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        env.storage().instance().set(&DataKey::Admin, &new_admin);

        env.events().publish(
            ("REGISTRY", "admin_transferred"),
            AdminTransferredEvent { old_admin, new_admin },
        );
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
