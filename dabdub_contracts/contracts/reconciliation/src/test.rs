#![cfg(test)]

use crate::{
    MerkleProofNode, ReconciliationContract, ReconciliationContractClient, ReconciliationSubmittedEvent,
};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    vec, Address, Bytes, BytesN, Env, IntoVal, TryFromVal,
};

fn setup_env() -> (Env, ReconciliationContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(ReconciliationContract, (&admin,));
    let client = ReconciliationContractClient::new(&env, &contract_id);

    (env, client, admin)
}

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn hash_leaf(env: &Env, payment_id: &BytesN<32>) -> BytesN<32> {
    let arr = payment_id.to_array();
    env.crypto().sha256(&Bytes::from_slice(env, &arr)).into()
}

fn hash_pair(env: &Env, left: &BytesN<32>, right: &BytesN<32>) -> BytesN<32> {
    let left_arr = left.to_array();
    let right_arr = right.to_array();

    let mut combined = [0u8; 64];
    combined[..32].copy_from_slice(&left_arr);
    combined[32..].copy_from_slice(&right_arr);
    env.crypto().sha256(&Bytes::from_slice(env, &combined)).into()
}

#[test]
fn test_admin_can_submit_merkle_root_and_store_batch() {
    let (env, client, admin) = setup_env();
    env.ledger().set_sequence_number(50);
    env.ledger().set_timestamp(1_710_000_000);

    let payment_a = make_id(&env, 1);
    let payment_b = make_id(&env, 2);
    let root = hash_pair(&env, &hash_leaf(&env, &payment_a), &hash_leaf(&env, &payment_b));

    client.submit_merkle_root(&admin, &root);
    let batch = client.get_current_batch().unwrap();

    assert_eq!(batch.merkle_root, root);
    assert_eq!(batch.submitted_ledger, 50);
    assert_eq!(batch.submitted_at, 1_710_000_000);
}

#[test]
fn test_verify_settlement_valid_proof_returns_no_mismatch() {
    let (env, client, admin) = setup_env();
    let payment_a = make_id(&env, 10);
    let payment_b = make_id(&env, 20);

    let leaf_a = hash_leaf(&env, &payment_a);
    let leaf_b = hash_leaf(&env, &payment_b);
    let root = hash_pair(&env, &leaf_a, &leaf_b);
    client.submit_merkle_root(&admin, &root);

    let proof = vec![
        &env,
        MerkleProofNode {
            sibling: leaf_b,
            is_left: false,
        },
    ];

    let mismatch = client.verify_settlement(&payment_a, &proof);
    assert!(!mismatch);
}

#[test]
fn test_verify_settlement_invalid_proof_returns_mismatch() {
    let (env, client, admin) = setup_env();
    let payment_a = make_id(&env, 11);
    let payment_b = make_id(&env, 22);
    let wrong = make_id(&env, 99);

    let leaf_a = hash_leaf(&env, &payment_a);
    let leaf_b = hash_leaf(&env, &payment_b);
    let wrong_leaf = hash_leaf(&env, &wrong);
    let root = hash_pair(&env, &leaf_a, &leaf_b);
    client.submit_merkle_root(&admin, &root);

    let invalid_proof = vec![
        &env,
        MerkleProofNode {
            sibling: wrong_leaf,
            is_left: false,
        },
    ];

    let mismatch = client.verify_settlement(&payment_a, &invalid_proof);
    assert!(mismatch);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_non_admin_cannot_submit_merkle_root() {
    let (env, client, _admin) = setup_env();
    let random = Address::generate(&env);
    let root = make_id(&env, 42);
    client.submit_merkle_root(&random, &root);
}

#[test]
fn test_submit_emits_reconciliation_submitted_event() {
    let (env, client, admin) = setup_env();
    env.ledger().set_sequence_number(77);
    env.ledger().set_timestamp(1_720_000_000);

    let root = make_id(&env, 7);
    client.submit_merkle_root(&admin, &root);

    let all_events = env.events().all();
    let event = all_events.last().unwrap();

    let expected_topic = ("RECONCILIATION", "submitted").into_val(&env);
    assert_eq!(event.1, expected_topic);

    let payload = ReconciliationSubmittedEvent::try_from_val(&env, &event.2).unwrap();
    assert_eq!(payload.merkle_root, root);
    assert_eq!(payload.submitted_ledger, 77);
    assert_eq!(payload.submitted_at, 1_720_000_000);
}
