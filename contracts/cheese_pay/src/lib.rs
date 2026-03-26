#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Address, Env, String};

mod storage;
use storage::{get_instance, get_persistent, set_persistent, DataKey};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    Unauthorized = 2,
    UsernameAlreadyRegistered = 3,
    UserAlreadyRegistered = 4,
}

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
}

#[cfg(test)]
mod tests {
    use super::storage::{get_instance, get_persistent, DataKey};
    use super::{CheesePay, Error};
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

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
}
