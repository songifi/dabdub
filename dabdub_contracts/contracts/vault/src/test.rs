#![cfg(test)]
use crate::{access_control, Vault, VaultClient};
use soroban_sdk::{testutils::Address as _, token, Address, BytesN, Env};
use user_wallet::{UserWallet, UserWalletClient};

#[test]
fn test_grant_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let operator = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Grant operator role
    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    assert!(client.has_role(&operator, &access_control::OPERATOR_ROLE));
}

#[test]
fn test_revoke_role() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let operator = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);
    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    // Revoke role
    client.revoke_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    assert!(!client.has_role(&operator, &access_control::OPERATOR_ROLE));
}

#[test]
#[should_panic(expected = "Missing required role")]
fn test_only_admin_can_grant() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let operator = Address::generate(&env);
    let non_admin = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Non-admin tries to grant role - should panic
    client.grant_role(&non_admin, &operator, &access_control::OPERATOR_ROLE);
}

#[test]
fn test_multiple_roles() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Grant multiple roles
    client.grant_role(&admin, &user, &access_control::OPERATOR_ROLE);
    client.grant_role(&admin, &user, &access_control::TREASURER_ROLE);

    assert!(client.has_role(&user, &access_control::OPERATOR_ROLE));
    assert!(client.has_role(&user, &access_control::TREASURER_ROLE));
}

#[test]
fn test_has_role_returns_false() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let user = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    assert!(!client.has_role(&user, &access_control::OPERATOR_ROLE));
}

#[test]
fn test_constructor() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_fee_amount(), 500_000);
    assert_eq!(client.get_min_deposit(), 1_000_000);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Fee exceeds maximum")]
fn test_constructor_fee_too_high() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    env.register(
        Vault,
        (&admin, &usdc, &10_000_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")), // Fee > MAX_FEE
    );
}

#[test]
fn test_process_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    // Grant operator role
    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    // Mint tokens to user wallet
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);

    // Fund the vault via wallet (payment + fee)
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    // Process payment
    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    // Verify tracking
    let (payments, fees, total) = client.get_available_withdrawal();
    assert_eq!(payments, 50_000_000);
    assert_eq!(fees, 500_000);
    assert_eq!(total, 50_500_000);

    // Verify tokens transferred to vault
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&contract_id), 50_500_000);
    assert_eq!(token_client.balance(&user_wallet_id), 49_500_000);
}

#[test]
#[should_panic(expected = "Missing required role")]
fn test_process_payment_not_operator() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let not_operator = Address::generate(&env);
    let user_wallet = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&not_operator, &user_wallet, &50_000_000, &payment_id);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_process_payment_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let user_wallet = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    client.pause(&admin);
    assert!(client.is_paused());

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet, &50_000_000, &payment_id);
}

#[test]
fn test_verify_vault_accounting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    // Mint and process payment
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);

    // Fund the vault via wallet (payment + fee)
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    // Verify accounting
    assert!(client.verify_vault_accounting());
}

#[test]
fn test_withdraw_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc = asset_contract.address();
    let to_address = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Set initial balance
    client.set_balance(&admin, &username, &1_000_000);

    // Mint tokens to vault to simulate it having funds
    let usdc_client = token::StellarAssetClient::new(&env, &usdc);
    usdc_client.mint(&contract_id, &1_000_000);

    // Withdraw
    client.withdraw(&username, &to_address, &500_000);

    // Verify balances
    assert_eq!(client.get_balance(&username), 500_000);
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&to_address), 500_000);
    assert_eq!(token_client.balance(&contract_id), 500_000);
}

#[test]
fn test_withdraw_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");
    let to_address = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.set_balance(&admin, &username, &100_000);

    let result = client.try_withdraw(&username, &to_address, &500_000);
    assert_eq!(result, Err(Ok(crate::Error::InsufficientBalance)));
}

#[test]
fn test_withdraw_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");
    let to_address = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.pause(&admin);

    let result = client.try_withdraw(&username, &to_address, &500_000);
    assert_eq!(result, Err(Ok(crate::Error::ContractPaused)));
}

