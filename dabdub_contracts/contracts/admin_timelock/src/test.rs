#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env, String};

fn setup() -> (Env, AdminTimelockContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);

    let admin = Address::generate(&env);
    let contract_id = env.register(AdminTimelockContract, (&admin,));
    let client = AdminTimelockContractClient::new(&env, &contract_id);

    (env, client, admin)
}

fn param(env: &Env) -> String {
    String::from_str(env, "fee_rate")
}

fn value(env: &Env) -> String {
    String::from_str(env, "200")
}

// ---------------------------------------------------------------------------
// schedule_change
// ---------------------------------------------------------------------------

#[test]
fn test_schedule_change_returns_id() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);
    let change = client.get_change(&id);
    assert_eq!(change.status, ChangeStatus::Pending);
    assert_eq!(change.execute_after, 100 + 100);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_schedule_change_unauthorized() {
    let (env, client, _) = setup();
    let attacker = Address::generate(&env);
    client.schedule_change(&attacker, &param(&env), &value(&env), &100);
}

// ---------------------------------------------------------------------------
// apply_change — early execution rejected
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "Delay period has not elapsed")]
fn test_apply_change_early_rejected() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);

    // advance only 50 ledgers — not enough
    env.ledger().set_sequence_number(150);
    client.apply_change(&admin, &id);
}

// ---------------------------------------------------------------------------
// apply_change — late execution succeeds
// ---------------------------------------------------------------------------

#[test]
fn test_apply_change_after_delay_succeeds() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);

    // advance exactly to execute_after
    env.ledger().set_sequence_number(200);
    client.apply_change(&admin, &id);

    let change = client.get_change(&id);
    assert_eq!(change.status, ChangeStatus::Applied);
}

#[test]
#[should_panic(expected = "Change is not pending")]
fn test_apply_change_twice_panics() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);

    env.ledger().set_sequence_number(200);
    client.apply_change(&admin, &id);
    client.apply_change(&admin, &id);
}

// ---------------------------------------------------------------------------
// cancel_change
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_change_before_execution() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);
    client.cancel_change(&admin, &id);

    let change = client.get_change(&id);
    assert_eq!(change.status, ChangeStatus::Cancelled);
}

#[test]
#[should_panic(expected = "Change is not pending")]
fn test_cancel_applied_change_panics() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);

    env.ledger().set_sequence_number(200);
    client.apply_change(&admin, &id);
    client.cancel_change(&admin, &id);
}

#[test]
#[should_panic(expected = "Not admin")]
fn test_cancel_change_unauthorized() {
    let (env, client, admin) = setup();
    let id = client.schedule_change(&admin, &param(&env), &value(&env), &100);
    let attacker = Address::generate(&env);
    client.cancel_change(&attacker, &id);
}

// ---------------------------------------------------------------------------
// multiple independent changes are tracked separately
// ---------------------------------------------------------------------------

#[test]
fn test_two_changes_have_distinct_ids() {
    let (env, client, admin) = setup();
    let id1 = client.schedule_change(&admin, &param(&env), &value(&env), &100);
    let id2 = client.schedule_change(&admin, &param(&env), &value(&env), &100);
    assert_ne!(id1, id2);
}
