use soroban_sdk::{contract, contractimpl, contracttype, contracterror, contractevent, Address, BytesN, Env, Symbol, symbol_short};

/// Events for tracking claim lifecycle
/// 
/// These events enable comprehensive monitoring of the claim period feature,
/// allowing off-chain systems to track creation, completion, and cancellation
/// of payment claims.

/// Emitted when a new claim is created with a claim period
/// 
/// This event captures all relevant information about a newly created claim,
/// including the payment details, involved parties, and expiry information.
#[contractevent(topics = ["VAULT", "claim_created"])]
pub struct ClaimCreatedEvent {
    /// Unique identifier for the payment
    pub payment_id: BytesN<32>,
    /// Address of the user who initiated the payment
    pub user_wallet: Address,
    /// Address of the recipient who can claim the payment
    pub recipient: Address,
    /// Amount to be paid to the recipient
    pub payment_amount: i128,
    /// Fee amount charged for the transaction
    pub fee_amount: i128,
    /// Ledger number when the claim expires
    pub expiry_ledger: u32,
}

/// Emitted when a claim is successfully completed
/// 
/// This event is triggered when a recipient successfully claims their payment
/// within the claim period.
#[contractevent(topics = ["VAULT", "claim_completed"])]
pub struct ClaimCompletedEvent {
    /// Unique identifier for the payment
    pub payment_id: BytesN<32>,
    /// Address of the recipient who claimed the payment
    pub recipient: Address,
    /// Total amount claimed (payment + any additional amounts)
    pub total_amount: i128,
}

/// Emitted when a claim is cancelled
/// 
/// This event is triggered when a claim is cancelled, either due to expiry,
/// user cancellation, or other reasons.
#[contractevent(topics = ["VAULT", "claim_cancelled"])]
pub struct ClaimCancelledEvent {
    /// Unique identifier for the payment
    pub payment_id: BytesN<32>,
    /// Reason for cancellation (e.g., "expired", "user_cancel")
    pub reason: Symbol,
}

/// Updated payment processed event to indicate claim status
/// 
/// This event is emitted when a payment is processed, with an additional
/// field to indicate whether the payment has a pending claim period.
#[contractevent(topics = ["VAULT", "payment_processed"])]
pub struct PaymentProcessedEvent {
    /// Unique identifier for the payment
    pub payment_id: BytesN<32>,
    /// Address of the user who initiated the payment
    pub user_wallet: Address,
    /// Address of the recipient
    pub recipient: Address,
    /// Total amount processed
    pub amount: i128,
    /// Whether this payment has a pending claim period
    pub claim_pending: bool,
}

// Example contract implementation showing how to emit these events
#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Example function: Create a new claim
    /// 
    /// This demonstrates how to emit the ClaimCreatedEvent when a new claim
    /// is created with a claim period.
    pub fn create_claim(
        env: Env,
        payment_id: BytesN<32>,
        user_wallet: Address,
        recipient: Address,
        payment_amount: i128,
        fee_amount: i128,
        expiry_ledger: u32,
    ) {
        // Emit the claim created event
        env.events().publish(
            (symbol_short!("VAULT"), symbol_short!("claim_created")),
            ClaimCreatedEvent {
                payment_id: payment_id.clone(),
                user_wallet: user_wallet.clone(),
                recipient: recipient.clone(),
                payment_amount,
                fee_amount,
                expiry_ledger,
            },
        );
        
        // Additional claim creation logic would go here
    }

    /// Example function: Complete a claim
    /// 
    /// This demonstrates how to emit the ClaimCompletedEvent when a recipient
    /// successfully claims their payment.
    pub fn complete_claim(
        env: Env,
        payment_id: BytesN<32>,
        recipient: Address,
        total_amount: i128,
    ) {
        // Emit the claim completed event
        env.events().publish(
            (symbol_short!("VAULT"), symbol_short!("claim_completed")),
            ClaimCompletedEvent {
                payment_id: payment_id.clone(),
                recipient: recipient.clone(),
                total_amount,
            },
        );
        
        // Additional claim completion logic would go here
    }

    /// Example function: Cancel a claim
    /// 
    /// This demonstrates how to emit the ClaimCancelledEvent when a claim
    /// is cancelled for any reason.
    pub fn cancel_claim(
        env: Env,
        payment_id: BytesN<32>,
        reason: Symbol,
    ) {
        // Emit the claim cancelled event
        env.events().publish(
            (symbol_short!("VAULT"), symbol_short!("claim_cancelled")),
            ClaimCancelledEvent {
                payment_id: payment_id.clone(),
                reason,
            },
        );
        
        // Additional claim cancellation logic would go here
    }

    /// Example function: Process payment with claim status
    /// 
    /// This demonstrates how to emit the updated PaymentProcessedEvent
    /// that includes the claim_pending flag.
    pub fn process_payment(
        env: Env,
        payment_id: BytesN<32>,
        user_wallet: Address,
        recipient: Address,
        amount: i128,
        claim_pending: bool,
    ) {
        // Emit the payment processed event with claim status
        env.events().publish(
            (symbol_short!("VAULT"), symbol_short!("payment_processed")),
            PaymentProcessedEvent {
                payment_id: payment_id.clone(),
                user_wallet: user_wallet.clone(),
                recipient: recipient.clone(),
                amount,
                claim_pending,
            },
        );
        
        // Additional payment processing logic would go here
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events};
    use soroban_sdk::{vec, Env};

    #[test]
    fn test_claim_created_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);

        let payment_id = BytesN::from_array(&env, &[0u8; 32]);
        let user_wallet = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.create_claim(
            &payment_id,
            &user_wallet,
            &recipient,
            &1000,
            &50,
            &100,
        );

        let events = env.events().all();
        assert!(events.len() > 0);
    }

    #[test]
    fn test_claim_completed_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);

        let payment_id = BytesN::from_array(&env, &[0u8; 32]);
        let recipient = Address::generate(&env);

        client.complete_claim(&payment_id, &recipient, &1050);

        let events = env.events().all();
        assert!(events.len() > 0);
    }

    #[test]
    fn test_claim_cancelled_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);

        let payment_id = BytesN::from_array(&env, &[0u8; 32]);
        let reason = symbol_short!("expired");

        client.cancel_claim(&payment_id, &reason);

        let events = env.events().all();
        assert!(events.len() > 0);
    }

    #[test]
    fn test_payment_processed_with_claim_pending() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);

        let payment_id = BytesN::from_array(&env, &[0u8; 32]);
        let user_wallet = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.process_payment(
            &payment_id,
            &user_wallet,
            &recipient,
            &1000,
            &true,
        );

        let events = env.events().all();
        assert!(events.len() > 0);
    }
}
