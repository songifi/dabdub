#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
};

const BALANCE_TTL_THRESHOLD: u32 = 518_400;
const BALANCE_TTL_EXTEND_TO: u32 = 1_036_800;
#[allow(dead_code)]
const PAYLINK_TTL_THRESHOLD: u32 = 103_680;
#[allow(dead_code)]
const PAYLINK_TTL_EXTEND_TO: u32 = 207_360;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    UsdcToken,
    FeeRateBps,
    FeeTreasury,
    Paused,
    UsernameToAddr(String),
    AddrToUsername(Address),
    Balance(String),
    StakeBalance(String),
    PayLink(String),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    UserNotFound = 1,
    AlreadyInitialized = 2,
    FeeTooHigh = 3,
}

#[contract]
pub struct UserLookupContract;

#[contractimpl]
impl UserLookupContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc_token: Address,
        fee_rate_bps: i128,
        fee_treasury: Address,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        if !(0..=500).contains(&fee_rate_bps) {
            return Err(ContractError::FeeTooHigh);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage()
            .instance()
            .set(&DataKey::FeeRateBps, &fee_rate_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeTreasury, &fee_treasury);
        env.storage().instance().set(&DataKey::Paused, &false);

        env.events()
            .publish((symbol_short!("inited"), admin), fee_rate_bps);

        Ok(())
    }

    pub fn get_address(env: Env, username: String) -> Result<Address, ContractError> {
        let key = DataKey::UsernameToAddr(username.clone());
        let address: Address = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::UserNotFound)?;

        bump_user_mapping_ttl(&env, &username, &address);

        Ok(address)
    }

    pub fn get_username(env: Env, address: Address) -> Result<String, ContractError> {
        let key = DataKey::AddrToUsername(address.clone());
        let username: String = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::UserNotFound)?;

        bump_user_mapping_ttl(&env, &username, &address);

        Ok(username)
    }

    pub fn get_balance(env: Env, username: String) -> Result<i128, ContractError> {
        let key = DataKey::Balance(username.clone());
        let balance = env.storage().persistent().get(&key).unwrap_or(0);

        bump_balance_ttl(&env, &username);

        Ok(balance)
    }

    pub fn get_stake_balance(env: Env, username: String) -> Result<i128, ContractError> {
        let key = DataKey::StakeBalance(username.clone());
        let stake_balance = env.storage().persistent().get(&key).unwrap_or(0);

        bump_balance_ttl(&env, &username);

        Ok(stake_balance)
    }
}

fn extend_if_present(env: &Env, key: &DataKey, threshold: u32, extend_to: u32) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, threshold, extend_to);
    }
}

fn bump_balance_ttl(env: &Env, username: &String) {
    let balance_key = DataKey::Balance(username.clone());
    let stake_balance_key = DataKey::StakeBalance(username.clone());

    extend_if_present(
        env,
        &balance_key,
        BALANCE_TTL_THRESHOLD,
        BALANCE_TTL_EXTEND_TO,
    );
    extend_if_present(
        env,
        &stake_balance_key,
        BALANCE_TTL_THRESHOLD,
        BALANCE_TTL_EXTEND_TO,
    );
}

#[allow(dead_code)]
fn bump_paylink_ttl(env: &Env, token_id: &String) {
    let paylink_key = DataKey::PayLink(token_id.clone());
    extend_if_present(
        env,
        &paylink_key,
        PAYLINK_TTL_THRESHOLD,
        PAYLINK_TTL_EXTEND_TO,
    );
}

fn bump_user_mapping_ttl(env: &Env, username: &String, address: &Address) {
    let username_to_addr_key = DataKey::UsernameToAddr(username.clone());
    let addr_to_username_key = DataKey::AddrToUsername(address.clone());

    extend_if_present(
        env,
        &username_to_addr_key,
        BALANCE_TTL_THRESHOLD,
        BALANCE_TTL_EXTEND_TO,
    );
    extend_if_present(
        env,
        &addr_to_username_key,
        BALANCE_TTL_THRESHOLD,
        BALANCE_TTL_EXTEND_TO,
    );
}

