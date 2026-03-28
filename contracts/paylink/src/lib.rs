#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol,
};

/// Extra ledgers beyond `ttl_ledgers` so persistent PayLink data remains readable until
/// after the logical expiry ledger (archival buffer).
const PAYLINK_TTL_BUFFER_LEDGERS: u32 = 16_384;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Creator(String),
    PayLink(String),
    Admin,
    Balance(String),
    StakeBalance(String),
    Paused,
    Paused,
    StakeBalance(String),
    Balance(String),
    FeeRateBps,
    FeeTreasury,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayLinkData {
    pub creator_username: String,
    /// USDC amount in stroops (1 USDC = 10_000_000 stroops, 7 decimal places).
    pub amount: i128,
    pub note: String,
    pub expiration_ledger: u32,
    /// Enforces single-payment: set to true once the PayLink is claimed/settled.
    pub paid: bool,
    pub cancelled: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    PayLinkAlreadyExists = 1,
    InvalidAmount = 2,
    CreatorNotFound = 3,
    LedgerOverflow = 4,
    Unauthorized = 5,
    UserNotFound = 6,
    ContractPaused = 7,
    InsufficientBalance = 8,
    PayLinkNotFound = 9,
    NotPayLinkCreator = 10,
    PayLinkAlreadyPaid = 11,
    PayLinkNotFound = 5,
    NotPayLinkCreator = 6,
    PayLinkAlreadyPaid = 7,
    Unauthorized = 8,
    UserNotFound = 9,
    ContractPaused = 10,
    PayLinkCancelled = 11,
    PayLinkExpired = 12,
    InsufficientBalance = 13,
}

#[contract]
pub struct PayLinkContract;

#[contractimpl]
impl PayLinkContract {
    /// One-time admin initialisation. Panics if already set.
    pub fn set_admin(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("admin already set");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Marks `username` as an existing creator so `create_paylink` may succeed.
    /// Intended to be invoked from the same onboarding flow that provisions profiles on-chain.
    pub fn register_creator(env: Env, username: String) {
        env.storage()
            .persistent()
            .set(&DataKey::Creator(username), &true);
    }

    pub fn stake(env: Env, username: String, amount: i128) -> Result<(), Error> {
        Self::require_admin(&env)?;
        Self::require_not_paused(&env)?;
    /// Credits yield to a staker's balance. Admin-only; does NOT check the paused flag.
    pub fn credit_yield(env: Env, username: String, amount: i128) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::Unauthorized)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        Self::require_existing_user(&env, &username)?;

        let balance_key = DataKey::Balance(username.clone());
        let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        if current_balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let stake_key = DataKey::StakeBalance(username.clone());
        let current_stake_balance: i128 = env.storage().persistent().get(&stake_key).unwrap_or(0);
        let new_balance = current_balance - amount;
        let new_stake_balance = current_stake_balance + amount;

        env.storage().persistent().set(&balance_key, &new_balance);
        env.storage()
            .persistent()
            .set(&stake_key, &new_stake_balance);
        Self::bump_persistent_ttl(&env, &balance_key);
        Self::bump_persistent_ttl(&env, &stake_key);

        env.events().publish(
            (Symbol::new(&env, "staked"),),
            (username, amount, new_stake_balance, env.ledger().sequence()),
        );

        Ok(())
    }

    /// Credits yield to a staker's balance. Admin-only; does NOT check the paused flag.
    pub fn credit_yield(env: Env, username: String, amount: i128) -> Result<(), Error> {
        Self::require_admin(&env)?;

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Creator(username.clone()))
        {
            return Err(Error::UserNotFound);
        }

        Self::require_existing_user(&env, &username)?;

        let stake_key = DataKey::StakeBalance(username.clone());
        let current: i128 = env.storage().persistent().get(&stake_key).unwrap_or(0);
        let new_balance = current + amount;
        env.storage().persistent().set(&stake_key, &new_balance);
        Self::bump_persistent_ttl(&env, &stake_key);
        env.storage().persistent().extend_ttl(
            &stake_key,
            PAYLINK_TTL_BUFFER_LEDGERS,
            PAYLINK_TTL_BUFFER_LEDGERS,
        );

        env.events().publish(
            (Symbol::new(&env, "yield_credited"),),
            (username, amount, new_balance, env.ledger().sequence()),
        );

        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn pause(env: Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::Unauthorized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.events()
            .publish((Symbol::new(&env, "contract_paused"),), admin);

        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::Unauthorized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((Symbol::new(&env, "contract_unpaused"),), admin);

        Ok(())
    }

