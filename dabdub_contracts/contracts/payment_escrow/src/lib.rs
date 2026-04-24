#![no_std]

mod test;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, BytesN, Env,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Released,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentEscrow {
    pub payment_id: BytesN<32>,
    pub amount: i128,
    pub merchant: Address,
    pub customer: Address,
    pub status: PaymentStatus,
    pub expiry: u32,
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

#[contractevent(topics = ["ESCROW", "expiry"])]
struct ExpiryEvent {
    payment_id: BytesN<32>,
    customer: Address,
    amount: i128,
}

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
    ) -> BytesN<32> {
        customer.require_auth();

        if amount <= 0 {
            panic!("Amount must be > 0");
        }

        let key = DataKey::Payment(payment_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("Payment ID already exists");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(&customer, &env.current_contract_address(), &amount);

        let default_ttl_ledgers: u32 = env
            .storage()
            .instance()
            .get(&DataKey::DefaultTtlLedgers)
            .unwrap();
        let expiry = env.ledger().sequence().saturating_add(default_ttl_ledgers);

        let payment = PaymentEscrow {
            payment_id: payment_id.clone(),
            amount,
            merchant: merchant.clone(),
            customer: customer.clone(),
            status: PaymentStatus::Pending,
            expiry,
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
        Self::require_pending(&payment);

        if env.ledger().sequence() > payment.expiry {
            panic!("Payment expired");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &payment.merchant,
            &payment.amount,
        );

        payment.status = PaymentStatus::Released;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        ReleaseEvent {
            payment_id,
            merchant: payment.merchant,
            amount: payment.amount,
        }
        .publish(&env);
    }

    pub fn expire(env: Env, payment_id: BytesN<32>) {
        let mut payment = Self::get_payment(env.clone(), payment_id.clone());
        Self::require_pending(&payment);

        if env.ledger().sequence() <= payment.expiry {
            panic!("Payment has not expired");
        }

        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &payment.customer,
            &payment.amount,
        );

        payment.status = PaymentStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::Payment(payment_id.clone()), &payment);

        ExpiryEvent {
            payment_id,
            customer: payment.customer,
            amount: payment.amount,
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
        if payment.status == PaymentStatus::Pending {
            payment.amount
        } else {
            0
        }
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

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != &admin {
            panic!("Not admin");
        }
    }

    fn require_pending(payment: &PaymentEscrow) {
        if payment.status != PaymentStatus::Pending {
            panic!("Payment is not pending");
        }
    }
}
