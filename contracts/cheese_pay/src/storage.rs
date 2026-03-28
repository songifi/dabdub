#![allow(dead_code)]

use soroban_sdk::{contracttype, Address, Env, String};

use crate::Error;

// Instance storage: contract-wide singletons that live as long as the contract.
// Persistent storage: per-user / per-resource data that must survive ledger archival.
// Temporary storage: not used here; suited for short-lived nonces / rate-limit counters.

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // --- Instance keys ---
    Admin,
    UsdcToken,
    FeeRateBps,
    FeeTreasury,
    Paused,

    // --- Persistent keys ---
    /// USDC balance for a username.
    Balance(String),
    /// Staking balance for a username.
    StakeBalance(String),
    /// Maps a username → Address.
    UsernameToAddr(String),
    /// Maps an Address → username.
    AddrToUsername(Address),
    /// PayLink data keyed by token slug.
    PayLink(String),
}

/// Read an instance-storage value; returns `Err(Error::NotInitialized)` if absent.
pub fn get_instance<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
) -> Result<V, Error> {
    env.storage()
        .instance()
        .get(key)
        .ok_or(Error::NotInitialized)
}

/// Read a persistent-storage value; returns `None` if absent.
pub fn get_persistent<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
) -> Option<V> {
    env.storage().persistent().get(key)
}

/// Write a persistent-storage value and bump its TTL.
pub fn set_persistent<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
    val: &V,
) {
    const LEDGERS_TO_LIVE: u32 = 535_000; // ~1 year
    env.storage().persistent().set(key, val);
    env.storage()
        .persistent()
        .extend_ttl(key, LEDGERS_TO_LIVE, LEDGERS_TO_LIVE);
}