    pub fn create_paylink(
        env: Env,
        creator_username: String,
        token_id: String,
        amount: i128,
        note: String,
        ttl_ledgers: u32,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;

        if !env
            .storage()
            .persistent()
            .has(&DataKey::Creator(creator_username.clone()))
        {
            return Err(Error::CreatorNotFound);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let paylink_key = DataKey::PayLink(token_id.clone());
        if env.storage().persistent().has(&paylink_key) {
            return Err(Error::PayLinkAlreadyExists);
        }

        let current = env.ledger().sequence();
        let expiration_ledger = current
            .checked_add(ttl_ledgers)
            .ok_or(Error::LedgerOverflow)?;

        let data = PayLinkData {
            creator_username: creator_username.clone(),
            amount,
            note,
            expiration_ledger,
            paid: false,
            cancelled: false,
        };

        env.storage().persistent().set(&paylink_key, &data);

        let min_ttl = ttl_ledgers
            .checked_add(PAYLINK_TTL_BUFFER_LEDGERS)
            .ok_or(Error::LedgerOverflow)?;
        env.storage()
            .persistent()
            .extend_ttl(&paylink_key, min_ttl, min_ttl);

        env.events().publish(
            (Symbol::new(&env, "paylink_created"),),
            (creator_username, token_id, amount, expiration_ledger),
        );

        Ok(())
    }

    pub fn cancel_paylink(
        env: Env,
        requester_username: String,
        token_id: String,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;
        env.current_contract_address().require_auth();

        let paylink_key = DataKey::PayLink(token_id.clone());
        let mut paylink = env
            .storage()
            .persistent()
            .get::<_, PayLinkData>(&paylink_key)
            .ok_or(Error::PayLinkNotFound)?;

        if requester_username != paylink.creator_username {
            return Err(Error::NotPayLinkCreator);
        }

        if paylink.paid {
            return Err(Error::PayLinkAlreadyPaid);
        }

        paylink.cancelled = true;
        env.storage().persistent().set(&paylink_key, &paylink);

        env.events().publish(
            (Symbol::new(&env, "paylink_cancelled"),),
            (requester_username, token_id),
        );

        Ok(())
    }

    pub fn get_paylink(env: Env, token_id: String) -> Option<PayLinkData> {
        env.storage().persistent().get(&DataKey::PayLink(token_id))
    }

    fn require_admin(env: &Env) -> Result<(), Error> {
    /// Settle an open PayLink from the payer's internal balance.
    /// Admin-only. One-shot: marks the link as paid after a successful transfer.
    pub fn pay_paylink(
        env: Env,
        payer_username: String,
        token_id: String,
    ) -> Result<(), Error> {
        // Admin auth + not paused
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::Unauthorized)?;
        admin.require_auth();
        Ok(())
    }

    fn require_not_paused(env: &Env) -> Result<(), Error> {
        let paused = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(Error::ContractPaused);
        }
        Ok(())
    }

