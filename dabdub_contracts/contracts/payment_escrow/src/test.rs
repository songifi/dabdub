#![cfg(test)]

use crate::{PaymentEscrowContract, PaymentEscrowContractClient, PaymentStatus};
use soroban_sdk::{
    testutils::Address as _, testutils::Ledger, token, Address, BytesN, Env, String,
};

const DEFAULT_PAYMENT_TTL: u32 = 100;

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

    let contract_id = env.register(PaymentEscrowContract, (&admin, &usdc, &DEFAULT_PAYMENT_TTL));
    let client = PaymentEscrowContractClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&customer, &1_000_000_000i128);

    (env, client, contract_id, admin, customer, merchant, usdc)
}

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn deposit_default_ttl(
    client: &PaymentEscrowContractClient<'_>,
    customer: &Address,
    payment_id: &BytesN<32>,
    merchant: &Address,
    amount: i128,
) {
    client.deposit(
        customer,
        payment_id,
        merchant,
        &amount,
        &DEFAULT_PAYMENT_TTL,
    );
}

#[test]
fn test_constructor() {
    let (_env, client, _contract_id, admin, _customer, _merchant, usdc) = setup_env();

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_usdc_token(), usdc);
    assert_eq!(client.get_default_ttl_ledgers(), DEFAULT_PAYMENT_TTL);
}

#[test]
fn test_deposit_happy_path() {
    let (env, client, contract_id, _admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    let result = client.deposit(
        &customer,
        &payment_id,
        &merchant,
        &250_000_000i128,
        &DEFAULT_PAYMENT_TTL,
    );
    let payment = client.get_payment(&payment_id);

    assert_eq!(result, payment_id);
    assert_eq!(payment.amount, 250_000_000);
    assert_eq!(payment.released_amount, 0);
    assert_eq!(payment.customer, customer.clone());
    assert_eq!(payment.merchant, merchant.clone());
    assert_eq!(payment.status, PaymentStatus::Pending);
    assert_eq!(payment.expiry, 110);
    assert_eq!(payment.dispute_window_end, 110);
    assert_eq!(payment.dispute_reason, None);
    assert_eq!(client.get_balance(&payment_id), 250_000_000);
    assert_eq!(client.get_expiry(&payment_id), 110);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&customer), 750_000_000);
    assert_eq!(token_client.balance(&contract_id), 250_000_000);
}

#[test]
#[should_panic(expected = "Payment ID already exists")]
fn test_deposit_duplicate_payment_id() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
}

#[test]
#[should_panic(expected = "Amount must be > 0")]
fn test_deposit_zero_amount() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();

    client.deposit(
        &customer,
        &make_id(&env, 1),
        &merchant,
        &0i128,
        &DEFAULT_PAYMENT_TTL,
    );
}

#[test]
#[should_panic(expected = "TTL must be > 0")]
fn test_deposit_zero_ttl() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();

    client.deposit(
        &customer,
        &make_id(&env, 1),
        &merchant,
        &250_000_000i128,
        &0u32,
    );
}

#[test]
#[should_panic(expected = "TTL exceeds maximum")]
fn test_deposit_excessive_ttl() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let ttl = client.get_max_ttl_ledgers() + 1;

    client.deposit(
        &customer,
        &make_id(&env, 1),
        &merchant,
        &250_000_000i128,
        &ttl,
    );
}

#[test]
fn test_get_expiry_with_short_ttl() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(&customer, &payment_id, &merchant, &250_000_000i128, &5u32);

    assert_eq!(client.get_expiry(&payment_id), 15);
}

#[test]
fn test_get_expiry_with_long_ttl() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    client.deposit(
        &customer,
        &payment_id,
        &merchant,
        &250_000_000i128,
        &2_000u32,
    );

    assert_eq!(client.get_expiry(&payment_id), 2_010);
}

#[test]
fn test_release_happy_path() {
    let (env, client, contract_id, admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release(&admin, &payment_id);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Released);
    assert_eq!(payment.released_amount, 250_000_000);
    assert_eq!(client.get_balance(&payment_id), 0);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&merchant), 250_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_partial_release_multiple_steps() {
    let (env, client, contract_id, admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release_partial(&admin, &payment_id, &100_000_000i128);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Pending);
    assert_eq!(payment.released_amount, 100_000_000);
    assert_eq!(client.get_balance(&payment_id), 150_000_000);

    client.release_partial(&admin, &payment_id, &150_000_000i128);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Released);
    assert_eq!(payment.released_amount, 250_000_000);
    assert_eq!(client.get_balance(&payment_id), 0);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&merchant), 250_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Release amount exceeds remaining balance")]
fn test_partial_release_prevents_over_release() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release_partial(&admin, &payment_id, &200_000_000i128);
    client.release_partial(&admin, &payment_id, &100_000_000i128);
}

#[test]
fn test_refund_returns_remaining_balance_after_partial_release() {
    let (env, client, contract_id, admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release_partial(&admin, &payment_id, &100_000_000i128);
    env.ledger().set_sequence_number(111);
    client.refund(&payment_id);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Expired);
    assert_eq!(client.get_balance(&payment_id), 0);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&merchant), 100_000_000);
    assert_eq!(token_client.balance(&customer), 900_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_release_unauthorized() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);
    let random = Address::generate(&env);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release(&random, &payment_id);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_partial_release_unauthorized() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);
    let random = Address::generate(&env);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release_partial(&random, &payment_id, &10_000_000i128);
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

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    env.ledger().set_sequence_number(111);

    client.release(&admin, &payment_id);
}

