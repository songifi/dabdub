#![no_std]

mod access_control;
mod test;
mod token_helpers;

use soroban_sdk::{
Symbol, String,
    Vec,

};

/// Pending claim record: amounts reserved and expiry ledger for cancellation rules.
#[contracttype]
#[derive(Clone)]
pub struct PendingClaim {
    pub recipient: Address,
    pub payment_amount: i128,
    pub fee_amount: i128,
    pub expiry_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct PendingClaim {
    pub payment_amount: i128,
    pub fee_amount: i128,
    pub expiry_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct PendingClaim {
    pub payment_amount: i128,
    pub fee_amount: i128,
    pub expiry_ledger: u32,
}

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
PendingClaim(BytesN<32>),
    StakedBalance(String),
    LiquidBalance(String),
    StakeStartLedger(String),
}

const MAX_FEE: i128 = 5_000_000;

#[contracttype]
pub enum Error {
    InsufficientBalance,
    InvalidAmount,
    UserNotFound,
    Unauthorized,
    Paused,
}

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

#[contractevent(topics = ["VAULT", "claimed"])]
struct PaymentClaimedEvent {
    recipient: Address,
    payment_id: BytesN<32>,
    payment_amount: i128,
    fee_amount: i128,
}

#[contractevent(topics = ["VAULT", "cancelled"])]
struct PaymentCancelledEvent {
    payment_id: BytesN<32>,
    payment_amount: i128,
    fee_amount: i128,
    cancelled_by: Address,
    force: bool,
}

#[contractevent(topics = ["VAULT", "unstaked"])]
pub struct UnstakedEvent {
    pub username: String,
    pub amount: i128,
    pub remaining_stake: i128,
    pub ledger: u32,
}

/// Ledgers after process_payment after which a claim can be cancelled without force.
const CLAIM_EXPIRY_LEDGERS: u32 = 10000;

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
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

