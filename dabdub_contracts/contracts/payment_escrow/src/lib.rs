#![no_std]

mod test;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, BytesN, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Disputed,
    Released,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentEscrow {
    pub payment_id: BytesN<32>,
    pub amount: i128,
    pub released_amount: i128,
    pub merchant: Address,
    pub customer: Address,
    pub status: PaymentStatus,
    pub expiry: u32,
    pub dispute_window_end: u32,
    pub dispute_reason: Option<String>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    UsdcToken,
    DefaultTtlLedgers,
    Payment(BytesN<32>),
}

#[contractevent(topics = ["ESCROW", "deposit"])]
struct DepositEvent {
    payment_id: BytesN<32>,
    customer: Address,
    merchant: Address,
    amount: i128,
    expiry: u32,
}

#[contractevent(topics = ["ESCROW", "release"])]
struct ReleaseEvent {
    payment_id: BytesN<32>,
    merchant: Address,
    amount: i128,
}

#[contractevent(topics = ["ESCROW", "partial_release"])]
struct PartialReleaseEvent {
    payment_id: BytesN<32>,
    merchant: Address,
    amount: i128,
}

#[contractevent(topics = ["ESCROW", "expiry"])]
struct ExpiryEvent {
    payment_id: BytesN<32>,
    customer: Address,
    amount: i128,
}

#[contractevent(topics = ["ESCROW", "dispute_opened"])]
struct DisputeOpenedEvent {
    payment_id: BytesN<32>,
    opened_by: Address,
    reason: String,
}

#[contractevent(topics = ["ESCROW", "dispute_resolved"])]
struct DisputeResolvedEvent {
    payment_id: BytesN<32>,
    winner: Address,
    amount: i128,
}

const MAX_DISPUTE_WINDOW_LEDGERS: u32 = 51_840;
const MAX_TTL_LEDGERS: u32 = 518_400;

#[contract]
pub struct PaymentEscrowContract;

#[contractimpl]
impl PaymentEscrowContract {
    pub fn __constructor(env: Env, admin: Address, usdc_token: Address, default_ttl_ledgers: u32) {
        if default_ttl_ledgers == 0 {
            panic!("Default TTL must be > 0");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage()
            .instance()
            .set(&DataKey::DefaultTtlLedgers, &default_ttl_ledgers);
    }

    pub fn deposit(
        env: Env,
        customer: Address,
        payment_id: BytesN<32>,
        merchant: Address,
        amount: i128,
        ttl_ledgers: u32,
    ) -> BytesN<32> {
        customer.require_auth();

        if amount <= 0 {
            panic!("Amount must be > 0");
        }
        if ttl_ledgers == 0 {
            panic!("TTL must be > 0");
        }
        if ttl_ledgers > MAX_TTL_LEDGERS {
            panic!("TTL exceeds maximum");
        }

        let key = DataKey::Payment(payment_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("Payment ID already exists");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&customer, &env.current_contract_address(), &amount);

        let expiry = env.ledger().sequence().saturating_add(ttl_ledgers);
        let dispute_window_end = {
            let max_window_end = env
                .ledger()
                .sequence()
                .saturating_add(MAX_DISPUTE_WINDOW_LEDGERS);
            if expiry < max_window_end {
                expiry
            } else {
                max_window_end
            }
        };

        let payment = PaymentEscrow {
            payment_id: payment_id.clone(),
            amount,
            released_amount: 0,
            merchant: merchant.clone(),
            customer: customer.clone(),
            status: PaymentStatus::Pending,
            expiry,
            dispute_window_end,
            dispute_reason: None,
        };

        env.storage().persistent().set(&key, &payment);

        DepositEvent {
            payment_id: payment_id.clone(),
            customer,
            merchant,
            amount,
            expiry,
        }
        .publish(&env);

        payment_id
    }

    pub fn release(env: Env, caller: Address, payment_id: BytesN<32>) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let mut payment = Self::get_payment(env.clone(), payment_id.clone());
        Self::require_releasable(&env, &payment);

        let remaining = Self::remaining_amount(&payment);
        if remaining <= 0 {
            panic!("Payment fully released");
        }

        Self::transfer_from_contract(&env, &payment.merchant, remaining);
        payment.released_amount = payment.amount;
        payment.status = PaymentStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        ReleaseEvent {
            payment_id,
            merchant: payment.merchant,
            amount: remaining,
        }
        .publish(&env);
    }