#[test]
#[should_panic(expected = "Payment expired")]
fn test_partial_release_expired_payment() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    env.ledger().set_sequence_number(111);

    client.release_partial(&admin, &payment_id, &10_000_000i128);
}

#[test]
#[should_panic(expected = "Payment fully released")]
fn test_release_already_settled_payment() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release(&admin, &payment_id);
    client.release(&admin, &payment_id);
}

#[test]
#[should_panic(expected = "Release amount must be > 0")]
fn test_partial_release_zero_amount() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release_partial(&admin, &payment_id, &0i128);
}

#[test]
#[should_panic(expected = "Payment fully released")]
fn test_partial_release_fully_released_payment() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.release(&admin, &payment_id);
    client.release_partial(&admin, &payment_id, &1i128);
}

#[test]
fn test_expire_refunds_customer() {
    let (env, client, contract_id, _admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    env.ledger().set_sequence_number(111);
    client.refund(&payment_id);

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

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.expire(&payment_id);
}

#[test]
fn test_dispute_by_customer() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &customer,
        &payment_id,
        &String::from_str(&env, "service not delivered"),
    );

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Disputed);
    assert_eq!(
        payment.dispute_reason,
        Some(String::from_str(&env, "service not delivered"))
    );
    assert_eq!(client.get_balance(&payment_id), 250_000_000);
}

#[test]
fn test_dispute_by_merchant() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &merchant,
        &payment_id,
        &String::from_str(&env, "backend settlement mismatch"),
    );

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Disputed);
}

#[test]
#[should_panic(expected = "Not payment participant")]
fn test_dispute_unauthorized_caller() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);
    let random = Address::generate(&env);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(&random, &payment_id, &String::from_str(&env, "not allowed"));
}

#[test]
#[should_panic(expected = "Dispute already open")]
fn test_duplicate_dispute_rejected() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(&customer, &payment_id, &String::from_str(&env, "first"));
    client.dispute(&merchant, &payment_id, &String::from_str(&env, "second"));
}

#[test]
#[should_panic(expected = "Dispute window expired")]
fn test_dispute_after_window_rejected() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    env.ledger().set_sequence_number(111);
    client.dispute(&customer, &payment_id, &String::from_str(&env, "too late"));
}

#[test]
#[should_panic(expected = "Dispute is open")]
fn test_release_blocked_while_disputed() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &customer,
        &payment_id,
        &String::from_str(&env, "hold funds"),
    );
    client.release(&admin, &payment_id);
}

#[test]
#[should_panic(expected = "Dispute is open")]
fn test_partial_release_blocked_while_disputed() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &merchant,
        &payment_id,
        &String::from_str(&env, "hold release"),
    );
    client.release_partial(&admin, &payment_id, &10_000_000i128);
}

#[test]
#[should_panic(expected = "Dispute is open")]
fn test_expire_blocked_while_disputed() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &merchant,
        &payment_id,
        &String::from_str(&env, "hold refund"),
    );
    env.ledger().set_sequence_number(111);
    client.expire(&payment_id);
}

#[test]
fn test_resolve_dispute_to_customer() {
    let (env, client, contract_id, admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &merchant,
        &payment_id,
        &String::from_str(&env, "chargeback"),
    );
    client.resolve_dispute(&admin, &payment_id, &customer);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Expired);
    assert_eq!(payment.released_amount, 250_000_000);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&customer), 1_000_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_resolve_dispute_to_merchant() {
    let (env, client, contract_id, admin, customer, merchant, usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &customer,
        &payment_id,
        &String::from_str(&env, "investigate"),
    );
    client.resolve_dispute(&admin, &payment_id, &merchant);

    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.status, PaymentStatus::Released);
    assert_eq!(payment.released_amount, 250_000_000);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&merchant), 250_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_resolve_dispute_unauthorized() {
    let (env, client, _contract_id, _admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);
    let random = Address::generate(&env);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &customer,
        &payment_id,
        &String::from_str(&env, "investigate"),
    );
    client.resolve_dispute(&random, &payment_id, &merchant);
}

#[test]
#[should_panic(expected = "Invalid dispute winner")]
fn test_resolve_dispute_invalid_winner() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);
    let random = Address::generate(&env);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &merchant,
        &payment_id,
        &String::from_str(&env, "investigate"),
    );
    client.resolve_dispute(&admin, &payment_id, &random);
}

#[test]
#[should_panic(expected = "Dispute is not open")]
fn test_resolve_dispute_already_resolved() {
    let (env, client, _contract_id, admin, customer, merchant, _usdc) = setup_env();
    let payment_id = make_id(&env, 1);

    deposit_default_ttl(&client, &customer, &payment_id, &merchant, 250_000_000i128);
    client.dispute(
        &merchant,
        &payment_id,
        &String::from_str(&env, "investigate"),
    );
    client.resolve_dispute(&admin, &payment_id, &merchant);
    client.resolve_dispute(&admin, &payment_id, &merchant);
}