        let empty_vec: Vec<BytesN<32>> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::AllPendingClaims, &empty_vec);

        access_control::grant_role(&env, admin, access_control::ADMIN_ROLE);
    }

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

        let expiry_ledger = env.ledger().sequence().saturating_add(CLAIM_EXPIRY_LEDGERS);
        let claim = PendingClaim {
            recipient: user_wallet.clone(),
            payment_amount,
            fee_amount,
            expiry_ledger,
        };
        env.storage()
            .instance()
            .set(&DataKey::PendingClaim(payment_id.clone()), &claim);

        PaymentProcessedEvent {
            user_wallet: user_wallet.clone(),
            payment_id: payment_id.clone(),
            payment_amount,
            fee_amount,
        }
        .publish(&env);
    }

    
    /// Claim a pending payment (recipient only, within expiry window)
    pub fn claim(env: Env, caller: Address, payment_id: BytesN<32>) {
        caller.require_auth();

        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("Contract is paused");
        }

        // Load pending claim
        let claim: PendingClaim = env
            .storage()
            .instance()
            .get(&DataKey::PendingClaim(payment_id.clone()))
            .unwrap_or_else(|| panic!("Pending claim not found"));

        // Verify caller is the intended recipient
        if claim.recipient != caller {
            panic!("Caller is not the intended recipient");
        }

        // Verify claim window has not expired
        let current_ledger = env.ledger().sequence();
        if current_ledger >= claim.expiry_ledger {
            panic!("Claim window has expired");
        }

        // Update accounting — reduce available and total for both payments and fees
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
        let mut available_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let mut total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFees)
            .unwrap_or(0);

        available_payments = available_payments
            .checked_sub(claim.payment_amount)
            .unwrap_or_else(|| panic!("Available payments underflow"));
        total_payments = total_payments
            .checked_sub(claim.payment_amount)
            .unwrap_or_else(|| panic!("Total payments underflow"));
        available_fees = available_fees
            .checked_sub(claim.fee_amount)
            .unwrap_or_else(|| panic!("Available fees underflow"));
        total_fees = total_fees
            .checked_sub(claim.fee_amount)
            .unwrap_or_else(|| panic!("Total fees underflow"));

        env.storage()
            .instance()
            .set(&DataKey::AvailablePayments, &available_payments);
        env.storage()
            .instance()
            .set(&DataKey::TotalPayments, &total_payments);
        env.storage()
            .instance()
            .set(&DataKey::AvailableFees, &available_fees);
        env.storage()
            .instance()
            .set(&DataKey::TotalFees, &total_fees);

        // Transfer payment amount to recipient
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &caller,
            &claim.payment_amount,
        );

        // Remove pending claim from storage
        env.storage()
            .instance()
            .remove(&DataKey::PendingClaim(payment_id.clone()));

        // Emit event
        PaymentClaimedEvent {
            recipient: caller,
            payment_id,
            payment_amount: claim.payment_amount,
            fee_amount: claim.fee_amount,
        }
        .publish(&env);
    }

    /// Cancel a pending claim (admin or operator). Returns funds to vault's available pool.
    /// Without `force`, the claim must have expired (past expiry_ledger).
    pub fn cancel_pending_claim(
        env: Env,
        caller: Address,
        payment_id: BytesN<32>,
        force: bool,
    ) {
        if !access_control::has_role(&env, &caller, access_control::ADMIN_ROLE)
            && !access_control::has_role(&env, &caller, access_control::OPERATOR_ROLE)
        {
            panic!("Missing required role");
        }
        caller.require_auth();

        let claim: PendingClaim = env
            .storage()
            .instance()
            .get(&DataKey::PendingClaim(payment_id.clone()))
            .unwrap_or_else(|| panic!("Pending claim not found"));

        if !force {
            let current_ledger = env.ledger().sequence();
            if current_ledger < claim.expiry_ledger {
                panic!("Claim has not expired");
            }
        }

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
        let mut available_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::AvailableFees)
            .unwrap_or(0);
        let mut total_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFees)
            .unwrap_or(0);

        available_payments = available_payments
            .checked_sub(claim.payment_amount)
            .unwrap_or_else(|| panic!("Available payments underflow"));
        total_payments = total_payments
            .checked_sub(claim.payment_amount)
            .unwrap_or_else(|| panic!("Total payments underflow"));
        available_fees = available_fees
            .checked_sub(claim.fee_amount)
            .unwrap_or_else(|| panic!("Available fees underflow"));
        total_fees = total_fees
            .checked_sub(claim.fee_amount)
            .unwrap_or_else(|| panic!("Total fees underflow"));

        env.storage()
            .instance()
            .set(&DataKey::AvailablePayments, &available_payments);
        env.storage()
            .instance()
            .set(&DataKey::TotalPayments, &total_payments);
        env.storage()
            .instance()
            .set(&DataKey::AvailableFees, &available_fees);
        env.storage()
            .instance()
            .set(&DataKey::TotalFees, &total_fees);

        env.storage()
            .instance()
            .remove(&DataKey::PendingClaim(payment_id.clone()));

        PaymentCancelledEvent {
            payment_id: payment_id.clone(),
            payment_amount: claim.payment_amount,
            fee_amount: claim.fee_amount,
            cancelled_by: caller,
            force,
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

    /// Stake tokens for user (admin only). Assumes tokens already transferred to vault contract separately.
    pub fn stake(env: Env, username: String, amount: i128) {
        let caller = env.invoker();
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic!("Contract is paused");
        }

        if amount <= 0 {
            panic!("Amount must be > 0");
        }

        let mut stake: i128 = env.storage().persistent().get(&DataKey::StakedBalance(username.clone())).unwrap_or(0);
        stake = stake.checked_add(amount).expect("Stake overflow");

        env.storage().persistent().set(&DataKey::StakedBalance(username.clone()), &stake);
        env.storage().persistent().bump(&DataKey::StakedBalance(username.clone()), 400_000u32, 200_000u32);

        let old_stake = stake - amount;
        if old_stake == 0 {
            let current_ledger = env.ledger().sequence() as u32;
            env.storage().persistent().set(&DataKey::StakeStartLedger(username.clone()), &current_ledger);
            env.storage().persistent().bump(&DataKey::StakeStartLedger(username.clone()), 400_000u32, 200_000u32);
        }
    }

    /// Unstake tokens for user (admin only). Moves staked balance + accrued yield to liquid balance.
    pub fn unstake(env: Env, username: String, amount: i128) -> Result<(), Error> {
        let caller = env.invoker();
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            return Err(Error::Paused);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut stake: i128 = env.storage().persistent().get(&DataKey::StakedBalance(username.clone())).ok_or(Error::UserNotFound)?;
        if stake < amount {
            return Err(Error::InsufficientBalance);
        }

        // Accrue yield
        let stake_start: u32 = env.storage().persistent().get(&DataKey::StakeStartLedger(username.clone())).unwrap_or(env.ledger().sequence() as u32);
        let ledgers_staked = (env.ledger().sequence() as u32).saturating_sub(stake_start);
        let kledgers = ledgers_staked / 1000u32;
        let yield_bp_per_kledger = 1i128; // 0.01% per 1000 ledgers
        let yield_amount = (kledgers as i128 * amount * yield_bp_per_kledger) / 10_000i128;
        let total_return = amount + yield_amount;

        stake -= amount;
        env.storage().persistent().set(&DataKey::StakedBalance(username.clone()), &stake);
        env.storage().persistent().bump(&DataKey::StakedBalance(username.clone()), 400_000u32, 200_000u32);

        let mut liquid: i128 = env.storage().persistent().get(&DataKey::LiquidBalance(username.clone())).unwrap_or(0i128);
        liquid += total_return;
        env.storage().persistent().set(&DataKey::LiquidBalance(username.clone()), &liquid);
        env.storage().persistent().bump(&DataKey::LiquidBalance(username.clone()), 400_000u32, 200_000u32);

        UnstakedEvent {
            username: username.clone(),
            amount,
            remaining_stake: stake,
            ledger: env.ledger().sequence() as u32,
        }.publish(&env);

        Ok(())
    }

    /// Pause contract (admin only)
    pub fn pause(env: Env, caller: Address) {


        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(env: Env, caller: Address) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn grant_role(env: Env, caller: Address, account: Address, role: Symbol) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        access_control::grant_role(&env, account, role);
    }

    pub fn revoke_role(env: Env, caller: Address, account: Address, role: Symbol) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        access_control::revoke_role(&env, account, role);
    }

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