#[test]
#[should_panic]
fn test_withdraw_unauthorized() {
    let env = Env::default();
    // No mock_all_auths here to test auth failure

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");
    let to_address = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // This should panic because admin hasn't authorized it
    client.withdraw(&username, &to_address, &500_000);
}

#[test]
fn test_refund_payment_with_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    // Mint and process payment
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    // Refund with fee
    client.refund_payment(&admin, &user_wallet_id, &50_000_000, &true, &payment_id);

    // Verify tracking
    let (payments, fees, total) = client.get_available_withdrawal();
    assert_eq!(payments, 0);
    assert_eq!(fees, 0);
    assert_eq!(total, 0);

    // Verify tokens transferred back (50M + 500k fee)
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&user_wallet_id), 100_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_refund_payment_without_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    // Mint and process payment
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    // Refund without fee
    client.refund_payment(&admin, &user_wallet_id, &50_000_000, &false, &payment_id);

    // Verify tracking (fee should remain)
    let (payments, fees, total) = client.get_available_withdrawal();
    assert_eq!(payments, 0);
    assert_eq!(fees, 500_000);
    assert_eq!(total, 500_000);

    // Verify tokens transferred back (only 50M)
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&user_wallet_id), 99_500_000);
    assert_eq!(token_client.balance(&contract_id), 500_000);
}

#[test]
fn test_withdraw_vault_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let treasurer = Address::generate(&env);
    let backend = Address::generate(&env);
    let treasury_wallet = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);
    client.grant_role(&admin, &treasurer, &access_control::TREASURER_ROLE);

    // Process a payment
    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    // Withdraw funds
    client.withdraw_vault_funds(&treasurer, &treasury_wallet);

    // Verify tracking reset
    let (payments, fees, total) = client.get_available_withdrawal();
    assert_eq!(payments, 0);
    assert_eq!(fees, 0);
    assert_eq!(total, 0);

    // Verify tokens transferred to treasury
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&treasury_wallet), 50_500_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_set_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.set_fee(&admin, &1_000_000i128);
    assert_eq!(client.get_fee_amount(), 1_000_000);
}

#[test]
fn test_unstake_partial() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Set initial stake balance and liquid balance
    client.set_stake_balance(&admin, &username, &1_000_000);
    client.set_balance(&admin, &username, &500_000);

    // Unstake partial
    client.unstake(&username, &400_000);

    // Verify balances
    assert_eq!(client.get_stake_balance(&username), 600_000);
    assert_eq!(client.get_balance(&username), 900_000);
}

#[test]
fn test_unstake_full() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Set initial stake balance
    client.set_stake_balance(&admin, &username, &1_000_000);
    client.set_balance(&admin, &username, &0);

    // Unstake full
    client.unstake(&username, &1_000_000);

    // Verify balances
    assert_eq!(client.get_stake_balance(&username), 0);
    assert_eq!(client.get_balance(&username), 1_000_000);
}

#[test]
fn test_unstake_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Set initial stake balance
    client.set_stake_balance(&admin, &username, &100_000);

    // Try to unstake more than available
    let result = client.try_unstake(&username, &200_000);
    assert_eq!(result, Err(Ok(crate::Error::InsufficientBalance)));
}

#[test]
fn test_unstake_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Try to unstake 0
    let result = client.try_unstake(&username, &0);
    assert_eq!(result, Err(Ok(crate::Error::InvalidAmount)));

    // Try to unstake negative
    let result = client.try_unstake(&username, &-100);
    assert_eq!(result, Err(Ok(crate::Error::InvalidAmount)));
}

#[test]
fn test_unstake_user_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "bob");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Bob has no stake record
    let result = client.try_unstake(&username, &100_000);
    assert_eq!(result, Err(Ok(crate::Error::UserNotFound)));
}

#[test]
fn test_unstake_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.pause(&admin);

    let result = client.try_unstake(&username, &100_000);
    assert_eq!(result, Err(Ok(crate::Error::ContractPaused)));
}

#[test]
#[should_panic(expected = "Fee exceeds maximum")]
fn test_set_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.set_fee(&admin, &10_000_000i128);
}

