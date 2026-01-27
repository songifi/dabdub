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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    assert!(!client.has_role(&user, &access_control::OPERATOR_ROLE));
}

#[test]
fn test_constructor() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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
        (&admin, &usdc, &10_000_000i128, &1_000_000i128), // Fee > MAX_FEE
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    client.grant_role(&admin, &operator, &access_control::OPERATOR_ROLE);
    client.pause(&admin);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.process_payment(&operator, &user_wallet, &50_000_000, &payment_id);
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    client.pause(&admin);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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
fn test_refund_payment_with_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let backend = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc = asset_contract.address();

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    client.set_fee(&admin, &1_000_000i128);
    assert_eq!(client.get_fee_amount(), 1_000_000);
}

#[test]
#[should_panic(expected = "Fee exceeds maximum")]
fn test_set_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    client.set_fee(&admin, &10_000_000i128);
}

#[test]
fn test_set_min_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    client.set_min_deposit(&admin, &2_000_000i128);
    assert_eq!(client.get_min_deposit(), 2_000_000);
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
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

    let contract_id = env.register(Vault, (&admin, &usdc, &500_000i128, &1_000_000i128));
    let client = VaultClient::new(&env, &contract_id);

    let payment_id = BytesN::from_array(&env, &[1u8; 32]);
    client.refund_payment(&admin, &user_wallet, &10_000_000, &false, &payment_id);
}