    fn require_existing_user(env: &Env, username: &String) -> Result<(), Error> {
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Creator(username.clone()))
        {
            return Err(Error::UserNotFound);
        }
        Ok(())
    }

    fn bump_persistent_ttl(env: &Env, key: &DataKey) {
        env.storage().persistent().extend_ttl(
            key,
            PAYLINK_TTL_BUFFER_LEDGERS,
            PAYLINK_TTL_BUFFER_LEDGERS,
        );
        require_not_paused(&env)?;

        // Load PayLink
        let paylink_key = DataKey::PayLink(token_id.clone());
        let mut paylink: PayLinkData = env
            .storage()
            .persistent()
            .get(&paylink_key)
            .ok_or(Error::PayLinkNotFound)?;

        // Guards
        if paylink.paid {
            return Err(Error::PayLinkAlreadyPaid);
        }
        if paylink.cancelled {
            return Err(Error::PayLinkCancelled);
        }
        if env.ledger().sequence() > paylink.expiration_ledger {
            return Err(Error::PayLinkExpired);
        }

        // Balance check
        let payer_key = DataKey::Balance(payer_username.clone());
        let payer_balance: i128 = env
            .storage()
            .persistent()
            .get(&payer_key)
            .unwrap_or(0);

        if payer_balance < paylink.amount {
            return Err(Error::InsufficientBalance);
        }

        // Compute fee (fee_rate_bps stored in instance; default 0 if not set)
        let fee_rate_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::FeeRateBps)
            .unwrap_or(0_u32);
        let fee = paylink.amount * fee_rate_bps as i128 / 10_000;
        let net = paylink.amount - fee;

        // Deduct from payer
        let new_payer_balance = payer_balance - paylink.amount;
        env.storage().persistent().set(&payer_key, &new_payer_balance);
        env.storage().persistent().extend_ttl(
            &payer_key,
            PAYLINK_TTL_BUFFER_LEDGERS,
            PAYLINK_TTL_BUFFER_LEDGERS,
        );

        // Credit creator (net amount)
        let creator_key = DataKey::Balance(paylink.creator_username.clone());
        let creator_balance: i128 = env
            .storage()
            .persistent()
            .get(&creator_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&creator_key, &(creator_balance + net));
        env.storage().persistent().extend_ttl(
            &creator_key,
            PAYLINK_TTL_BUFFER_LEDGERS,
            PAYLINK_TTL_BUFFER_LEDGERS,
        );

        // Credit treasury (fee), if fee > 0 and treasury is set
        if fee > 0 {
            if let Some(treasury_username) = env
                .storage()
                .instance()
                .get::<DataKey, String>(&DataKey::FeeTreasury)
            {
                let treasury_key = DataKey::Balance(treasury_username);
                let treasury_balance: i128 = env
                    .storage()
                    .persistent()
                    .get(&treasury_key)
                    .unwrap_or(0);
                env.storage()
                    .persistent()
                    .set(&treasury_key, &(treasury_balance + fee));
                env.storage().persistent().extend_ttl(
                    &treasury_key,
                    PAYLINK_TTL_BUFFER_LEDGERS,
                    PAYLINK_TTL_BUFFER_LEDGERS,
                );
            }
        }

        // Mark paid and persist
        paylink.paid = true;
        env.storage().persistent().set(&paylink_key, &paylink);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "paylink_paid"),),
            (
                payer_username,
                paylink.creator_username,
                token_id,
                paylink.amount,
                fee,
            ),
        );

        Ok(())
    }
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    if PayLinkContract::is_paused(env.clone()) {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup() -> (Env, Address, PayLinkContractClient<'static>, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);
        client.set_admin(&admin);
        (env, contract_id, client, admin)
    }

    #[test]
    fn is_paused_defaults_to_false() {
        let (_env, _contract_id, client, _admin) = setup();
        assert!(!client.is_paused());
    }

    #[test]
    fn pause_sets_paused_true() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        client.pause();

        assert!(client.is_paused());
    }

    #[test]
    fn unpause_sets_paused_false() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        client.pause();
        client.unpause();

        assert!(!client.is_paused());
    }

    #[test]
    fn create_paylink_persists_paylink_data() {
        let (env, _contract_id, client, _admin) = setup();

        let creator = String::from_str(&env, "alice");
        let token_id = String::from_str(&env, "tok-1");
        let note = String::from_str(&env, "coffee");

        client.register_creator(&creator);
        env.ledger().set_sequence_number(100);

        client.create_paylink(&creator, &token_id, &100_i128, &note, &50);

        let stored = client
            .get_paylink(&token_id)
            .expect("expected PayLink in storage");
        assert_eq!(stored.creator_username, creator);
        assert_eq!(stored.amount, 100);
        assert_eq!(stored.note, note);
        assert_eq!(stored.expiration_ledger, 150);
        assert!(!stored.paid);
        assert!(!stored.cancelled);
    }

    #[test]
    fn paylink_data_xdr_round_trip() {
        let (env, contract_id, _client, _admin) = setup();
        // token_id is a unique slug, max 64 chars
        let token_id = String::from_str(&env, "tok-xdr-roundtrip");
        let data = PayLinkData {
            creator_username: String::from_str(&env, "alice"),
            amount: 10_000_000_i128, // 1 USDC in stroops
            note: String::from_str(&env, "test note"),
            expiration_ledger: 500,
            paid: false,
            cancelled: false,
        };

        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::PayLink(token_id.clone()), &data);
            let retrieved: PayLinkData = env
                .storage()
                .persistent()
                .get(&DataKey::PayLink(token_id))
                .expect("round-trip failed: key not found");
            assert_eq!(retrieved, data);
        });
    }

    #[test]
    fn duplicate_token_id_returns_paylink_already_exists() {
        let (env, _contract_id, client, _admin) = setup();

        let creator = String::from_str(&env, "bob");
        let token_id = String::from_str(&env, "dup");
        let note = String::from_str(&env, "n");

        client.register_creator(&creator);

        client.create_paylink(&creator, &token_id, &1_i128, &note, &10);
        assert_eq!(
            client.try_create_paylink(&creator, &token_id, &2_i128, &note, &10),
            Err(Ok(Error::PayLinkAlreadyExists))
        );
    }

    #[test]
    fn zero_amount_returns_invalid_amount() {
        let (env, _contract_id, client, _admin) = setup();

        let creator = String::from_str(&env, "carol");
        let token_id = String::from_str(&env, "z");
        let note = String::from_str(&env, "n");

        client.register_creator(&creator);

        assert_eq!(
            client.try_create_paylink(&creator, &token_id, &0_i128, &note, &10),
            Err(Ok(Error::InvalidAmount))
        );
    }

    #[test]
    fn cancel_paylink_marks_link_cancelled() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let creator = String::from_str(&env, "dave");
        let token_id = String::from_str(&env, "tok-cancel");
        let note = String::from_str(&env, "lunch");

        client.register_creator(&creator);
        client.create_paylink(&creator, &token_id, &25_i128, &note, &20);

        client.cancel_paylink(&creator, &token_id);

        let stored = client
            .get_paylink(&token_id)
            .expect("expected PayLink in storage");
        assert!(stored.cancelled);
        assert_eq!(stored.creator_username, creator);
        assert!(!stored.paid);
    }

    #[test]
    fn cancel_paylink_by_non_creator_returns_not_paylink_creator() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let creator = String::from_str(&env, "erin");
        let other_user = String::from_str(&env, "frank");
        let token_id = String::from_str(&env, "tok-wrong-user");
        let note = String::from_str(&env, "gift");

        client.register_creator(&creator);
        client.create_paylink(&creator, &token_id, &40_i128, &note, &20);

        assert_eq!(
            client.try_cancel_paylink(&other_user, &token_id),
            Err(Ok(Error::NotPayLinkCreator))
        );
    }

    #[test]
    fn cancel_paid_paylink_returns_paylink_already_paid() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let creator = String::from_str(&env, "grace");
        let token_id = String::from_str(&env, "tok-paid");
        let note = String::from_str(&env, "rent");

        client.register_creator(&creator);
        client.create_paylink(&creator, &token_id, &75_i128, &note, &20);
        set_paylink_paid(&env, &contract_id, &token_id);

        assert_eq!(
            client.try_cancel_paylink(&creator, &token_id),
            Err(Ok(Error::PayLinkAlreadyPaid))
        );
    }

    fn setup_with_admin(env: &Env) -> (Address, PayLinkContractClient<'_>, Address) {
        let contract_id = env.register_contract(None, PayLinkContract);
        let client = PayLinkContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        client.set_admin(&admin);
        (contract_id, client, admin)
    }

    fn set_balance(env: &Env, contract_id: &Address, username: &String, amount: i128) {
        env.as_contract(contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::Balance(username.clone()), &amount);
        });
    }

    fn get_balance(env: &Env, contract_id: &Address, username: &String) -> i128 {
        env.as_contract(contract_id, || {
            env.storage()
                .persistent()
                .get(&DataKey::Balance(username.clone()))
                .unwrap_or(0)
        })
    }

    fn get_stake_balance(env: &Env, contract_id: &Address, username: &String) -> i128 {
        env.as_contract(contract_id, || {
            env.storage()
                .persistent()
                .get(&DataKey::StakeBalance(username.clone()))
                .unwrap_or(0)
        })
    }

    fn set_paylink_paid(env: &Env, contract_id: &Address, token_id: &String) {
        env.as_contract(contract_id, || {
            let mut stored = env
                .storage()
                .persistent()
                .get::<_, PayLinkData>(&DataKey::PayLink(token_id.clone()))
                .expect("expected PayLink in storage");
            stored.paid = true;
            env.storage()
                .persistent()
                .set(&DataKey::PayLink(token_id.clone()), &stored);
        });
    }

    #[test]
    fn stake_partial_balance_moves_amount_to_stake_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _admin) = setup_with_admin(&env);

        let username = String::from_str(&env, "staker-partial");
        client.register_creator(&username);
        set_balance(&env, &contract_id, &username, 100);

        client.stake(&username, &40_i128);

        assert_eq!(get_balance(&env, &contract_id, &username), 60);
        assert_eq!(get_stake_balance(&env, &contract_id, &username), 40);
    }

    #[test]
    fn stake_entire_balance_moves_all_liquid_funds_to_stake_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _admin) = setup_with_admin(&env);

        let username = String::from_str(&env, "staker-full");
        client.register_creator(&username);
        set_balance(&env, &contract_id, &username, 55);

        client.stake(&username, &55_i128);

        assert_eq!(get_balance(&env, &contract_id, &username), 0);
        assert_eq!(get_stake_balance(&env, &contract_id, &username), 55);
    }

    #[test]
    fn over_stake_returns_insufficient_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _admin) = setup_with_admin(&env);

        let username = String::from_str(&env, "staker-over");
        client.register_creator(&username);
        set_balance(&env, &contract_id, &username, 25);

        assert_eq!(
            client.try_stake(&username, &30_i128),
            Err(Ok(Error::InsufficientBalance))

        env.as_contract(&contract_id, || {
            let mut stored = env
                .storage()
                .persistent()
                .get::<_, PayLinkData>(&DataKey::PayLink(token_id.clone()))
                .expect("expected PayLink in storage");
            stored.paid = true;
            env.storage()
                .persistent()
                .set(&DataKey::PayLink(token_id.clone()), &stored);
        });

        assert_eq!(
            client.try_cancel_paylink(&creator, &token_id),
            Err(Ok(Error::PayLinkAlreadyPaid))
        );
    }

    #[test]
    fn create_paylink_returns_contract_paused_when_paused() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let creator = String::from_str(&env, "henry");
        let token_id = String::from_str(&env, "tok-paused-create");
        let note = String::from_str(&env, "ticket");

        client.register_creator(&creator);
        client.pause();

        assert_eq!(
            client.try_create_paylink(&creator, &token_id, &10_i128, &note, &20),
            Err(Ok(Error::ContractPaused))
        );
    }

    #[test]
    fn create_paylink_with_very_large_amount_succeeds() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let creator = String::from_str(&env, "irene");
        let token_id = String::from_str(&env, "tok-large");
        let note = String::from_str(&env, "large payment");

        client.register_creator(&creator);

        // 1 billion USDC in stroops (1 USDC = 10_000_000 stroops)
        let large_amount = 1_000_000_000_i128 * 10_000_000_i128;
        client.create_paylink(&creator, &token_id, &large_amount, &note, &100);

        let stored = client
            .get_paylink(&token_id)
            .expect("expected PayLink in storage");
        assert_eq!(stored.amount, large_amount);
    }

    #[test]
    fn create_paylink_with_minimum_ttl_succeeds() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let creator = String::from_str(&env, "jack");
        let token_id = String::from_str(&env, "tok-min-ttl");
        let note = String::from_str(&env, "test");

        client.register_creator(&creator);

        // Minimum TTL of 1 ledger
        client.create_paylink(&creator, &token_id, &100_i128, &note, &1);

        let stored = client
            .get_paylink(&token_id)
            .expect("expected PayLink in storage");
        assert_eq!(stored.expiration_ledger, env.ledger().sequence() + 1);
    }

    #[test]
    fn create_paylink_with_zero_ttl_fails_due_to_overflow_or_invalid() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let creator = String::from_str(&env, "kate");
        let token_id = String::from_str(&env, "tok-zero-ttl");
        let note = String::from_str(&env, "test");

        client.register_creator(&creator);

        // TTL of 0 means expiration at current ledger (already expired)
        // This should still succeed but create an immediately expired paylink
        client.create_paylink(&creator, &token_id, &100_i128, &note, &0);

        let stored = client
            .get_paylink(&token_id)
            .expect("expected PayLink in storage");
        assert_eq!(stored.expiration_ledger, env.ledger().sequence());
    }

    #[test]
    fn get_paylink_for_non_existent_token_returns_none() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let token_id = String::from_str(&env, "non-existent");
        assert!(client.get_paylink(&token_id).is_none());
    }

    #[test]
    fn register_creator_allows_subsequent_create_paylink() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let creator = String::from_str(&env, "leo");
        let token_id = String::from_str(&env, "tok-registered");
        let note = String::from_str(&env, "test");

        // Register creator first
        client.register_creator(&creator);

        // Now create paylink should succeed
        client.create_paylink(&creator, &token_id, &50_i128, &note, &10);

        let stored = client
            .get_paylink(&token_id)
            .expect("expected PayLink in storage");
        assert_eq!(stored.creator_username, creator);
    }

    #[test]
    fn credit_yield_for_non_existent_user_returns_user_not_found() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.set_admin(&admin);

        let username = String::from_str(&env, "non-existent");
        env.mock_all_auths();

        assert_eq!(
            client.try_credit_yield(&username, &100_i128),
            Err(Ok(Error::UserNotFound))
        );
    }

    #[test]
    fn credit_yield_with_zero_amount_returns_invalid_amount() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.set_admin(&admin);

        let username = String::from_str(&env, "mike");
        client.register_creator(&username);
        env.mock_all_auths();

        assert_eq!(
            client.try_credit_yield(&username, &0_i128),
            Err(Ok(Error::InvalidAmount))
        );
    }

    #[test]
    fn credit_yield_with_negative_amount_returns_invalid_amount() {
        let env = Env::default();
        let contract_id = env.register(PayLinkContract, ());
        let client = PayLinkContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.set_admin(&admin);

        let username = String::from_str(&env, "nancy");
        client.register_creator(&username);
        env.mock_all_auths();

        assert_eq!(
            client.try_credit_yield(&username, &-100_i128),
            Err(Ok(Error::InvalidAmount))
        );
    }

    #[test]
    fn cancel_paylink_returns_contract_paused_when_paused() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let creator = String::from_str(&env, "irene");
        let token_id = String::from_str(&env, "tok-paused-cancel");
        let note = String::from_str(&env, "invoice");

        client.register_creator(&creator);
        client.create_paylink(&creator, &token_id, &15_i128, &note, &20);
        client.pause();

        assert_eq!(
            client.try_cancel_paylink(&creator, &token_id),
            Err(Ok(Error::ContractPaused))
        );
        assert_eq!(get_balance(&env, &contract_id, &username), 25);
        assert_eq!(get_stake_balance(&env, &contract_id, &username), 0);
    }

    #[test]
    fn unpause_restores_create_paylink_access() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let creator = String::from_str(&env, "jane");
        let token_id = String::from_str(&env, "tok-after-unpause");
        let note = String::from_str(&env, "groceries");

        client.register_creator(&creator);
        client.pause();
        client.unpause();

        let result = client.try_create_paylink(&creator, &token_id, &20_i128, &note, &20);
        assert_ne!(result, Err(Ok(Error::ContractPaused)));
        assert!(client.get_paylink(&token_id).is_some());
    }

    #[test]
    fn credit_yield_not_blocked_when_paused() {
        let (env, _contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let username = String::from_str(&env, "kate");
        client.register_creator(&username);
        client.pause();

        let result = client.try_credit_yield(&username, &5_i128);
        assert_ne!(result, Err(Ok(Error::ContractPaused)));
    }

    #[test]
    #[should_panic]
    fn pause_requires_admin_auth() {
        let (_env, _contract_id, client, _admin) = setup();
        client.pause();
    }

    #[test]
    #[should_panic]
    fn unpause_requires_admin_auth() {
        let (_env, _contract_id, client, _admin) = setup();
        client.unpause();
    }

    // ── pay_paylink ───────────────────────────────────────────────────────────

    fn setup_paylink_with_balance(
        env: &Env,
        contract_id: &Address,
        client: &PayLinkContractClient,
        payer: &str,
        creator: &str,
        amount: i128,
        ttl: u32,
    ) -> String {
        let payer_str = String::from_str(env, payer);
        let creator_str = String::from_str(env, creator);
        let token_id = String::from_str(env, "tok-pay-1");
        let note = String::from_str(env, "test payment");

        // Register creator and set payer balance
        client.register_creator(&creator_str);
        env.as_contract(contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::Balance(payer_str.clone()), &amount);
        });

        env.ledger().set_sequence_number(100);
        client.create_paylink(&creator_str, &token_id, &amount, &note, &ttl);

        token_id
    }

    #[test]
    fn pay_paylink_happy_path() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let payer = String::from_str(&env, "payer");
        let creator = String::from_str(&env, "creator");
        let amount = 10_000_000_i128; // 1 USDC
        let token_id = setup_paylink_with_balance(
            &env, &contract_id, &client, "payer", "creator", amount, 50,
        );

        client.pay_paylink(&payer, &token_id);

        // PayLink marked paid
        let stored = client.get_paylink(&token_id).unwrap();
        assert!(stored.paid);

        // Payer balance deducted
        env.as_contract(&contract_id, || {
            let bal: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::Balance(payer.clone()))
                .unwrap_or(0);
            assert_eq!(bal, 0);
        });

        // Creator received net (fee=0 since FeeRateBps not set)
        env.as_contract(&contract_id, || {
            let bal: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::Balance(creator.clone()))
                .unwrap_or(0);
            assert_eq!(bal, amount);
        });
    }

    #[test]
    fn pay_paylink_already_paid_returns_error() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let payer = String::from_str(&env, "payer2");
        let amount = 5_000_000_i128;
        let token_id = setup_paylink_with_balance(
            &env, &contract_id, &client, "payer2", "creator2", amount, 50,
        );

        // Pay once
        client.pay_paylink(&payer, &token_id);

        // Refund payer so balance isn't the blocker
        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::Balance(payer.clone()), &amount);
        });

        // Pay again → AlreadyPaid
        let result = client.try_pay_paylink(&payer, &token_id);
        assert_eq!(result, Err(Ok(Error::PayLinkAlreadyPaid)));
    }

    #[test]
    fn pay_paylink_cancelled_returns_error() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let payer = String::from_str(&env, "payer3");
        let creator = String::from_str(&env, "creator3");
        let amount = 3_000_000_i128;
        let token_id = setup_paylink_with_balance(
            &env, &contract_id, &client, "payer3", "creator3", amount, 50,
        );

        // Cancel the paylink
        client.cancel_paylink(&creator, &token_id);

        let result = client.try_pay_paylink(&payer, &token_id);
        assert_eq!(result, Err(Ok(Error::PayLinkCancelled)));
    }

    #[test]
    fn pay_paylink_expired_returns_error() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let payer = String::from_str(&env, "payer4");
        let amount = 2_000_000_i128;
        // TTL of 10 ledgers, starting at ledger 100 → expires at 110
        let token_id = setup_paylink_with_balance(
            &env, &contract_id, &client, "payer4", "creator4", amount, 10,
        );

        // Advance ledger past expiration
        env.ledger().set_sequence_number(111);

        let result = client.try_pay_paylink(&payer, &token_id);
        assert_eq!(result, Err(Ok(Error::PayLinkExpired)));
    }

    #[test]
    fn pay_paylink_insufficient_balance_returns_error() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let payer = String::from_str(&env, "payer5");
        let creator = String::from_str(&env, "creator5");
        let amount = 10_000_000_i128;
        let token_id = String::from_str(&env, "tok-insuf");
        let note = String::from_str(&env, "test");

        client.register_creator(&creator);
        env.ledger().set_sequence_number(100);
        client.create_paylink(&creator, &token_id, &amount, &note, &50);

        // Set payer balance to less than amount
        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::Balance(payer.clone()), &(amount - 1));
        });

        let result = client.try_pay_paylink(&payer, &token_id);
        assert_eq!(result, Err(Ok(Error::InsufficientBalance)));
    }

    #[test]
    fn pay_paylink_with_fee_credits_treasury() {
        let (env, contract_id, client, _admin) = setup();
        env.mock_all_auths();

        let payer = String::from_str(&env, "payer6");
        let creator = String::from_str(&env, "creator6");
        let treasury = String::from_str(&env, "treasury");
        let amount = 10_000_000_i128; // 1 USDC

        // Set fee rate to 100 bps (1%) and treasury
        env.as_contract(&contract_id, || {
            env.storage().instance().set(&DataKey::FeeRateBps, &100_u32);
            env.storage().instance().set(&DataKey::FeeTreasury, &treasury);
        });

        let token_id = setup_paylink_with_balance(
            &env, &contract_id, &client, "payer6", "creator6", amount, 50,
        );

        client.pay_paylink(&payer, &token_id);

        // fee = 1% of 10_000_000 = 100_000; net = 9_900_000
        env.as_contract(&contract_id, || {
            let creator_bal: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::Balance(creator.clone()))
                .unwrap_or(0);
            assert_eq!(creator_bal, 9_900_000);

            let treasury_bal: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::Balance(treasury.clone()))
                .unwrap_or(0);
            assert_eq!(treasury_bal, 100_000);
        });
    }
}
