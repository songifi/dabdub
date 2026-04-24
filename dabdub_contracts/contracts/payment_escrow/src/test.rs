#![cfg(test)]

use crate::{PaymentEscrowContract, PaymentEscrowContractClient, PaymentStatus};
use soroban_sdk::{testutils::Address as _, testutils::Ledger, token, Address, BytesN, Env};

fn setup_env() -> (
    Env,
    PaymentEscrowContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(10);

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin);
    let usdc = asset_contract.address();

    let contract_id = env.register(PaymentEscrowContract, (&admin, &usdc, &100u32));
    let client = PaymentEscrowContractClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&customer, &1_000_000_000i128);

    (env, client, contract_id, admin, customer, merchant, usdc)
}

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn test_constructor() {
    let (_env, client, _contract_id, admin, _customer, _merchant, usdc) = setup_env();

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_usdc_token(), usdc);
    assert_eq!(client.get_default_ttl_ledgers(), 100);
}

#[test]
fn test_deposit_happy_path() {
    let (env, client, contract_id, _admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    let result = client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    let payment = client.get_payment(&payment_id);

    assert_eq!(result, payment_id);
    assert_eq!(payment.amount, 250_000_000);
    assert_eq!(payment.customer, customer.clone());
    assert_eq!(payment.merchant, merchant.clone());
    assert_eq!(payment.status, PaymentStatus::Pending);
    assert_eq!(payment.expiry, 110);
    assert_eq!(client.get_balance(&payment_id), 250_000_000);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&customer), 750_000_000);
    assert_eq!(token_client.balance(&contract_id), 250_000_000);
}

#[test]
#[should_panic(expected = "Payment ID already exists")]
fn test_deposit_duplicate_payment_id() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
}

#[test]
#[should_panic(expected = "Amount must be > 0")]
fn test_deposit_zero_amount() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();

    client.deposit(&customer, &make_id(&env, 1), &merchant, &0i128);
}

#[test]
fn test_release_happy_path() {
    let (env, client, contract_id, admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    client.release(&admin, &payment_id);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Released);
    assert_eq!(client.get_balance(&payment_id), 0);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&merchant), 250_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_release_unauthorized() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);
    let random = Address::generate(&env);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    client.release(&random, &payment_id);
}

#[test]
#[should_panic(expected = "Payment not found")]
fn test_release_invalid_payment_id() {
    let (env, client, _contract_id, admin, _customer, _merchant, _usdc) = setup_env();

    client.release(&admin, &make_id(&env, 99));
}

#[test]
#[should_panic(expected = "Payment expired")]
fn test_release_expired_payment() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    env.ledger().set_sequence_number(111);

    client.release(&admin, &payment_id);
}

#[test]
#[should_panic(expected = "Payment is not pending")]
fn test_release_already_settled_payment() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    client.release(&admin, &payment_id);
    client.release(&admin, &payment_id);
}

#[test]
fn test_expire_refunds_customer() {
    let (env, client, contract_id, _admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    env.ledger().set_sequence_number(111);
    client.expire(&payment_id);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Expired);
    assert_eq!(client.get_balance(&payment_id), 0);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&customer), 1_000_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Payment has not expired")]
fn test_expire_before_ttl() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128);
    client.expire(&payment_id);
}
