#![no_std]

use soroban_sdk::{
    contract, contractclient, contractevent, contractimpl, contracttype, token, Address, Env,
};

#[contractclient(name = "CheeseVaultClient")]
pub trait CheeseVaultTrait {
    fn get_fee_amount(env: Env) -> i128;
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Backend,
    Owner,
    Vault,
    UsdcToken,
}

// Events
#[contractevent(topics = ["WALLET", "withdraw"])]
struct WithdrawalEvent {
    recipient: Address,
    amount: i128,
}

#[contractevent(topics = ["WALLET", "owner_upd"])]
struct OwnerUpdatedEvent {
    old_owner: Option<Address>,
    new_owner: Address,
}

#[contractevent(topics = ["WALLET", "emerg_wd"])]
struct EmergencyWithdrawalEvent {
    amount: i128,
}

#[contractevent(topics = ["WALLET", "to_vault"])]
struct TransferredToVaultEvent {
    vault: Address,
    payment_amount: i128,
    fee_amount: i128,
    total_amount: i128,
}

#[contract]
pub struct UserWallet;

#[contractimpl]
impl UserWallet {
    /// Constructor - called once on deployment
    pub fn __constructor(
        env: Env,
        backend: Address,
        vault: Address,
        usdc_token: Address,
        owner: Option<Address>,
    ) {
        env.storage().instance().set(&DataKey::Backend, &backend);
        env.storage().instance().set(&DataKey::Vault, &vault);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);

        if let Some(owner_addr) = owner {
            env.storage().instance().set(&DataKey::Owner, &owner_addr);
        }
    }

    /// Get USDC balance
    pub fn get_balance(env: Env) -> i128 {
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.balance(&env.current_contract_address())
    }

    /// Withdraw USDC (backend or owner)
    pub fn withdraw(env: Env, caller: Address, amount: i128, recipient: Address) {
        let backend: Address = env.storage().instance().get(&DataKey::Backend).unwrap();
        let owner_opt: Option<Address> = env.storage().instance().get(&DataKey::Owner);

        let is_backend = caller == backend;
        let is_owner = owner_opt.is_some_and(|owner| caller == owner);

        if !is_backend && !is_owner {
            panic!("Not authorized");
        }

        caller.require_auth();

        if amount <= 0 {
            panic!("Amount must be > 0");
        }

        let balance = Self::get_balance(env.clone());
        if balance < amount {
            panic!("Insufficient balance");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        WithdrawalEvent {
            recipient: recipient.clone(),
            amount,
        }
        .publish(&env);
    }

    /// Set owner (backend only)
    pub fn set_owner(env: Env, caller: Address, new_owner: Address) {
        let backend: Address = env.storage().instance().get(&DataKey::Backend).unwrap();

        if caller != backend {
            panic!("Only backend");
        }

        caller.require_auth();

        let old_owner: Option<Address> = env.storage().instance().get(&DataKey::Owner);
        env.storage().instance().set(&DataKey::Owner, &new_owner);

        OwnerUpdatedEvent {
            old_owner,
            new_owner: new_owner.clone(),
        }
        .publish(&env);
    }

    /// Emergency withdraw (owner only)
    pub fn emergency_withdraw(env: Env, caller: Address) {
        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("Owner not set");

        if caller != owner {
            panic!("Only owner");
        }

        caller.require_auth();

        let balance = Self::get_balance(env.clone());
        if balance <= 0 {
            panic!("No balance to withdraw");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &owner, &balance);

        EmergencyWithdrawalEvent { amount: balance }.publish(&env);
    }

    /// Transfer USDC to vault for payment processing (backend or vault only)
    pub fn transfer_to_vault(env: Env, caller: Address, payment_amount: i128) -> i128 {
        if payment_amount <= 0 {
            panic!("Payment amount must be > 0");
        }

        let backend: Address = env.storage().instance().get(&DataKey::Backend).unwrap();
        let vault: Address = env.storage().instance().get(&DataKey::Vault).unwrap();

        if caller != backend && caller != vault {
            panic!("Not authorized");
        }

        // Backend and vault calls must be authorized by the caller.
        caller.require_auth();

        let vault_client = CheeseVaultClient::new(&env, &vault);
        let fee_amount = vault_client.get_fee_amount();
        if fee_amount < 0 {
            panic!("Invalid fee");
        }

        let total_amount = payment_amount
            .checked_add(fee_amount)
            .expect("Amount overflow");

        let balance = Self::get_balance(env.clone());
        if balance < total_amount {
            panic!("Insufficient balance");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &vault, &total_amount);

        TransferredToVaultEvent {
            vault: vault.clone(),
            payment_amount,
            fee_amount,
            total_amount,
        }
        .publish(&env);

        total_amount
    }

    // View functions
    pub fn get_backend(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Backend).unwrap()
    }

    pub fn get_owner(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Owner)
    }

    pub fn get_vault(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Vault).unwrap()
    }
}

mod test;
