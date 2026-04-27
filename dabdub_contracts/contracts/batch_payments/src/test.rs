#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn make_payment(env: &Env, amount: i128, memo: &str) -> PaymentInput {
    PaymentInput {
        amount,
        memo: String::from_str(env, memo),
        customer: None,
    }
}

#[test]
fn test_batch_of_1_payment() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    let payments = soroban_sdk::vec![&env, make_payment(&env, 1000, "order-1")];

    let ids = client.create_batch(&merchant, &payments);
    assert_eq!(ids.len(), 1);
}

#[test]
fn test_batch_of_10_payments() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    let mut payments = soroban_sdk::vec![&env];
    for i in 0..10_u32 {
        payments.push_back(make_payment(&env, (i as i128 + 1) * 100, "order"));
    }

    let ids = client.create_batch(&merchant, &payments);
    assert_eq!(ids.len(), 10);
}

#[test]
fn test_batch_of_20_payments() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    let mut payments = soroban_sdk::vec![&env];
    for i in 0..20_u32 {
        payments.push_back(make_payment(&env, (i as i128 + 1) * 50, "batch-item"));
    }

    let ids = client.create_batch(&merchant, &payments);
    assert_eq!(ids.len(), 20);
}

#[test]
#[should_panic(expected = "batch exceeds maximum")]
fn test_batch_over_20_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    let mut payments = soroban_sdk::vec![&env];
    for i in 0..21_u32 {
        payments.push_back(make_payment(&env, (i as i128 + 1) * 10, "over-limit"));
    }

    client.create_batch(&merchant, &payments);
}

#[test]
#[should_panic(expected = "amount must be")]
fn test_zero_amount_reverts_entire_batch() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    // First item is valid, second has zero amount — entire batch must revert.
    let payments = soroban_sdk::vec![
        &env,
        make_payment(&env, 500, "valid"),
        PaymentInput {
            amount: 0,
            memo: String::from_str(&env, "invalid"),
            customer: None,
        },
    ];

    client.create_batch(&merchant, &payments);
}

#[test]
#[should_panic(expected = "memo must not be empty")]
fn test_empty_memo_reverts_entire_batch() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    let payments = soroban_sdk::vec![
        &env,
        PaymentInput {
            amount: 100,
            memo: String::from_str(&env, ""),
            customer: None,
        },
    ];

    client.create_batch(&merchant, &payments);
}

#[test]
fn test_payment_created_events_emitted() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);

    let merchant = Address::generate(&env);
    let payments = soroban_sdk::vec![
        &env,
        make_payment(&env, 100, "item-a"),
        make_payment(&env, 200, "item-b"),
        make_payment(&env, 300, "item-c"),
    ];

    let ids = client.create_batch(&merchant, &payments);
    assert_eq!(ids.len(), 3);

    // Verify three PaymentCreated events were emitted
    let events = env.events().all();
    assert_eq!(events.len(), 3);
}

#[test]
fn test_max_batch_size_is_20() {
    let env = Env::default();
    let contract_id = env.register_contract(None, BatchPaymentContract);
    let client = BatchPaymentContractClient::new(&env, &contract_id);
    assert_eq!(client.max_batch_size(), 20);
}