#[test]
fn test_set_min_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.set_min_deposit(&admin, &2_000_000i128);
    assert_eq!(client.get_min_deposit(), 2_000_000);
}

#[test]
fn test_deposit_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let usdc_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc = asset_contract.address();
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Register user
    client.set_user_address(&admin, &username, &user);

    // Mint USDC to user
    let usdc_client = token::StellarAssetClient::new(&env, &usdc);
    usdc_client.mint(&user, &10_000_000);

    // Deposit
    client.deposit(&user, &username, &5_000_000);

    // Verify balances
    assert_eq!(client.get_balance(&username), 5_000_000);
    let token_client = token::Client::new(&env, &usdc);
    assert_eq!(token_client.balance(&contract_id), 5_000_000);
    assert_eq!(token_client.balance(&user), 5_000_000);
}

#[test]
fn test_deposit_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Try to deposit 0
    let result = client.try_deposit(&user, &username, &0);
    assert_eq!(result, Err(Ok(crate::Error::InvalidAmount)));

    // Try to deposit negative
    let result = client.try_deposit(&user, &username, &-100);
    assert_eq!(result, Err(Ok(crate::Error::InvalidAmount)));
}

#[test]
fn test_deposit_user_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "bob");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    // Bob is not registered
    let result = client.try_deposit(&user, &username, &5_000_000);
    assert_eq!(result, Err(Ok(crate::Error::UserNotFound)));
}

#[test]
#[should_panic(expected = "Missing required role")]
fn test_refund_not_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let not_admin = Address::generate(&env);
    let user_wallet = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.refund_payment(&not_admin, &user_wallet, &10_000_000, &false, &payment_id);
}

#[test]
#[should_panic(expected = "Missing required role")]
fn test_withdraw_not_treasurer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let not_treasurer = Address::generate(&env);
    let treasury_wallet = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    client.withdraw_vault_funds(&not_treasurer, &treasury_wallet);
}

#[test]
#[should_panic(expected = "Insufficient available payments")]
fn test_refund_insufficient_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_wallet = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.refund_payment(&admin, &user_wallet, &10_000_000, &false, &payment_id);
}

// --- cancel_pending_claim tests ---

#[test]
fn test_cancel_pending_claim_by_admin_with_force() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[2u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    let (payments_before, fees_before, _) = client.get_available_withdrawal();
    assert_eq!(payments_before, 50_000_000);
    assert_eq!(fees_before, 500_000);

    client.cancel_pending_claim(&admin, &payment_id, &true);

    let (payments_after, fees_after, total_after) = client.get_available_withdrawal();
    assert_eq!(payments_after, 0);
    assert_eq!(fees_after, 0);
    assert_eq!(total_after, 0);
}

#[test]
fn test_cancel_pending_claim_by_operator_with_force() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[3u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    client.cancel_pending_claim(&operator, &payment_id, &true);

    let (payments, fees, total) = client.get_available_withdrawal();
    assert_eq!(payments, 0);
    assert_eq!(fees, 0);
    assert_eq!(total, 0);
}

#[test]
#[should_panic(expected = "Claim has not expired")]
fn test_cancel_pending_claim_not_expired_without_force() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[5u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    client.cancel_pending_claim(&operator, &payment_id, &false);
}

#[test]
#[should_panic(expected = "Missing required role")]
fn test_cancel_pending_claim_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let random = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[6u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    client.cancel_pending_claim(&random, &payment_id, &true);
}

#[test]
#[should_panic(expected = "Pending claim not found")]
fn test_cancel_pending_claim_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let payment_id = BytesN::from_array(&env, &[99u8; 32]);
    client.cancel_pending_claim(&admin, &payment_id, &true);
}

