#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, BytesN, Env, String, Vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Backend,
    Vault,
    UsdcToken,
    UserWallet(BytesN<32>), // user_id_hash -> wallet address
    AllWallets,
    TotalWallets,
    Paused,
    WalletWasm,
}

// Events
#[contractevent(topics = ["FACTORY", "wallet_created"])]
struct WalletCreatedEvent {
    user_id_hash: BytesN<32>,
    wallet: Address,
}

#[contractevent(topics = ["FACTORY", "backend_upd"])]
struct BackendUpdatedEvent {
    old_backend: Address,
    new_backend: Address,
}

#[contractevent(topics = ["FACTORY", "vault_upd"])]
struct VaultUpdatedEvent {
    old_vault: Address,
    new_vault: Address,
}

#[contract]
pub struct WalletFactory;

#[contractimpl]
impl WalletFactory {
    pub fn __constructor(
        env: Env,
        admin: Address,
        backend: Address,
        vault: Address,
        usdc_token: Address,
        wallet_wasm_hash: BytesN<32>,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Backend, &backend);
        env.storage().instance().set(&DataKey::Vault, &vault);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage()
            .instance()
            .set(&DataKey::WalletWasm, &wallet_wasm_hash);
        env.storage().instance().set(&DataKey::TotalWallets, &0u32);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::AllWallets, &Vec::<Address>::new(&env));
    }

    /// Create a new user wallet
    pub fn create_wallet(env: Env, caller: Address, user_id: String) -> Address {
        let backend: Address = env.storage().instance().get(&DataKey::Backend).unwrap();
        if caller != backend {
            panic!("Only backend");
        }

        caller.require_auth();

        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("Factory is paused");
        }

        // Hash user_id
        let user_id_hash = env.crypto().sha256(&user_id.to_bytes());

        // Check if wallet already exists
        let wallet_key = DataKey::UserWallet(user_id_hash.clone().into());
        if env.storage().instance().has(&wallet_key) {
            panic!("Wallet already exists");
        }

        // Get deployment parameters
        let vault: Address = env.storage().instance().get(&DataKey::Vault).unwrap();
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let wasm_hash: BytesN<32> = env.storage().instance().get(&DataKey::WalletWasm).unwrap();

        // Deploy the wallet contract with unique salt
        let salt = user_id_hash.to_bytes();
        let wallet_address = env.deployer().with_current_contract(salt).deploy_v2(
            wasm_hash,
            (
                backend.clone(),
                vault.clone(),
                usdc_token.clone(),
                None::<Address>,
            ),
        );

        // Store mapping
        env.storage().instance().set(&wallet_key, &wallet_address);

        // Add to all wallets list
        let mut all_wallets: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::AllWallets)
            .unwrap_or(Vec::new(&env));
        all_wallets.push_back(wallet_address.clone());
        env.storage()
            .instance()
            .set(&DataKey::AllWallets, &all_wallets);

        // Increment counter
        let mut total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalWallets)
            .unwrap();
        total += 1;
        env.storage().instance().set(&DataKey::TotalWallets, &total);

        WalletCreatedEvent {
            user_id_hash: user_id_hash.into(),
            wallet: wallet_address.clone(),
        }
        .publish(&env);

        wallet_address
    }

    /// Get wallet address for a user
    pub fn get_wallet(env: Env, user_id: String) -> Option<Address> {
        let user_id_hash = env.crypto().sha256(&user_id.to_bytes());
        let wallet_key = DataKey::UserWallet(user_id_hash.into());
        env.storage().instance().get(&wallet_key)
    }

    /// Check if user has a wallet
    pub fn has_wallet(env: Env, user_id: String) -> bool {
        let user_id_hash = env.crypto().sha256(&user_id.to_bytes());
        let wallet_key = DataKey::UserWallet(user_id_hash.into());
        env.storage().instance().has(&wallet_key)
    }

    /// Get total wallets created
    pub fn get_total_wallets(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalWallets)
            .unwrap_or(0)
    }

    /// Update backend address (admin only)
    pub fn update_backend(env: Env, caller: Address, new_backend: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("Only admin");
        }

        caller.require_auth();

        let old_backend: Address = env.storage().instance().get(&DataKey::Backend).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::Backend, &new_backend);

        BackendUpdatedEvent {
            old_backend,
            new_backend: new_backend.clone(),
        }
        .publish(&env);
    }

    /// Update vault address (admin only)
    pub fn update_vault(env: Env, caller: Address, new_vault: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("Only admin");
        }

        caller.require_auth();

        let old_vault: Address = env.storage().instance().get(&DataKey::Vault).unwrap();
        env.storage().instance().set(&DataKey::Vault, &new_vault);

        VaultUpdatedEvent {
            old_vault,
            new_vault: new_vault.clone(),
        }
        .publish(&env);
    }

    /// Pause factory (admin only)
    pub fn pause(env: Env, caller: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("Only admin");
        }

        caller.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    /// Unpause factory (admin only)
    pub fn unpause(env: Env, caller: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("Only admin");
        }

        caller.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    // View functions
    pub fn get_backend(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Backend).unwrap()
    }

    pub fn get_vault(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Vault).unwrap()
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

mod test;