    pub fn release_partial(env: Env, caller: Address, payment_id: BytesN<32>, amount: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        if amount <= 0 {
            panic!("Release amount must be > 0");
        }

        let mut payment = Self::get_payment(env.clone(), payment_id.clone());
        Self::require_releasable(&env, &payment);

        let remaining = Self::remaining_amount(&payment);
        if remaining <= 0 {
            panic!("Payment fully released");
        }
        if amount > remaining {
            panic!("Release amount exceeds remaining balance");
        }

        Self::transfer_from_contract(&env, &payment.merchant, amount);
        payment.released_amount += amount;
        if payment.released_amount == payment.amount {
            payment.status = PaymentStatus::Released;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        PartialReleaseEvent {
            payment_id,
            merchant: payment.merchant,
            amount,
        }
        .publish(&env);
    }

    pub fn expire(env: Env, payment_id: BytesN<32>) {
        Self::refund(env, payment_id);
    }

    pub fn refund(env: Env, payment_id: BytesN<32>) {
        let mut payment = Self::get_payment(env.clone(), payment_id.clone());
        Self::require_expirable(&env, &payment);

        let remaining = Self::remaining_amount(&payment);
        if remaining <= 0 {
            panic!("Payment fully released");
        }

        Self::transfer_from_contract(&env, &payment.customer, remaining);
        payment.released_amount = payment.amount;
        payment.status = PaymentStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        ExpiryEvent {
            payment_id,
            customer: payment.customer,
            amount: remaining,
        }
        .publish(&env);
    }

    pub fn dispute(env: Env, caller: Address, payment_id: BytesN<32>, reason: String) {
        caller.require_auth();

        let mut payment = Self::get_payment(env.clone(), payment_id.clone());
        if payment.status == PaymentStatus::Disputed {
            panic!("Dispute already open");
        }
        if payment.status != PaymentStatus::Pending {
            panic!("Payment is not pending");
        }
        if caller != payment.customer && caller != payment.merchant {
            panic!("Not payment participant");
        }
        if env.ledger().sequence() > payment.dispute_window_end {
            panic!("Dispute window expired");
        }

        payment.status = PaymentStatus::Disputed;
        payment.dispute_reason = Some(reason.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        DisputeOpenedEvent {
            payment_id,
            opened_by: caller,
            reason,
        }
        .publish(&env);
    }

    pub fn resolve_dispute(env: Env, caller: Address, payment_id: BytesN<32>, winner: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let mut payment = Self::get_payment(env.clone(), payment_id.clone());
        if payment.status != PaymentStatus::Disputed {
            panic!("Dispute is not open");
        }
        if winner != payment.customer && winner != payment.merchant {
            panic!("Invalid dispute winner");
        }

        let remaining = Self::remaining_amount(&payment);
        if remaining <= 0 {
            panic!("Payment fully released");
        }

        Self::transfer_from_contract(&env, &winner, remaining);
        payment.status = if winner == payment.merchant {
            PaymentStatus::Released
        } else {
            PaymentStatus::Expired
        };
        payment.released_amount = payment.amount;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        DisputeResolvedEvent {
            payment_id,
            winner,
            amount: remaining,
        }
        .publish(&env);
    }

    pub fn get_payment(env: Env, payment_id: BytesN<32>) -> PaymentEscrow {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(payment_id))
            .expect("Payment not found")
    }

    pub fn get_balance(env: Env, payment_id: BytesN<32>) -> i128 {
        let payment = Self::get_payment(env, payment_id);
        Self::remaining_amount(&payment)
    }

    pub fn get_expiry(env: Env, payment_id: BytesN<32>) -> u32 {
        Self::get_payment(env, payment_id).expiry
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_usdc_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::UsdcToken).unwrap()
    }

    pub fn get_default_ttl_ledgers(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::DefaultTtlLedgers)
            .unwrap()
    }

    pub fn get_max_dispute_window_ledgers(_env: Env) -> u32 {
        MAX_DISPUTE_WINDOW_LEDGERS
    }

    pub fn get_max_ttl_ledgers(_env: Env) -> u32 {
        MAX_TTL_LEDGERS
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != &admin {
            panic!("Not admin");
        }
    }

    fn require_releasable(env: &Env, payment: &PaymentEscrow) {
        if payment.status == PaymentStatus::Disputed {
            panic!("Dispute is open");
        }
        if payment.status == PaymentStatus::Released {
            panic!("Payment fully released");
        }
        if payment.status == PaymentStatus::Expired {
            panic!("Payment expired");
        }
        if env.ledger().sequence() > payment.expiry {
            panic!("Payment expired");
        }
    }

    fn require_expirable(env: &Env, payment: &PaymentEscrow) {
        if payment.status == PaymentStatus::Disputed {
            panic!("Dispute is open");
        }
        if payment.status == PaymentStatus::Released {
            panic!("Payment fully released");
        }
        if payment.status != PaymentStatus::Pending {
            panic!("Payment is not pending");
        }
        if env.ledger().sequence() <= payment.expiry {
            panic!("Payment has not expired");
        }
    }

    fn remaining_amount(payment: &PaymentEscrow) -> i128 {
        payment.amount.saturating_sub(payment.released_amount)
    }

    fn transfer_from_contract(env: &Env, recipient: &Address, amount: i128) {
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(env, &usdc_token);
        token_client.transfer(&env.current_contract_address(), recipient, &amount);
    }
}
