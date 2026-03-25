#![cfg(test)]
use crate::{UserWallet, UserWalletClient};
use soroban_sdk::{testutils::Address as _, token, Address, Env};
use vault::Vault;

#[test]
fn test_initialize() {
    let env = Env::default();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    assert_eq!(client.get_backend(), backend);
    assert_eq!(client.get_vault(), vault);
    assert_eq!(client.get_owner(), None);
}

#[test]
fn test_with_owner() {
    let env = Env::default();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let owner = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &Some(owner.clone())));
    let client = UserWalletClient::new(&env, &contract_id);
    assert_eq!(client.get_owner(), Some(owner));
}

#[test]
fn test_get_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&contract_id, &1000_0000000);

    assert_eq!(client.get_balance(), 1000_0000000);
}

#[test]
fn test_withdraw_by_backend() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&contract_id, &1000_0000000);

    client.withdraw(&backend, &500_0000000, &recipient);

    assert_eq!(client.get_balance(), 500_0000000);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&recipient), 500_0000000);
}

#[test]
fn test_withdraw_by_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &Some(owner.clone())));
    let client = UserWalletClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&contract_id, &1000_0000000);

    client.withdraw(&owner, &300_0000000, &recipient);

    assert_eq!(client.get_balance(), 700_0000000);
}

#[test]
#[should_panic(expected = "Not authorized")]
fn test_withdraw_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let recipient = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    client.withdraw(&unauthorized, &100_0000000, &recipient);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&contract_id, &50_0000000);

    client.withdraw(&backend, &100_0000000, &recipient);
}

#[test]
fn test_set_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    client.set_owner(&backend, &new_owner);

    assert_eq!(client.get_owner(), Some(new_owner));
}

#[test]
#[should_panic(expected = "Only backend")]
fn test_set_owner_not_backend() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let not_backend = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    client.set_owner(&not_backend, &new_owner);
}

#[test]
fn test_emergency_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &Some(owner.clone())));
    let client = UserWalletClient::new(&env, &contract_id);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&contract_id, &1000_0000000);

    client.emergency_withdraw(&owner);

    assert_eq!(client.get_balance(), 0);

    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&owner), 1000_0000000);
}

#[test]
#[should_panic(expected = "Owner not set")]
fn test_emergency_withdraw_no_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let usdc = Address::generate(&env);
    let someone = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &None::<Address>));
    let client = UserWalletClient::new(&env, &contract_id);

    client.emergency_withdraw(&someone);
}

#[test]
#[should_panic(expected = "Only owner")]
fn test_emergency_withdraw_not_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let vault = Address::generate(&env);
    let owner = Address::generate(&env);
    let not_owner = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(UserWallet, (&backend, &vault, &usdc, &Some(owner.clone())));
    let client = UserWalletClient::new(&env, &contract_id);

    client.emergency_withdraw(&not_owner);
}

#[test]
fn test_transfer_to_vault_by_backend() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let vault_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));

    let wallet_id = env.register(UserWallet, (&backend, &vault_id, &usdc, &None::<Address>));
    let wallet = UserWalletClient::new(&env, &wallet_id);

    // Mint tokens to wallet
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&wallet_id, &100_000_000);

    // Transfer payment + fee to vault
    let total_amount = wallet.transfer_to_vault(&backend, &50_000_000);
    assert_eq!(total_amount, 50_500_000);

    // Verify balances
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&vault_id), 50_500_000);
    assert_eq!(token_client.balance(&wallet_id), 49_500_000);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_transfer_to_vault_insufficient_balance_including_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let vault_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let wallet_id = env.register(UserWallet, (&backend, &vault_id, &usdc, &None::<Address>));
    let wallet = UserWalletClient::new(&env, &wallet_id);

    // Only mint the payment amount (not enough for payment + fee)
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&wallet_id, &50_000_000);

    wallet.transfer_to_vault(&backend, &50_000_000);
}

#[test]
#[should_panic(expected = "Not authorized")]
fn test_transfer_to_vault_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let backend = Address::generate(&env);
    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let vault_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let wallet_id = env.register(UserWallet, (&backend, &vault_id, &usdc, &None::<Address>));
    let wallet = UserWalletClient::new(&env, &wallet_id);

    wallet.transfer_to_vault(&unauthorized, &10_000_000);
}
