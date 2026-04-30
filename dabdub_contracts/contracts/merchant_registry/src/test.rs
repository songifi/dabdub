#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup() -> (Env, MerchantRegistryContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(MerchantRegistryContract, (&admin,));
    let client = MerchantRegistryContractClient::new(&env, &contract_id);

    (env, client, admin)
}

fn sample_name(env: &Env) -> String {
    String::from_str(env, "Acme Corp")
}

// ---------------------------------------------------------------------------
// register_merchant
// ---------------------------------------------------------------------------

#[test]
fn test_register_merchant_happy_path() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));

    let record = client.get_merchant(&merchant);
    assert_eq!(record.merchant, merchant);
    assert_eq!(record.status, MerchantStatus::Active);
}

#[test]
#[should_panic(expected = "Merchant already registered")]
fn test_register_duplicate_merchant_panics() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.register_merchant(&admin, &merchant, &sample_name(&env));
}

// ---------------------------------------------------------------------------
// suspend_merchant / reactivate_merchant
// ---------------------------------------------------------------------------

#[test]
fn test_suspend_merchant() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&admin, &merchant);

    let record = client.get_merchant(&merchant);
    assert_eq!(record.status, MerchantStatus::Suspended);
}

#[test]
fn test_reactivate_merchant() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&admin, &merchant);
    client.reactivate_merchant(&admin, &merchant);

    let record = client.get_merchant(&merchant);
    assert_eq!(record.status, MerchantStatus::Active);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_suspend_unauthorized() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&attacker, &merchant);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_reactivate_unauthorized() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&admin, &merchant);
    client.reactivate_merchant(&attacker, &merchant);
}

#[test]
#[should_panic(expected = "Merchant already suspended")]
fn test_suspend_already_suspended() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&admin, &merchant);
    client.suspend_merchant(&admin, &merchant);
}

#[test]
#[should_panic(expected = "Merchant already active")]
fn test_reactivate_already_active() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    // merchant is Active after registration – reactivating should panic
    client.reactivate_merchant(&admin, &merchant);
}

// ---------------------------------------------------------------------------
// is_merchant_active
// ---------------------------------------------------------------------------

#[test]
fn test_is_merchant_active_returns_true_for_active() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    assert!(client.is_merchant_active(&merchant));
}

#[test]
fn test_is_merchant_active_returns_false_for_suspended() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&admin, &merchant);
    assert!(!client.is_merchant_active(&merchant));
}

#[test]
fn test_is_merchant_active_returns_true_after_reactivation() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.suspend_merchant(&admin, &merchant);
    client.reactivate_merchant(&admin, &merchant);
    assert!(client.is_merchant_active(&merchant));
}

#[test]
fn test_is_merchant_active_returns_false_for_unknown() {
    let (env, client, _admin) = setup();
    let unknown = Address::generate(&env);
    assert!(!client.is_merchant_active(&unknown));
}

// ---------------------------------------------------------------------------
// set_kyc_status / is_kyc_verified
// ---------------------------------------------------------------------------

#[test]
fn test_kyc_defaults_to_false() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));

    assert!(!client.is_kyc_verified(&merchant));
}

#[test]
fn test_set_kyc_status_to_true() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.set_kyc_status(&admin, &merchant, &true);

    assert!(client.is_kyc_verified(&merchant));
}

#[test]
fn test_set_kyc_status_toggle_back_to_false() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.set_kyc_status(&admin, &merchant, &true);
    client.set_kyc_status(&admin, &merchant, &false);

    assert!(!client.is_kyc_verified(&merchant));
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_set_kyc_status_unauthorized() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.set_kyc_status(&attacker, &merchant, &true);
}

#[test]
fn test_is_kyc_verified_returns_false_for_unknown() {
    let (env, client, _admin) = setup();
    let unknown = Address::generate(&env);

    assert!(!client.is_kyc_verified(&unknown));
}

#[test]
fn test_get_merchant_includes_kyc_field() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    let record = client.get_merchant(&merchant);

    assert_eq!(record.kyc_verified, false);
}

// ---------------------------------------------------------------------------
// update_fee_tier / get_fee_tier
// ---------------------------------------------------------------------------

#[test]
fn test_fee_tier_defaults_to_150() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    assert_eq!(client.get_fee_tier(&merchant), 150);
}

#[test]
fn test_update_fee_tier_happy_path() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.update_fee_tier(&admin, &merchant, &300);
    assert_eq!(client.get_fee_tier(&merchant), 300);
}

#[test]
fn test_update_fee_tier_to_zero() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.update_fee_tier(&admin, &merchant, &0);
    assert_eq!(client.get_fee_tier(&merchant), 0);
}

#[test]
fn test_update_fee_tier_to_max() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.update_fee_tier(&admin, &merchant, &1000);
    assert_eq!(client.get_fee_tier(&merchant), 1000);
}

#[test]
#[should_panic(expected = "fee_bps exceeds maximum of 1000")]
fn test_update_fee_tier_above_max_panics() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.update_fee_tier(&admin, &merchant, &1001);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_update_fee_tier_unauthorized() {
    let (env, client, admin) = setup();
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.register_merchant(&admin, &merchant, &sample_name(&env));
    client.update_fee_tier(&attacker, &merchant, &200);
}
