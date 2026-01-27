use soroban_sdk::{token, Address, Env};

/// Get token balance for an account
#[allow(dead_code)]
pub fn get_token_balance(env: &Env, token_address: &Address, account: &Address) -> i128 {
    let client = token::Client::new(env, token_address);
    client.balance(account)
}

/// Transfer tokens from one account to another
#[allow(dead_code)]
pub fn transfer_token(
    env: &Env,
    token_address: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) {
    let client = token::Client::new(env, token_address);
    client.transfer(from, to, &amount);
}

/// Check if an account has sufficient balance
#[allow(dead_code)]
pub fn has_sufficient_balance(
    env: &Env,
    token_address: &Address,
    account: &Address,
    required_amount: i128,
) -> bool {
    let balance = get_token_balance(env, token_address, account);
    balance >= required_amount
}

/// Approve spender to spend tokens on behalf of owner
#[allow(dead_code)]
pub fn approve_token(
    env: &Env,
    token_address: &Address,
    from: &Address,
    spender: &Address,
    amount: i128,
    expiration_ledger: u32,
) {
    let client = token::Client::new(env, token_address);
    client.approve(from, spender, &amount, &expiration_ledger);
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token, Address, Env};

    #[test]
    fn test_token_transfer() {
        let env = Env::default();
        env.mock_all_auths();

        // Register a test token (simulating USDC)
        let token_admin = Address::generate(&env);
        let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = asset_contract.address();

        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        // Mint some tokens to user1 (simulating USDC with 7 decimals)
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        token_admin_client.mint(&user1, &1000_0000000); // 1000 USDC (7 decimals)

        // Get token client
        let token_client = token::Client::new(&env, &token_address);

        // Check initial balance
        let balance = token_client.balance(&user1);
        assert_eq!(balance, 1000_0000000);

        // Transfer tokens
        token_client.transfer(&user1, &user2, &100_0000000); // 100 USDC

        // Verify balances after transfer
        assert_eq!(token_client.balance(&user1), 900_0000000);
        assert_eq!(token_client.balance(&user2), 100_0000000);
    }

    #[test]
    fn test_token_balance_check() {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let user = Address::generate(&env);
        let token_address = asset_contract.address();

        // Mint tokens
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        token_admin_client.mint(&user, &500_0000000); // 500 USDC

        // Check balance using helper
        let balance = get_token_balance(&env, &token_address, &user);
        assert_eq!(balance, 500_0000000);
    }

    #[test]
    fn test_has_sufficient_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = asset_contract.address();
        let user = Address::generate(&env);

        // Mint only 100 USDC
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        token_admin_client.mint(&user, &100_0000000);

        // Check if user has enough for 50 USDC payment - should be true
        let has_enough = has_sufficient_balance(&env, &token_address, &user, 50_0000000);
        assert!(has_enough);

        // Check if user has enough for 200 USDC payment - should be false
        let has_enough = has_sufficient_balance(&env, &token_address, &user, 200_0000000);
        assert!(!has_enough);
    }

    #[test]
    fn test_token_transfer_using_helper() {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = asset_contract.address();
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        // Mint tokens
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        token_admin_client.mint(&user1, &1000_0000000);

        // Transfer using helper
        transfer_token(&env, &token_address, &user1, &user2, 250_0000000);

        // Verify
        let balance1 = get_token_balance(&env, &token_address, &user1);
        let balance2 = get_token_balance(&env, &token_address, &user2);

        assert_eq!(balance1, 750_0000000);
        assert_eq!(balance2, 250_0000000);
    }

    #[test]
    #[should_panic(expected = "balance is not sufficient to spend")]
    fn test_transfer_insufficient_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let asset_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_address = asset_contract.address();
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        // Mint only 50 USDC
        let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
        token_admin_client.mint(&user1, &50_0000000);

        // Try to transfer 100 USDC (should panic)
        transfer_token(&env, &token_address, &user1, &user2, 100_0000000);
    }
}