#[test]
fn test_cancel_pending_claim_accounting_reversed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &soroban_sdk::String::from_str(&env, "treasury")));
    let client = VaultClient::new(&env, &contract_id);

    let user_wallet_id = env.register(
        UserWallet,
        (&backend, &contract_id, &usdc, &None::<Address>),
    );
    let user_wallet_client = UserWalletClient::new(&env, &user_wallet_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);

    let token_admin_client = token::StellarAssetClient::new(&env, &usdc);
    token_admin_client.mint(&user_wallet_id, &100_000_000);
    user_wallet_client.transfer_to_vault(&backend, &50_000_000);

    let payment_id = BytesN::from_array(&env, &[7u8; 32]);
    client.process_payment(&operator, &user_wallet_id, &50_000_000, &payment_id);

    assert!(client.verify_vault_accounting());

    client.cancel_pending_claim(&admin, &payment_id, &true);

    let (payments, fees, total) = client.get_available_withdrawal();
    assert_eq!(payments, 0);
    assert_eq!(fees, 0);
    assert_eq!(total, 0);
    assert!(client.verify_vault_accounting());
}

#[test]
fn test_transfer_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let from_username = soroban_sdk::String::from_str(&env, "alice");
    let to_username = soroban_sdk::String::from_str(&env, "bob");
    let treasury = soroban_sdk::String::from_str(&env, "treasury");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &treasury));
    let client = VaultClient::new(&env, &contract_id);

    // Set initial balances
    client.set_balance(&admin, &from_username, &100_000_000); // 100 USDC
    client.set_balance(&admin, &to_username, &0);
    client.set_balance(&admin, &treasury, &0);

    // Transfer 100 USDC
    // Fee = 100,000,000 * 50 / 10,000 = 500,000
    // Net = 99,500,000
    client.transfer(&from_username, &to_username, &100_000_000, &soroban_sdk::String::from_str(&env, "lunch"));

    // Verify balances
    assert_eq!(client.get_balance(&from_username), 0);
    assert_eq!(client.get_balance(&to_username), 99_500_000);
    assert_eq!(client.get_balance(&treasury), 500_000);
}

#[test]
fn test_transfer_self_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let username = soroban_sdk::String::from_str(&env, "alice");
    let treasury = soroban_sdk::String::from_str(&env, "treasury");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &treasury));
    let client = VaultClient::new(&env, &contract_id);

    let result = client.try_transfer(&username, &username, &100_000_000, &soroban_sdk::String::from_str(&env, "self"));
    assert_eq!(result, Err(Ok(crate::Error::SelfTransfer)));
}

#[test]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let from_username = soroban_sdk::String::from_str(&env, "alice");
    let to_username = soroban_sdk::String::from_str(&env, "bob");
    let treasury = soroban_sdk::String::from_str(&env, "treasury");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &treasury));
    let client = VaultClient::new(&env, &contract_id);

    client.set_balance(&admin, &from_username, &50_000_000);
    client.set_balance(&admin, &to_username, &0);

    let result = client.try_transfer(&from_username, &to_username, &100_000_000, &soroban_sdk::String::from_str(&env, "overspend"));
    assert_eq!(result, Err(Ok(crate::Error::InsufficientBalance)));
}

#[test]
fn test_transfer_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let from_username = soroban_sdk::String::from_str(&env, "alice");
    let to_username = soroban_sdk::String::from_str(&env, "bob");
    let treasury = soroban_sdk::String::from_str(&env, "treasury");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &treasury));
    let client = VaultClient::new(&env, &contract_id);

    client.pause(&admin);

    let result = client.try_transfer(&from_username, &to_username, &100_000_000, &soroban_sdk::String::from_str(&env, "paused"));
    assert_eq!(result, Err(Ok(crate::Error::ContractPaused)));
}

#[test]
fn test_transfer_user_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let from_username = soroban_sdk::String::from_str(&env, "alice");
    let to_username = soroban_sdk::String::from_str(&env, "bob");
    let treasury = soroban_sdk::String::from_str(&env, "treasury");

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128, &50i128, &treasury));
    let client = VaultClient::new(&env, &contract_id);

    // Bob doesn't exist (no balance set)
    client.set_balance(&admin, &from_username, &100_000_000);

    let result = client.try_transfer(&from_username, &to_username, &10_000_000, &soroban_sdk::String::from_str(&env, "missing bob"));
    assert_eq!(result, Err(Ok(crate::Error::UserNotFound)));
}
