#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    ClaimPeriodEnabled,
    ClaimPeriodDuration,
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Initialize the vault contract with claim period configuration
    pub fn __constructor(
        env: Env,
        admin: Address,
        claim_period_enabled: bool,
        claim_period_duration: u64,
    ) {
        admin.require_auth();
        
        // Store admin address
        env.storage().instance().set(&DataKey::Admin, &admin);
        
        // Initialize claim period settings
        env.storage()
            .instance()
            .set(&DataKey::ClaimPeriodEnabled, &claim_period_enabled);
        env.storage()
            .instance()
            .set(&DataKey::ClaimPeriodDuration, &claim_period_duration);
    }

    /// Set claim period configuration (admin only)
    pub fn set_claim_period(env: Env, enabled: bool, duration: u64) {
        // Verify admin authorization
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();

        // Update claim period settings
        env.storage()
            .instance()
            .set(&DataKey::ClaimPeriodEnabled, &enabled);
        env.storage()
            .instance()
            .set(&DataKey::ClaimPeriodDuration, &duration);
    }

    /// Get current claim period configuration
    pub fn get_claim_period(env: Env) -> (bool, u64) {
        let enabled: bool = env
            .storage()
            .instance()
            .get(&DataKey::ClaimPeriodEnabled)
            .unwrap_or(false);
        
        let duration: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ClaimPeriodDuration)
            .unwrap_or(0);

        (enabled, duration)
    }

    /// Process payment (placeholder for existing functionality)
    pub fn process_payment(env: Env, beneficiary: Address, amount: i128) {
        // Existing payment processing logic would go here
        // This is a placeholder to show where claim period logic would integrate
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_constructor_initializes_claim_period() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        
        // Initialize with claim period enabled and 100 ledgers duration
        client.mock_all_auths().constructor(&admin, &true, &100);
        
        let (enabled, duration) = client.get_claim_period();
        assert_eq!(enabled, true);
        assert_eq!(duration, 100);
    }

    #[test]
    fn test_set_claim_period_updates_configuration() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        
        // Initialize with claim period disabled
        client.mock_all_auths().constructor(&admin, &false, &0);
        
        // Update claim period configuration
        client.mock_all_auths().set_claim_period(&true, &200);
        
        let (enabled, duration) = client.get_claim_period();
        assert_eq!(enabled, true);
        assert_eq!(duration, 200);
    }

    #[test]
    fn test_get_claim_period_returns_defaults_when_not_set() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);
        
        // Without initialization, should return defaults
        let (enabled, duration) = client.get_claim_period();
        assert_eq!(enabled, false);
        assert_eq!(duration, 0);
    }

    #[test]
    fn test_disable_claim_period() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        
        // Initialize with claim period enabled
        client.mock_all_auths().constructor(&admin, &true, &100);
        
        // Disable claim period
        client.mock_all_auths().set_claim_period(&false, &0);
        
        let (enabled, duration) = client.get_claim_period();
        assert_eq!(enabled, false);
        assert_eq!(duration, 0);
    }

    #[test]
    fn test_update_claim_period_duration_only() {
        let env = Env::default();
        let contract_id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        
        // Initialize with claim period enabled
        client.mock_all_auths().constructor(&admin, &true, &100);
        
        // Update duration while keeping it enabled
        client.mock_all_auths().set_claim_period(&true, &500);
        
        let (enabled, duration) = client.get_claim_period();
        assert_eq!(enabled, true);
        assert_eq!(duration, 500);
    }
}
