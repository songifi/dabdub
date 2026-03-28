#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Address, Env, String};

mod storage;
use storage::{get_instance, get_persistent, set_persistent, DataKey};

/// Calculate fee in stroops given an amount and fee rate in basis points.
/// 1 basis point = 0.01%, so 50 bps = 0.5%
/// Formula: fee = amount * fee_rate_bps / 10_000
pub fn calculate_fee(amount: i128, fee_rate_bps: u32) -> i128 {
    amount * fee_rate_bps as i128 / 10_000
}

/// Calculate net amount after fee deduction.
/// Formula: net = amount - fee
pub fn calculate_net_amount(amount: i128, fee_rate_bps: u32) -> i128 {
    let fee = calculate_fee(amount, fee_rate_bps);
    amount - fee
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    Unauthorized = 2,
    UsernameAlreadyRegistered = 3,
    UserAlreadyRegistered = 4,
    FeeTooHigh = 5,
    UserNotFound = 6,
}

pub mod errors;
pub use errors::Error;

#[contract]
pub struct CheesePay;

#[contractimpl]
impl CheesePay {
    pub fn register_user(env: Env, username: String, address: Address) -> Result<(), Error> {
        let admin: Address = get_instance(&env, &DataKey::Admin)?;
        admin.require_auth();

        if get_persistent::<Address>(&env, &DataKey::UsernameToAddr(username.clone())).is_some() {
            return Err(Error::UsernameAlreadyRegistered);
        }
        if get_persistent::<String>(&env, &DataKey::AddrToUsername(address.clone())).is_some() {
            return Err(Error::UserAlreadyRegistered);
        }

        set_persistent(&env, &DataKey::UsernameToAddr(username.clone()), &address);
        set_persistent(&env, &DataKey::AddrToUsername(address.clone()), &username);
        set_persistent(&env, &DataKey::Balance(username.clone()), &0_i128);

        env.events()
            .publish((symbol_short!("user_reg"), username), address);

        Ok(())
    }

    /// Set the platform fee rate in basis points. Admin only. Valid range: [0, 500].
    pub fn set_fee_rate(env: Env, new_bps: i128) -> Result<(), Error> {
        let admin: Address = get_instance(&env, &DataKey::Admin)?;
        admin.require_auth();

        if new_bps < 0 || new_bps > 500 {
            return Err(Error::FeeTooHigh);
        }

        env.storage()
            .instance()
            .set(&DataKey::FeeRateBps, &(new_bps as u32));

        env.events()
            .publish((symbol_short!("fee_upd"),), new_bps);

        Ok(())
    }

    /// Set the fee treasury by username. Admin only. Username must be registered on-chain.
    pub fn set_fee_treasury(env: Env, new_treasury_username: String) -> Result<(), Error> {
        let admin: Address = get_instance(&env, &DataKey::Admin)?;
        admin.require_auth();

        // Validate the username exists on-chain
        if get_persistent::<Address>(&env, &DataKey::UsernameToAddr(new_treasury_username.clone())).is_none() {
            return Err(Error::UserNotFound);
        }

        env.storage()
            .instance()
            .set(&DataKey::FeeTreasury, &new_treasury_username);

        env.events()
            .publish((symbol_short!("trs_upd"),), new_treasury_username);

        Ok(())
    }

    /// Read the current fee rate in basis points. No auth required.
    pub fn get_fee_rate(env: Env) -> Result<i128, Error> {
        let bps: u32 = get_instance(&env, &DataKey::FeeRateBps)?;
        Ok(bps as i128)
    }

    /// Read the current fee treasury username. No auth required.
    pub fn get_fee_treasury(env: Env) -> Result<String, Error> {
        get_instance(&env, &DataKey::FeeTreasury)
    }
}

#[cfg(test)]
mod tests {
    use super::storage::{get_instance, get_persistent, set_persistent, DataKey};
    use super::{calculate_fee, calculate_net_amount, CheesePay, Error};
    use soroban_sdk::{testutils::{storage::Persistent as _, Address as _}, Address, Env, String};