#[cfg(test)]
mod test {
    use super::{
        bump_paylink_ttl, ContractError, DataKey, UserLookupContract, BALANCE_TTL_EXTEND_TO,
        BALANCE_TTL_THRESHOLD, PAYLINK_TTL_EXTEND_TO,
    };
    use soroban_sdk::{
        testutils::storage::Persistent as _, testutils::Address as _, testutils::Ledger as _,
        Address, Env, String,
    };

    #[test]
    fn get_address_reads_existing_user_and_bumps_ttl() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let username = String::from_str(&env, "alice");
        let address = Address::generate(&env);
        let key = DataKey::UsernameToAddr(username.clone());

        env.as_contract(&contract_id, || {
            env.storage().persistent().set(&key, &address);
        });

        let before_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));
        let result = env.as_contract(&contract_id, || {
            UserLookupContract::get_address(env.clone(), username.clone())
        });
        let after_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));

        assert_eq!(result, Ok(address));
        assert!(after_ttl >= before_ttl);
    }

    #[test]
    fn get_address_for_non_existent_user_returns_not_found() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());
        let username = String::from_str(&env, "missing");

        let result = env.as_contract(&contract_id, || {
            UserLookupContract::get_address(env.clone(), username.clone())
        });
        assert_eq!(result, Err(ContractError::UserNotFound));
    }

    #[test]
    fn get_username_reads_existing_user_and_bumps_ttl() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let username = String::from_str(&env, "bob");
        let address = Address::generate(&env);
        let key = DataKey::AddrToUsername(address.clone());

        env.as_contract(&contract_id, || {
            env.storage().persistent().set(&key, &username);
        });

        let before_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));
        let result = env.as_contract(&contract_id, || {
            UserLookupContract::get_username(env.clone(), address.clone())
        });
        let after_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));

        assert_eq!(result, Ok(username));
        assert!(after_ttl >= before_ttl);
    }

    #[test]
    fn get_username_for_non_existent_user_returns_not_found() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());
        let address = Address::generate(&env);

        let result = env.as_contract(&contract_id, || {
            UserLookupContract::get_username(env.clone(), address.clone())
        });
        assert_eq!(result, Err(ContractError::UserNotFound));
    }

    #[test]
    fn get_balance_defaults_to_zero_and_bumps_ttl_when_present() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let existing_username = String::from_str(&env, "carol");
        let key = DataKey::Balance(existing_username.clone());
        let existing_value: i128 = 500;

        env.as_contract(&contract_id, || {
            env.storage().persistent().set(&key, &existing_value);
        });

        let before_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));
        let existing_result = env.as_contract(&contract_id, || {
            UserLookupContract::get_balance(env.clone(), existing_username.clone())
        });
        let after_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));
        let missing_result = env.as_contract(&contract_id, || {
            UserLookupContract::get_balance(env.clone(), String::from_str(&env, "nobody"))
        });

        assert_eq!(existing_result, Ok(existing_value));
        assert_eq!(missing_result, Ok(0));
        assert!(after_ttl >= before_ttl);
    }

    #[test]
    fn get_stake_balance_defaults_to_zero_and_bumps_ttl_when_present() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let existing_username = String::from_str(&env, "dave");
        let key = DataKey::StakeBalance(existing_username.clone());
        let existing_value: i128 = 42;

        env.as_contract(&contract_id, || {
            env.storage().persistent().set(&key, &existing_value);
        });

        let before_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));
        let existing_result = env.as_contract(&contract_id, || {
            UserLookupContract::get_stake_balance(env.clone(), existing_username.clone())
        });
        let after_ttl = env.as_contract(&contract_id, || env.storage().persistent().get_ttl(&key));
        let missing_result = env.as_contract(&contract_id, || {
            UserLookupContract::get_stake_balance(env.clone(), String::from_str(&env, "nobody"))
        });

        assert_eq!(existing_result, Ok(existing_value));
        assert_eq!(missing_result, Ok(0));
        assert!(after_ttl >= before_ttl);
    }

    #[test]
    fn write_balance_advance_ledger_then_bump_extends_ttl() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let username = String::from_str(&env, "erin");
        let balance_key = DataKey::Balance(username.clone());
        let balance_value: i128 = 777;

        env.as_contract(&contract_id, || {
            env.storage().persistent().set(&balance_key, &balance_value);
            // Ensure key starts above threshold, then we can age below threshold.
            env.storage().persistent().extend_ttl(
                &balance_key,
                BALANCE_TTL_EXTEND_TO,
                BALANCE_TTL_EXTEND_TO,
            );
            env.storage()
                .instance()
                .extend_ttl(BALANCE_TTL_EXTEND_TO, BALANCE_TTL_EXTEND_TO);
        });

        env.ledger().with_mut(|li| {
            li.sequence_number = li
                .sequence_number
                .saturating_add(BALANCE_TTL_THRESHOLD.saturating_add(1));
        });

        let ttl_before_bump = env.as_contract(&contract_id, || {
            env.storage().persistent().get_ttl(&balance_key)
        });
        assert!(ttl_before_bump < BALANCE_TTL_THRESHOLD);

        let result = env.as_contract(&contract_id, || {
            UserLookupContract::get_balance(env.clone(), username.clone())
        });
        let ttl_after_bump = env.as_contract(&contract_id, || {
            env.storage().persistent().get_ttl(&balance_key)
        });

        assert_eq!(result, Ok(balance_value));
        assert!(ttl_after_bump > ttl_before_bump);
        assert!(ttl_after_bump >= BALANCE_TTL_EXTEND_TO.saturating_sub(1));
    }

    #[test]
    fn bump_paylink_ttl_extends_paylink_key() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let token_id = String::from_str(&env, "pl_001");
        let paylink_key = DataKey::PayLink(token_id.clone());
        let payload = String::from_str(&env, "paylink");

        env.as_contract(&contract_id, || {
            env.storage().persistent().set(&paylink_key, &payload);
        });

        let before_ttl = env.as_contract(&contract_id, || {
            env.storage().persistent().get_ttl(&paylink_key)
        });

        env.as_contract(&contract_id, || {
            bump_paylink_ttl(&env, &token_id);
        });

        let after_ttl = env.as_contract(&contract_id, || {
            env.storage().persistent().get_ttl(&paylink_key)
        });

        assert!(after_ttl >= before_ttl);
        assert!(after_ttl >= PAYLINK_TTL_EXTEND_TO.saturating_sub(1));
    }

    #[test]
    fn initialize_writes_instance_keys_and_rejects_second_call() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let admin = Address::generate(&env);
        let usdc_token = Address::generate(&env);
        let fee_treasury = Address::generate(&env);
        let fee_rate_bps: i128 = 25;

        let first = env.as_contract(&contract_id, || {
            UserLookupContract::initialize(
                env.clone(),
                admin.clone(),
                usdc_token.clone(),
                fee_rate_bps,
                fee_treasury.clone(),
            )
        });
        assert_eq!(first, Ok(()));

        env.as_contract(&contract_id, || {
            let stored_admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
            let stored_usdc_token: Option<Address> =
                env.storage().instance().get(&DataKey::UsdcToken);
            let stored_fee_rate_bps: Option<i128> =
                env.storage().instance().get(&DataKey::FeeRateBps);
            let stored_fee_treasury: Option<Address> =
                env.storage().instance().get(&DataKey::FeeTreasury);
            let stored_paused: Option<bool> = env.storage().instance().get(&DataKey::Paused);

            assert_eq!(stored_admin, Some(admin.clone()));
            assert_eq!(stored_usdc_token, Some(usdc_token.clone()));
            assert_eq!(stored_fee_rate_bps, Some(fee_rate_bps));
            assert_eq!(stored_fee_treasury, Some(fee_treasury.clone()));
            assert_eq!(stored_paused, Some(false));
        });

        let second = env.as_contract(&contract_id, || {
            UserLookupContract::initialize(
                env.clone(),
                admin.clone(),
                usdc_token.clone(),
                fee_rate_bps,
                fee_treasury.clone(),
            )
        });
        assert_eq!(second, Err(ContractError::AlreadyInitialized));
    }

    #[test]
    fn initialize_rejects_fee_rate_above_500() {
        let env = Env::default();
        let contract_id = env.register(UserLookupContract, ());

        let result = env.as_contract(&contract_id, || {
            UserLookupContract::initialize(
                env.clone(),
                Address::generate(&env),
                Address::generate(&env),
                501,
                Address::generate(&env),
            )
        });
        assert_eq!(result, Err(ContractError::FeeTooHigh));

        env.as_contract(&contract_id, || {
            let stored_admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
            assert_eq!(stored_admin, None);
        });
    }
}
