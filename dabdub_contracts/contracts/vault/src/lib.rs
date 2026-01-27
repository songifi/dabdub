#![no_std]

mod access_control;
mod test;
mod token_helpers;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, BytesN, Env, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Roles(Address),
    UsdcToken,
    FeeAmount,
    MinDeposit,
    AvailablePayments,
    TotalPayments,
    AvailableFees,
    TotalFees,
    Paused,
}

const MAX_FEE: i128 = 5_000_000; // $5 in USDC (7 decimals)

// Events
#[contractevent(topics = ["VAULT", "payment"])]
struct PaymentProcessedEvent {
    user_wallet: Address,
    payment_id: BytesN<32>,
    payment_amount: i128,
    fee_amount: i128,
}

#[contractevent(topics = ["VAULT", "refund"])]
struct PaymentRefundedEvent {
    user_wallet: Address,
    payment_id: BytesN<32>,
    refund_amount: i128,
    fee_refunded: bool,
}

#[contractevent(topics = ["VAULT", "withdrawal"])]
struct VaultFundsWithdrawnEvent {
    to: Address,
    amount: i128,
}

#[contractevent(topics = ["VAULT", "config"])]
struct FeeUpdatedEvent {
    old_fee: i128,
    new_fee: i128,
}

#[contractevent(topics = ["VAULT", "config"])]
struct MinDepositUpdatedEvent {
    old_min_deposit: i128,
    new_min_deposit: i128,
}

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    /// Constructor
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc_token: Address,
        fee_amount: i128,
        min_deposit: i128,
    ) {
        if fee_amount > MAX_FEE {
            panic!("Fee exceeds maximum");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage()
            .instance()
            .set(&DataKey::FeeAmount, &fee_amount);
        env.storage()
            .instance()
            .set(&DataKey::MinDeposit, &min_deposit);
        env.storage()
            .instance()
            .set(&DataKey::AvailablePayments, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::TotalPayments, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::AvailableFees, &0i128);
        env.storage().instance().set(&DataKey::TotalFees, &0i128);
        env.storage().instance().set(&DataKey::Paused, &false);

        // Grant admin role
        access_control::grant_role(&env, admin, access_control::ADMIN_ROLE);
    }

    /// Process payment (operator only)
    pub fn process_payment(
        env: Env,
        caller: Address,
        user_wallet: Address,
        payment_amount: i128,
        payment_id: BytesN<32>,
    ) {
        access_control::require_role(&env, &caller, access_control::OPERATOR_ROLE);
        caller.require_auth();

        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("Contract is paused");
        }

        if payment_amount <= 0 {
            panic!("Payment amount must be > 0");
        }

        let fee_amount: i128 = env.storage().instance().get(&DataKey::FeeAmount).unwrap();
        let expected_total_amount = payment_amount + fee_amount;

        // Ensure the vault has been funded for this payment before accounting for it.
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        let vault_balance = token_client.balance(&env.current_contract_address());

        // Update payment tracking
        let mut available_payments: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailablePayments)
            .unwrap_or(0);
        let mut total_payments: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPayments)
            .unwrap_or(0);

        let available_fees_before: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let required_balance_after = available_payments
            .checked_add(available_fees_before)
            .and_then(|v| v.checked_add(expected_total_amount))
            .expect("Amount overflow");
        if vault_balance < required_balance_after {
            panic!("Payment not funded");
        }

        available_payments += payment_amount;
        total_payments += payment_amount;

        env.storage()
            .instance()
            .set(&DataKey::AvailablePayments, &available_payments);
        env.storage()
            .instance()
            .set(&DataKey::TotalPayments, &total_payments);

        // Update fee tracking
        let mut available_fees: i128 = available_fees_before;
        let mut total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFees)
            .unwrap_or(0);

        available_fees += fee_amount;
        total_fees += fee_amount;

        env.storage()
            .instance()
            .set(&DataKey::AvailableFees, &available_fees);
        env.storage()
            .instance()
            .set(&DataKey::TotalFees, &total_fees);

        PaymentProcessedEvent {
            user_wallet: user_wallet.clone(),
            payment_id: payment_id.clone(),
            payment_amount,
            fee_amount,
        }
        .publish(&env);
    }

    /// Refund payment (admin only)
    pub fn refund_payment(
        env: Env,
        caller: Address,
        user_wallet: Address,
        payment_amount: i128,
        refund_fee: bool,
        payment_id: BytesN<32>,
    ) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        let mut available_payments: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailablePayments)
            .unwrap_or(0);
        if available_payments < payment_amount {
            panic!("Insufficient available payments");
        }

        let mut refund_amount = payment_amount;
        let mut available_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let fee_amount: i128 = env.storage().instance().get(&DataKey::FeeAmount).unwrap();

        if refund_fee {
            if available_fees < fee_amount {
                panic!("Insufficient available fees for refund");
            }
            refund_amount += fee_amount;
            available_fees -= fee_amount;
        }

        available_payments -= payment_amount;

        env.storage()
            .instance()
            .set(&DataKey::AvailablePayments, &available_payments);
        env.storage()
            .instance()
            .set(&DataKey::AvailableFees, &available_fees);

        // Transfer USDC back to user
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &user_wallet,
            &refund_amount,
        );

        PaymentRefundedEvent {
            user_wallet,
            payment_id,
            refund_amount,
            fee_refunded: refund_fee,
        }
        .publish(&env);
    }

    /// Withdraw all vault funds (treasurer only)
    pub fn withdraw_vault_funds(env: Env, caller: Address, to: Address) {
        access_control::require_role(&env, &caller, access_control::TREASURER_ROLE);
        caller.require_auth();

        let available_payments: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailablePayments)
            .unwrap_or(0);
        let available_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let total_withdrawal = available_payments + available_fees;

        if total_withdrawal <= 0 {
            panic!("No funds available for withdrawal");
        }

        env.storage()
            .instance()
            .set(&DataKey::AvailablePayments, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::AvailableFees, &0i128);

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &to, &total_withdrawal);

        VaultFundsWithdrawnEvent {
            to,
            amount: total_withdrawal,
        }
        .publish(&env);
    }

    /// Update fee (admin only)
    pub fn set_fee(env: Env, caller: Address, new_fee: i128) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        if new_fee > MAX_FEE {
            panic!("Fee exceeds maximum");
        }

        let old_fee: i128 = env
            .storage()
            .instance()
            .get(&DataKey::FeeAmount)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::FeeAmount, &new_fee);

        FeeUpdatedEvent { old_fee, new_fee }.publish(&env);
    }

    /// Update minimum deposit (admin only)
    pub fn set_min_deposit(env: Env, caller: Address, new_min_deposit: i128) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        let old_min_deposit: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MinDeposit)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::MinDeposit, &new_min_deposit);

        MinDepositUpdatedEvent {
            old_min_deposit,
            new_min_deposit,
        }
        .publish(&env);
    }

    /// Pause contract (admin only)
    pub fn pause(env: Env, caller: Address) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
    }

    /// Unpause contract (admin only)
    pub fn unpause(env: Env, caller: Address) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Grant role (admin only)
    pub fn grant_role(env: Env, caller: Address, account: Address, role: Symbol) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        access_control::grant_role(&env, account, role);
    }

    /// Revoke role (admin only)
    pub fn revoke_role(env: Env, caller: Address, account: Address, role: Symbol) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        access_control::revoke_role(&env, account, role);
    }

    // View functions
    pub fn has_role(env: Env, account: Address, role: Symbol) -> bool {
        access_control::has_role(&env, &account, role)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_fee_amount(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::FeeAmount).unwrap()
    }

    pub fn get_min_deposit(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::MinDeposit).unwrap()
    }

    pub fn get_available_withdrawal(env: Env) -> (i128, i128, i128) {
        let payments: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailablePayments)
            .unwrap_or(0);
        let fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let total = payments + fees;
        (payments, fees, total)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn verify_vault_accounting(env: Env) -> bool {
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        let vault_balance = token_client.balance(&env.current_contract_address());

        let available_payments: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailablePayments)
            .unwrap_or(0);
        let available_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let required_balance = available_payments + available_fees;

        vault_balance >= required_balance
    }
}
