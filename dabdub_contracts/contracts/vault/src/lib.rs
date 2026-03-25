#![no_std]

mod access_control;
mod test;
mod token_helpers;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, BytesN, Env, Symbol,
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
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractPaused = 1,
    InsufficientBalance = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    UserNotFound = 5,
    SelfTransfer = 6,
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
    AllPendingClaims,
    Balance(String),
    FeeRateBps,
    FeeTreasuryUsername,
}

const MAX_FEE: i128 = 5_000_000;

#[contractevent(topics = ["VAULT", "withdrawal"])]
pub struct WithdrawalEvent {
    pub username: String,
    pub to_address: Address,
    pub amount: i128,
    pub ledger: u32,
}

#[contractevent(topics = ["VAULT", "transfer"])]
pub struct TransferEvent {
    pub from: String,
    pub to: String,
    pub amount: i128,
    pub fee: i128,
    pub net_amount: i128,
    pub note: String,
    pub ledger: u32,
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

/// Ledgers after process_payment after which a claim can be cancelled without force.
const CLAIM_EXPIRY_LEDGERS: u32 = 10000;

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn transfer(
        env: Env,
        from_username: String,
        to_username: String,
        amount: i128,
        note: String,
    ) -> Result<(), Error> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(Error::ContractPaused);
        }

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if from_username == to_username {
            return Err(Error::SelfTransfer);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let from_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(from_username.clone()))
            .ok_or(Error::UserNotFound)?;

        if !env
            .storage()
            .instance()
            .has(&DataKey::Balance(to_username.clone()))
        {
            return Err(Error::UserNotFound);
        }

        if from_balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let fee_rate_bps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::FeeRateBps)
            .unwrap_or(0);
        let fee_treasury_username: String = env
            .storage()
            .instance()
            .get(&DataKey::FeeTreasuryUsername)
            .expect("Fee treasury not set");

        let fee = (amount * fee_rate_bps) / 10_000;
        let net_amount = amount - fee;

        // Deduct from sender
        env.storage()
            .instance()
            .set(&DataKey::Balance(from_username.clone()), &(from_balance - amount));

        // Credit to recipient
        let to_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(to_username.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance(to_username.clone()), &(to_balance + net_amount));

        // Credit fee to treasury
        let treasury_balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(fee_treasury_username.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(
                &DataKey::Balance(fee_treasury_username),
                &(treasury_balance + fee),
            );

        // Bump TTL
        env.storage().instance().extend_ttl(100, 1000);

        // Emit event
        TransferEvent {
            from: from_username,
            to: to_username,
            amount,
            fee,
            net_amount,
            note,
            ledger: env.ledger().sequence(),
        }
        .publish(&env);

        Ok(())
    }

    pub fn withdraw(
        env: Env,
        username: String,
        to_address: Address,
        amount: i128,
    ) -> Result<(), Error> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(Error::ContractPaused);
        }

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Balance(username.clone()))
            .ok_or(Error::UserNotFound)?;

        if balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let new_balance = balance - amount;
        env.storage()
            .instance()
            .set(&DataKey::Balance(username.clone()), &new_balance);

        env.storage().instance().extend_ttl(100, 1000);

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), &to_address, &amount);

        WithdrawalEvent {
            username: username.clone(),
            to_address,
            amount,
            ledger: env.ledger().sequence(),
        }
        .publish(&env);

        Ok(())
    }

    pub fn set_balance(env: Env, caller: Address, username: String, balance: i128) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::Balance(username), &balance);
    }

    pub fn get_balance(env: Env, username: String) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(username))
            .unwrap_or(0)
    }

    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc_token: Address,
        fee_amount: i128,
        min_deposit: i128,
        fee_rate_bps: i128,
        fee_treasury_username: String,
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
            .set(&DataKey::FeeRateBps, &fee_rate_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeTreasuryUsername, &fee_treasury_username);
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

    pub fn set_fee_rate(env: Env, caller: Address, fee_rate_bps: i128) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::FeeRateBps, &fee_rate_bps);
    }

    pub fn get_fee_rate(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::FeeRateBps)
            .unwrap_or(0)
    }

    pub fn set_fee_treasury(env: Env, caller: Address, fee_treasury_username: String) {
        access_control::require_role(&env, &caller, access_control::ADMIN_ROLE);
        caller.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::FeeTreasuryUsername, &fee_treasury_username);
    }

    pub fn get_fee_treasury(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::FeeTreasuryUsername)
            .expect("Fee treasury not set")
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