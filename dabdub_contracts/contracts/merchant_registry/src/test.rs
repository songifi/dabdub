#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address, Env,
};

const DEFAULT_FEE_BPS: u32 = 250;
const CREATED_AT: u64 = 1_717_171_717;

fn setup() -> (Env, MerchantRegistryContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(CREATED_AT);

    let admin = Address::generate(&env);
    let contract_id = env.register(MerchantRegistryContract, (&admin,));
    let client = MerchantRegistryContractClient::new(&env, &contract_id);

    (env, client, admin)
}

#[test]
fn test_register_merchant_happy_path() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);

    let record = client.get_merchant(&merchant);
    assert_eq!(record.status, MerchantStatus::Approved);
    assert_eq!(record.fee_bps, DEFAULT_FEE_BPS);
    assert!(record.kyc_verified);
    assert_eq!(record.created_at, CREATED_AT);
}

#[test]
fn test_register_merchant_emits_event() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    assert_eq!(env.events().all().len(), 0);
    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);

    let events = env.events().all();
    assert_eq!(events.len(), 1);
}

#[test]
#[should_panic(expected = "Merchant already registered")]
fn test_register_duplicate_merchant_panics() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
}

#[test]
#[should_panic(expected = "fee_bps must be <= 10000")]
fn test_register_invalid_fee_bps_panics() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &10_001);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_register_merchant_unauthorized() {
    let (env, client, _admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&attacker, &merchant, &DEFAULT_FEE_BPS);
}

#[test]
fn test_get_merchant_returns_registered_record() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);

    let record = client.get_merchant(&merchant);
    assert_eq!(record.status, MerchantStatus::Approved);
    assert_eq!(record.fee_bps, DEFAULT_FEE_BPS);
    assert!(record.kyc_verified);
    assert_eq!(record.created_at, CREATED_AT);
}

#[test]
fn test_is_approved_returns_true_for_registered_merchant() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);

    assert!(client.is_approved(&merchant));
    assert!(client.is_merchant_active(&merchant));
}

#[test]
fn test_is_approved_returns_false_for_unknown_merchant() {
    let (env, client, _admin) = setup();
    let unknown = Address::generate(&env);

    assert!(!client.is_approved(&unknown));
    assert!(!client.is_merchant_active(&unknown));
}

#[test]
fn test_suspend_merchant_marks_merchant_unapproved() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.suspend_merchant(&admin, &merchant);

    let record = client.get_merchant(&merchant);
    assert_eq!(record.status, MerchantStatus::Suspended);
    assert!(!client.is_approved(&merchant));
}

#[test]
fn test_reactivate_merchant_restores_approval() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.suspend_merchant(&admin, &merchant);
    client.reactivate_merchant(&admin, &merchant);

    let record = client.get_merchant(&merchant);
    assert_eq!(record.status, MerchantStatus::Approved);
    assert!(client.is_approved(&merchant));
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_suspend_unauthorized() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.suspend_merchant(&attacker, &merchant);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_reactivate_unauthorized() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.suspend_merchant(&admin, &merchant);
    client.reactivate_merchant(&attacker, &merchant);
}

#[test]
#[should_panic(expected = "Merchant already suspended")]
fn test_suspend_already_suspended() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.suspend_merchant(&admin, &merchant);
    client.suspend_merchant(&admin, &merchant);
}

#[test]
#[should_panic(expected = "Merchant already active")]
fn test_reactivate_already_active() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &DEFAULT_FEE_BPS);
    client.reactivate_merchant(&admin, &merchant);
}
