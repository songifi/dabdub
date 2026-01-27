#![cfg(test)]
use crate::{WalletFactory, WalletFactoryClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

#[test]
fn test_constructor() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_backend(), backend);
    assert_eq!(client.get_vault(), vault);
    assert_eq!(client.get_total_wallets(), 0);
    assert!(!client.is_paused());
}

#[test]
fn test_has_wallet_returns_false() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    let user_id = String::from_str(&env, "user@example.com");
    assert!(!client.has_wallet(&user_id));
    assert_eq!(client.get_wallet(&user_id), None);
}

#[test]
fn test_update_backend() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let new_backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    client.update_backend(&admin, &new_backend);

    assert_eq!(client.get_backend(), new_backend);
}

#[test]
#[should_panic(expected = "Only admin")]
fn test_update_backend_not_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let not_admin = Address::generate(&env);
    let new_backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    client.update_backend(&not_admin, &new_backend);
}

#[test]
fn test_update_vault() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let new_vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    client.update_vault(&admin, &new_vault);

    assert_eq!(client.get_vault(), new_vault);
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    client.pause(&admin);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Only admin")]
fn test_pause_not_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let not_admin = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let contract_id = env.register(WalletFactory, (&admin, &backend, &vault, &usdc, &wasm_hash));
    let client = WalletFactoryClient::new(&env, &contract_id);

    client.pause(&not_admin);
}