pub fn get_stake_balance(env: Env, username: String) -> i128 {
        env.storage().persistent().get(&DataKey::StakedBalance(username)).unwrap_or(0)
    }

    pub fn get_liquid_balance(env: Env, username: String) -> i128 {
        env.storage().persistent().get(&DataKey::LiquidBalance(username)).unwrap_or(0)
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

    pub fn get_pending_claim(env: Env, payment_id: BytesN<32>) -> Option<PendingClaim> {
        env.storage()
            .instance()
            .get(&DataKey::PendingClaim(payment_id))
    }

    pub fn get_all_pending_claims(env: Env) -> Vec<BytesN<32>> {
        env.storage()
            .instance()
            .get(&DataKey::AllPendingClaims)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_pending_claims_count(env: Env) -> u32 {
        let all_claims: Vec<BytesN<32>> = env
            .storage()
            .instance()
            .get(&DataKey::AllPendingClaims)
            .unwrap_or_else(|| Vec::new(&env));
        all_claims.len()
    }

    pub fn is_claim_expired(env: Env, payment_id: BytesN<32>) -> bool {
        let claim: Option<PendingClaim> = env
            .storage()
            .instance()
            .get(&DataKey::PendingClaim(payment_id));
        
        match claim {
            Some(c) => {
                let current_ledger = env.ledger().sequence();
                current_ledger >= c.expiry_ledger
            }
            None => false,
        }
    }

    pub fn get_recipient_pending_claims(env: Env, _recipient: Address) -> Vec<BytesN<32>> {
        Vec::new(&env)
    }
}