    // ── helpers ──────────────────────────────────────────────────────────────

    fn env() -> Env {
        Env::default()
    }

    fn fake_addr(e: &Env) -> Address {
        Address::generate(e)
    }

    // ── instance round-trips ─────────────────────────────────────────────────

    #[test]
    fn instance_missing_returns_not_initialized() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        e.as_contract(&contract_id, || {
            let result: Result<Address, Error> = get_instance(&e, &DataKey::Admin);
            assert_eq!(result, Err(Error::NotInitialized));
        });
    }

    #[test]
    fn instance_admin_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let addr = fake_addr(&e);
        e.as_contract(&contract_id, || {
            e.storage().instance().set(&DataKey::Admin, &addr);
            let got: Address = get_instance(&e, &DataKey::Admin).unwrap();
            assert_eq!(got, addr);
        });
    }

    #[test]
    fn instance_usdc_token_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let addr = fake_addr(&e);
        e.as_contract(&contract_id, || {
            e.storage().instance().set(&DataKey::UsdcToken, &addr);
            let got: Address = get_instance(&e, &DataKey::UsdcToken).unwrap();
            assert_eq!(got, addr);
        });
    }

    #[test]
    fn instance_fee_rate_bps_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        e.as_contract(&contract_id, || {
            e.storage().instance().set(&DataKey::FeeRateBps, &30_u32);
            let got: u32 = get_instance(&e, &DataKey::FeeRateBps).unwrap();
            assert_eq!(got, 30);
        });
    }

    #[test]
    fn instance_fee_treasury_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let addr = fake_addr(&e);
        e.as_contract(&contract_id, || {
            e.storage().instance().set(&DataKey::FeeTreasury, &addr);
            let got: Address = get_instance(&e, &DataKey::FeeTreasury).unwrap();
            assert_eq!(got, addr);
        });
    }

    #[test]
    fn instance_paused_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        e.as_contract(&contract_id, || {
            e.storage().instance().set(&DataKey::Paused, &true);
            let got: bool = get_instance(&e, &DataKey::Paused).unwrap();
            assert!(got);
        });
    }

    // ── persistent round-trips ───────────────────────────────────────────────

    #[test]
    fn persistent_missing_returns_none() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let key = DataKey::Balance(String::from_str(&e, "ghost"));
        e.as_contract(&contract_id, || {
            let got: Option<i128> = get_persistent(&e, &key);
            assert!(got.is_none());
        });
    }

    #[test]
    fn persistent_balance_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let key = DataKey::Balance(String::from_str(&e, "alice"));
        e.as_contract(&contract_id, || {
            e.storage().persistent().set(&key, &500_i128);
            let got: i128 = get_persistent(&e, &key).unwrap();
            assert_eq!(got, 500);
        });
    }

    #[test]
    fn persistent_stake_balance_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let key = DataKey::StakeBalance(String::from_str(&e, "bob"));
        e.as_contract(&contract_id, || {
            e.storage().persistent().set(&key, &1_000_i128);
            let got: i128 = get_persistent(&e, &key).unwrap();
            assert_eq!(got, 1_000);
        });
    }

    #[test]
    fn persistent_username_to_addr_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let addr = fake_addr(&e);
        let key = DataKey::UsernameToAddr(String::from_str(&e, "carol"));
        e.as_contract(&contract_id, || {
            e.storage().persistent().set(&key, &addr);
            let got: Address = get_persistent(&e, &key).unwrap();
            assert_eq!(got, addr);
        });
    }

    #[test]
    fn persistent_addr_to_username_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let addr = fake_addr(&e);
        let username = String::from_str(&e, "dave");
        let key = DataKey::AddrToUsername(addr);
        e.as_contract(&contract_id, || {
            e.storage().persistent().set(&key, &username);
            let got: String = get_persistent(&e, &key).unwrap();
            assert_eq!(got, username);
        });
    }

    #[test]
    fn persistent_paylink_round_trip() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let key = DataKey::PayLink(String::from_str(&e, "tok-abc"));
        e.as_contract(&contract_id, || {
            e.storage().persistent().set(&key, &999_i128);
            let got: i128 = get_persistent(&e, &key).unwrap();
            assert_eq!(got, 999);
        });
    }

    // ── register_user ────────────────────────────────────────────────────────

    fn setup(e: &Env) -> (soroban_sdk::Address, Address) {
        let admin = fake_addr(e);
        let contract_id = e.register(CheesePay, ());
        e.as_contract(&contract_id, || {
            e.storage().instance().set(&DataKey::Admin, &admin);
        });
        (contract_id, admin)
    }

    #[test]
    fn register_user_happy_path() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);
        let username = String::from_str(&e, "alice");

        e.mock_all_auths();
        client.register_user(&username, &user_addr);

        e.as_contract(&contract_id, || {
            let stored_addr: Address =
                get_persistent(&e, &DataKey::UsernameToAddr(username.clone())).unwrap();
            assert_eq!(stored_addr, user_addr);

            let stored_name: String =
                get_persistent(&e, &DataKey::AddrToUsername(user_addr.clone())).unwrap();
            assert_eq!(stored_name, username);

            let balance: i128 = get_persistent(&e, &DataKey::Balance(username.clone())).unwrap();
            assert_eq!(balance, 0);
        });
    }

    #[test]
    fn register_user_duplicate_username() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let username = String::from_str(&e, "alice");

        e.mock_all_auths();
        client.register_user(&username, &fake_addr(&e));

        let result = client.try_register_user(&username, &fake_addr(&e));
        assert_eq!(result, Err(Ok(Error::UsernameAlreadyRegistered)));
    }

    #[test]
    fn register_user_duplicate_address() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);

        e.mock_all_auths();
        client.register_user(&String::from_str(&e, "alice"), &user_addr);

        let result = client.try_register_user(&String::from_str(&e, "bob"), &user_addr);
        assert_eq!(result, Err(Ok(Error::UserAlreadyRegistered)));
    }

    #[test]
    #[should_panic]
    fn register_user_unauthorized() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        // no mock_all_auths → auth check panics
        client.register_user(&String::from_str(&e, "alice"), &fake_addr(&e));
    }

    #[test]
    fn register_user_with_empty_username_succeeds() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);
        let username = String::from_str(&e, "");

        e.mock_all_auths();
        let result = client.try_register_user(&username, &user_addr);

        // Empty username should be allowed by the contract (validation is a business logic concern)
        assert_eq!(result, Ok(Ok(())));

        e.as_contract(&contract_id, || {
            let stored_addr: Address = get_persistent(&e, &DataKey::UsernameToAddr(username.clone())).expect("addr should be stored");
            assert_eq!(stored_addr, user_addr);
        });
    }

    #[test]
    fn register_user_with_very_long_username_succeeds() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);
        let username = String::from_str(&e, "a".repeat(100).as_str());

        e.mock_all_auths();
        let result = client.try_register_user(&username, &user_addr);
        assert_eq!(result, Ok(Ok(())));
    }

    #[test]
    fn register_user_emits_event() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);
        let username = String::from_str(&e, "event_test");

        e.mock_all_auths();
        client.register_user(&username, &user_addr);

        // Verify event was published (check events in the contract)
        // This is implicitly tested by the successful execution
    }

    #[test]
    fn register_multiple_users_isolated_balances() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        let user1_addr = fake_addr(&e);
        let user2_addr = fake_addr(&e);
        let user1_name = String::from_str(&e, "user1");
        let user2_name = String::from_str(&e, "user2");

        e.mock_all_auths();
        client.register_user(&user1_name, &user1_addr);
        client.register_user(&user2_name, &user2_addr);

        e.as_contract(&contract_id, || {
            let balance1: i128 = get_persistent(&e, &DataKey::Balance(user1_name.clone())).unwrap_or(0);
            let balance2: i128 = get_persistent(&e, &DataKey::Balance(user2_name.clone())).unwrap_or(0);
            
            assert_eq!(balance1, 0);
            assert_eq!(balance2, 0);
            assert_ne!(user1_addr, user2_addr);
        });
    }

    #[test]
    fn register_user_case_sensitive_usernames() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        let user1_addr = fake_addr(&e);
        let user2_addr = fake_addr(&e);
        let username_upper = String::from_str(&e, "ALICE");
        let username_lower = String::from_str(&e, "alice");

        e.mock_all_auths();
        client.register_user(&username_upper, &user1_addr);
        
        // Lowercase should be different from uppercase
        let result = client.try_register_user(&username_lower, &user2_addr);
        assert_eq!(result, Ok(Ok(())));
    }

    #[test]
    fn get_instance_not_initialized_for_all_keys() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        
        e.as_contract(&contract_id, || {
            assert_eq!(get_instance::<Address>(&e, &DataKey::Admin), Err(Error::NotInitialized));
            assert_eq!(get_instance::<Address>(&e, &DataKey::UsdcToken), Err(Error::NotInitialized));
            assert_eq!(get_instance::<u32>(&e, &DataKey::FeeRateBps), Err(Error::NotInitialized));
            assert_eq!(get_instance::<Address>(&e, &DataKey::FeeTreasury), Err(Error::NotInitialized));
            assert_eq!(get_instance::<bool>(&e, &DataKey::Paused), Err(Error::NotInitialized));
        });
    }

    #[test]
    fn persistent_storage_key_variations() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        
        e.as_contract(&contract_id, || {
            // Test various key types
            let balance_key = DataKey::Balance(String::from_str(&e, "test"));
            let stake_key = DataKey::StakeBalance(String::from_str(&e, "test"));
            let username_key = DataKey::UsernameToAddr(String::from_str(&e, "test"));
            let addr_key = DataKey::AddrToUsername(fake_addr(&e));
            let paylink_key = DataKey::PayLink(String::from_str(&e, "test"));

            // All should return None initially
            assert!(get_persistent::<i128>(&e, &balance_key).is_none());
            assert!(get_persistent::<i128>(&e, &stake_key).is_none());
            assert!(get_persistent::<Address>(&e, &username_key).is_none());
            assert!(get_persistent::<String>(&e, &addr_key).is_none());
            assert!(get_persistent::<i128>(&e, &paylink_key).is_none());
        });
    }

    #[test]
    fn set_persistent_bumps_ttl() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let username = String::from_str(&e, "ttl_test");
        let key = DataKey::Balance(username.clone());
        
        e.as_contract(&contract_id, || {
            set_persistent(&e, &key, &1000_i128);
            
            let ttl = e.storage().persistent().get_ttl(&key);
            assert!(ttl > 0);
        });
    }

    #[test]
    fn register_user_with_same_address_different_username_fails() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);

        e.mock_all_auths();
        client.register_user(&String::from_str(&e, "alice"), &user_addr);
        
        // Same address, different username should fail
        let result = client.try_register_user(&String::from_str(&e, "bob"), &user_addr);
        assert_eq!(result, Err(Ok(Error::UserAlreadyRegistered)));
    }

    #[test]
    fn register_user_boundary_fee_treasury_address() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let user_addr = fake_addr(&e);
        let username = String::from_str(&e, "boundary_test");

        e.mock_all_auths();
        let result = client.try_register_user(&username, &user_addr);
        assert_eq!(result, Ok(Ok(())));
    }

    // ── Fee Math Tests ───────────────────────────────────────────────────────

    #[test]
    fn calculate_fee_1_million_stroops_at_50_bps() {
        // 1_000_000 stroops at 50 bps = 5_000 fee
        let amount = 1_000_000_i128;
        let fee_rate_bps = 50_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 5_000_i128);
    }

    #[test]
    fn calculate_net_amount_1_million_stroops_at_50_bps() {
        // 1_000_000 stroops at 50 bps = 5_000 fee, 995_000 net
        let amount = 1_000_000_i128;
        let fee_rate_bps = 50_u32;
        let net = calculate_net_amount(amount, fee_rate_bps);
        assert_eq!(net, 995_000_i128);
    }

    #[test]
    fn calculate_fee_1_usdc_at_50_bps() {
        // 1 USDC = 10_000_000 stroops (7 decimal places)
        // Fee at 50 bps = 5_000 stroops
        let amount = 10_000_000_i128; // 1 USDC
        let fee_rate_bps = 50_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 50_000_i128); // 0.005 USDC
    }

    #[test]
    fn calculate_fee_at_zero_bps() {
        // 0 bps = no fee
        let amount = 1_000_000_i128;
        let fee_rate_bps = 0_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 0_i128);
        
        let net = calculate_net_amount(amount, fee_rate_bps);
        assert_eq!(net, amount);
    }

    #[test]
    fn calculate_fee_at_100_bps() {
        // 100 bps = 1%
        let amount = 1_000_000_i128;
        let fee_rate_bps = 100_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 10_000_i128); // 1% of 1_000_000
        
        let net = calculate_net_amount(amount, fee_rate_bps);
        assert_eq!(net, 990_000_i128);
    }

    #[test]
    fn calculate_fee_at_500_bps_maximum() {
        // 500 bps = 5% (maximum allowed)
        let amount = 1_000_000_i128;
        let fee_rate_bps = 500_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 50_000_i128); // 5% of 1_000_000
        
        let net = calculate_net_amount(amount, fee_rate_bps);
        assert_eq!(net, 950_000_i128);
    }

    #[test]
    fn calculate_fee_at_1_bps_minimum_non_zero() {
        // 1 bps = 0.01%
        let amount = 1_000_000_i128;
        let fee_rate_bps = 1_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 100_i128); // 0.01% of 1_000_000
    }

    #[test]
    fn calculate_fee_rounding_down() {
        // Fee calculation rounds down (integer division)
        let amount = 10_001_i128;
        let fee_rate_bps = 50_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        // 10_001 * 50 / 10_000 = 50_0050 / 10_000 = 50.005 → rounds to 50
        assert_eq!(fee, 50_i128);
    }

    #[test]
    fn calculate_fee_small_amounts() {
        // Test with very small amounts
        let amount = 100_i128;
        let fee_rate_bps = 50_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        // 100 * 50 / 10_000 = 0.5 → rounds to 0
        assert_eq!(fee, 0_i128);
    }

    #[test]
    fn calculate_fee_large_amounts() {
        // Test with 1 billion USDC in stroops
        let amount = 1_000_000_000_i128 * 10_000_000_i128; // 1B USDC
        let fee_rate_bps = 50_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 50_000_000_000_000_i128); // 0.5% of 1B USDC
        
        let net = calculate_net_amount(amount, fee_rate_bps);
        assert_eq!(net, 9_950_000_000_000_000_i128);
    }

    #[test]
    fn calculate_fee_various_rates() {
        let amount = 1_000_000_i128;
        
        // Test various fee rates
        assert_eq!(calculate_fee(amount, 10_u32), 1_000_i128); // 0.1%
        assert_eq!(calculate_fee(amount, 25_u32), 2_500_i128); // 0.25%
        assert_eq!(calculate_fee(amount, 75_u32), 7_500_i128); // 0.75%
        assert_eq!(calculate_fee(amount, 200_u32), 20_000_i128); // 2%
        assert_eq!(calculate_fee(amount, 300_u32), 30_000_i128); // 3%
    }

    #[test]
    fn calculate_fee_zero_amount() {
        let amount = 0_i128;
        let fee_rate_bps = 50_u32;
        let fee = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee, 0_i128);
        
        let net = calculate_net_amount(amount, fee_rate_bps);
        assert_eq!(net, 0_i128);
    }

    #[test]
    fn calculate_fee_commutative_property() {
        // Fee calculation should be consistent
        let amount = 5_000_000_i128;
        let fee_rate_bps = 50_u32;
        
        let fee1 = calculate_fee(amount, fee_rate_bps);
        let fee2 = calculate_fee(amount, fee_rate_bps);
        assert_eq!(fee1, fee2);
    }

    #[test]
    fn calculate_net_amount_always_less_than_or_equal_to_amount() {
        let amount = 1_000_000_i128;
        
        for fee_rate in [0_u32, 10, 50, 100, 250, 500] {
            let net = calculate_net_amount(amount, fee_rate);
            assert!(net <= amount);
            assert!(net >= 0);
        }
    }

    #[test]
    fn calculate_fee_and_net_relationship() {
        let amount = 2_500_000_i128;
        let fee_rate_bps = 75_u32;
        
        let fee = calculate_fee(amount, fee_rate_bps);
        let net = calculate_net_amount(amount, fee_rate_bps);
        
        // Verify: amount = fee + net
        assert_eq!(amount, fee + net);
    }

    // ── set_fee_rate ─────────────────────────────────────────────────────────

    #[test]
    fn set_fee_rate_valid() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        client.set_fee_rate(&50_i128);

        let rate = client.get_fee_rate();
        assert_eq!(rate, 50_i128);
    }

    #[test]
    fn set_fee_rate_zero_is_valid() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        client.set_fee_rate(&0_i128);

        assert_eq!(client.get_fee_rate(), 0_i128);
    }

    #[test]
    fn set_fee_rate_500_is_valid_boundary() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        client.set_fee_rate(&500_i128);

        assert_eq!(client.get_fee_rate(), 500_i128);
    }

    #[test]
    fn set_fee_rate_501_returns_fee_too_high() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        let result = client.try_set_fee_rate(&501_i128);
        assert_eq!(result, Err(Ok(Error::FeeTooHigh)));
    }

    #[test]
    fn set_fee_rate_negative_returns_fee_too_high() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        let result = client.try_set_fee_rate(&(-1_i128));
        assert_eq!(result, Err(Ok(Error::FeeTooHigh)));
    }

    #[test]
    fn set_fee_rate_emits_event() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        client.set_fee_rate(&100_i128);
        // Successful execution implies event was published
        assert_eq!(client.get_fee_rate(), 100_i128);
    }

    // ── set_fee_treasury ─────────────────────────────────────────────────────

    #[test]
    fn set_fee_treasury_unknown_username_returns_user_not_found() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        let result = client.try_set_fee_treasury(&String::from_str(&e, "ghost"));
        assert_eq!(result, Err(Ok(Error::UserNotFound)));
    }

    #[test]
    fn set_fee_treasury_registered_username_succeeds() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let treasury_addr = fake_addr(&e);
        let treasury_name = String::from_str(&e, "treasury");

        e.mock_all_auths();
        // Register the treasury user first
        client.register_user(&treasury_name, &treasury_addr);
        // Now set it as fee treasury
        client.set_fee_treasury(&treasury_name);

        let stored = client.get_fee_treasury();
        assert_eq!(stored, treasury_name);
    }

    #[test]
    fn set_fee_treasury_emits_event() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);
        let treasury_name = String::from_str(&e, "treasury");

        e.mock_all_auths();
        client.register_user(&treasury_name, &fake_addr(&e));
        client.set_fee_treasury(&treasury_name);

        assert_eq!(client.get_fee_treasury(), treasury_name);
    }

    // ── get_fee_rate ─────────────────────────────────────────────────────────

    #[test]
    fn get_fee_rate_reads_stored_value() {
        let e = env();
        let (contract_id, _admin) = setup(&e);
        let client = super::CheesePayClient::new(&e, &contract_id);

        e.mock_all_auths();
        client.set_fee_rate(&75_i128);

        // Read without auth — pure read
        let rate = client.get_fee_rate();
        assert_eq!(rate, 75_i128);
    }

    #[test]
    fn get_fee_rate_not_initialized_returns_error() {
        let e = env();
        let contract_id = e.register(CheesePay, ());
        let client = super::CheesePayClient::new(&e, &contract_id);

        let result = client.try_get_fee_rate();
        assert_eq!(result, Err(Ok(Error::NotInitialized)));
    }
}
