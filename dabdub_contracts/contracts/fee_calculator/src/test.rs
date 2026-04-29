#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{FeeCalculatorContract, FeeCalculatorContractClient};

fn setup(default_bps: i128) -> (Env, Address, FeeCalculatorContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(FeeCalculatorContract, (&admin, default_bps));
    let client = FeeCalculatorContractClient::new(&env, &contract_id);
    (env, admin, client)
}

#[test]
fn test_default_fee_basic() {
    let (_env, _admin, client) = setup(200); // 2%
    let merchant = Address::generate(&_env);
    let (fee, net) = client.calculate_fee(&merchant, &10_000);
    assert_eq!(fee, 200);
    assert_eq!(net, 9_800);
}

#[test]
fn test_merchant_override_takes_precedence() {
    let (env, admin, client) = setup(200); // global 2%
    let merchant = Address::generate(&env);
    client.set_merchant_fee(&admin, &merchant, &500); // merchant 5%
    let (fee, net) = client.calculate_fee(&merchant, &10_000);
    assert_eq!(fee, 500);
    assert_eq!(net, 9_500);
}

#[test]
fn test_zero_fee() {
    let (_env, _admin, client) = setup(0);
    let merchant = Address::generate(&_env);
    let (fee, net) = client.calculate_fee(&merchant, &99_999);
    assert_eq!(fee, 0);
    assert_eq!(net, 99_999);
}

#[test]
fn test_hundred_percent_fee() {
    let (_env, _admin, client) = setup(10_000); // 100%
    let merchant = Address::generate(&_env);
    let (fee, net) = client.calculate_fee(&merchant, &5_000);
    assert_eq!(fee, 5_000);
    assert_eq!(net, 0);
}

#[test]
fn test_rounding_truncates() {
    let (_env, _admin, client) = setup(1); // 0.01 bps
    let merchant = Address::generate(&_env);
    // 1 * 1 / 10_000 = 0 (truncated)
    let (fee, net) = client.calculate_fee(&merchant, &1);
    assert_eq!(fee, 0);
    assert_eq!(net, 1);
}

#[test]
fn test_zero_amount() {
    let (_env, _admin, client) = setup(300);
    let merchant = Address::generate(&_env);
    let (fee, net) = client.calculate_fee(&merchant, &0);
    assert_eq!(fee, 0);
    assert_eq!(net, 0);
}

#[test]
fn test_set_default_fee() {
    let (env, admin, client) = setup(100);
    client.set_default_fee(&admin, &250);
    assert_eq!(client.get_default_fee(), 250);
    let merchant = Address::generate(&env);
    let (fee, _) = client.calculate_fee(&merchant, &10_000);
    assert_eq!(fee, 250);
}
