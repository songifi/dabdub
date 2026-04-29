#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PaymentStatus {
    Pending = 0,
    Confirmed = 1,
    Settling = 2,
    Settled = 3,
    Failed = 4,
    Expired = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub id: String,
    pub merchant: Address,
    pub amount: i128,
    pub asset: Address,
    pub status: PaymentStatus,
    pub created_at: u64,
    pub expiry: u64,
}

#[contracttype]
pub enum DataKey {
    Payment(String),
}

#[contract]
pub struct PaymentRequestContract;

#[contractimpl]
impl PaymentRequestContract {
    /// Initialize a new payment request.
    pub fn create_payment(
        env: Env,
        id: String,
        merchant: Address,
        amount: i128,
        asset: Address,
        expiry: u64,
    ) {
        merchant.require_auth();
        let key = DataKey::Payment(id.clone());
        if env.storage().persistent().has(&key) {
            panic!("Payment already exists");
        }

        let payment = Payment {
            id: id.clone(),
            merchant,
            amount,
            asset,
            status: PaymentStatus::Pending,
            created_at: env.ledger().timestamp(),
            expiry,
        };

        env.storage().persistent().set(&key, &payment);

        env.events().publish(
            (symbol_short!("payment"), id, symbol_short!("created")),
            PaymentStatus::Pending,
        );
    }

    /// Mark payment as confirmed (user has paid).
    pub fn confirm(env: Env, id: String) {
        let key = DataKey::Payment(id.clone());
        let mut payment: Payment = env.storage().persistent().get(&key).expect("Payment not found");

        if payment.status != PaymentStatus::Pending {
            panic!("Invalid transition: can only confirm pending payments");
        }

        if env.ledger().timestamp() > payment.expiry {
            panic!("Payment expired");
        }

        payment.status = PaymentStatus::Confirmed;
        env.storage().persistent().set(&key, &payment);

        env.events().publish(
            (symbol_short!("payment"), id, symbol_short!("confirmed")),
            PaymentStatus::Confirmed,
        );
    }

    /// Move payment to settling state (initiate payout to merchant).
    pub fn set_settling(env: Env, id: String) {
        let key = DataKey::Payment(id.clone());
        let mut payment: Payment = env.storage().persistent().get(&key).expect("Payment not found");

        if payment.status != PaymentStatus::Confirmed {
            panic!("Invalid transition: can only set settling from confirmed");
        }

        payment.status = PaymentStatus::Settling;
        env.storage().persistent().set(&key, &payment);

        env.events().publish(
            (symbol_short!("payment"), id, symbol_short!("settling")),
            PaymentStatus::Settling,
        );
    }

    /// Mark payment as settled (funds received by merchant).
    pub fn settle(env: Env, id: String) {
        let key = DataKey::Payment(id.clone());
        let mut payment: Payment = env.storage().persistent().get(&key).expect("Payment not found");

        // Allow transition from Settling or Confirmed
        if payment.status != PaymentStatus::Settling && payment.status != PaymentStatus::Confirmed {
            panic!("Invalid transition: can only settle from Settling or Confirmed");
        }

        payment.status = PaymentStatus::Settled;
        env.storage().persistent().set(&key, &payment);

        env.events().publish(
            (symbol_short!("payment"), id, symbol_short!("settled")),
            PaymentStatus::Settled,
        );
    }

    /// Mark payment as failed.
    pub fn fail(env: Env, id: String) {
        let key = DataKey::Payment(id.clone());
        let mut payment: Payment = env.storage().persistent().get(&key).expect("Payment not found");

        if payment.status == PaymentStatus::Settled || payment.status == PaymentStatus::Expired {
            panic!("Cannot fail a finalized payment");
        }

        payment.status = PaymentStatus::Failed;
        env.storage().persistent().set(&key, &payment);

        env.events().publish(
            (symbol_short!("payment"), id, symbol_short!("failed")),
            PaymentStatus::Failed,
        );
    }

    /// Mark payment as expired.
    pub fn expire(env: Env, id: String) {
        let key = DataKey::Payment(id.clone());
        let mut payment: Payment = env.storage().persistent().get(&key).expect("Payment not found");

        if payment.status != PaymentStatus::Pending && payment.status != PaymentStatus::Confirmed {
            panic!("Cannot expire a finalized or settling payment");
        }

        if env.ledger().timestamp() <= payment.expiry {
            panic!("Payment has not yet reached expiry time");
        }

        payment.status = PaymentStatus::Expired;
        env.storage().persistent().set(&key, &payment);

        env.events().publish(
            (symbol_short!("payment"), id, symbol_short!("expired")),
            PaymentStatus::Expired,
        );
    }

    /// Fetch payment details.
    pub fn get_payment(env: Env, id: String) -> Payment {
        env.storage().persistent().get(&DataKey::Payment(id)).expect("Payment not found")
    }
}

mod test;
