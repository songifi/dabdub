#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

const BPS_DENOM: i128 = 10_000;

#[contracttype]
enum DataKey {
    Admin,
    Treasury,
    LpAddress,
    LpShareBps,
    UsdcToken,
}

#[contracttype]
struct FeeDistributedEvent {
    treasury_amount: i128,
    lp_amount: i128,
    lp_share_bps: i128,
}

#[contract]
pub struct FeeDistributorContract;

#[contractimpl]
impl FeeDistributorContract {
    pub fn __constructor(
        env: Env,
        admin: Address,
        treasury: Address,
        lp_address: Address,
        lp_share_bps: i128,
        usdc_token: Address,
    ) {
        assert!(lp_share_bps >= 0 && lp_share_bps <= BPS_DENOM, "bps out of range");
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::LpAddress, &lp_address);
        env.storage().instance().set(&DataKey::LpShareBps, &lp_share_bps);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
    }

    /// Splits `total_fee` between treasury and LP atomically.
    /// Caller must have pre-approved this contract to transfer `total_fee` tokens.
    pub fn distribute(env: Env, caller: Address, total_fee: i128) {
        caller.require_auth();
        assert!(total_fee > 0, "total_fee must be > 0");

        let lp_share_bps: i128 = env.storage().instance().get(&DataKey::LpShareBps).unwrap();
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let lp_address: Address = env.storage().instance().get(&DataKey::LpAddress).unwrap();
        let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();

        let lp_amount = total_fee
            .checked_mul(lp_share_bps)
            .expect("overflow")
            .checked_div(BPS_DENOM)
            .expect("div zero");
        let treasury_amount = total_fee.checked_sub(lp_amount).expect("underflow");

        // Pull full fee from caller into this contract first, then push out.
        // Both outbound transfers happen in the same tx — atomicity is guaranteed
        // by Soroban's all-or-nothing execution model.
        let token = token::Client::new(&env, &usdc_token);
        token.transfer(&caller, &env.current_contract_address(), &total_fee);

        if treasury_amount > 0 {
            token.transfer(&env.current_contract_address(), &treasury, &treasury_amount);
        }
        if lp_amount > 0 {
            token.transfer(&env.current_contract_address(), &lp_address, &lp_amount);
        }

        env.events().publish(
            ("FEE_DISTRIBUTOR", "fee_distributed"),
            FeeDistributedEvent {
                treasury_amount,
                lp_amount,
                lp_share_bps,
            },
        );
    }

    /// Update LP share ratio. Admin-only.
    pub fn set_lp_share(env: Env, caller: Address, bps: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        assert!(bps >= 0 && bps <= BPS_DENOM, "bps out of range");
        env.storage().instance().set(&DataKey::LpShareBps, &bps);
    }

    /// Update treasury address. Admin-only.
    pub fn set_treasury(env: Env, caller: Address, treasury: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    /// Update LP address. Admin-only.
    pub fn set_lp_address(env: Env, caller: Address, lp_address: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        env.storage().instance().set(&DataKey::LpAddress, &lp_address);
    }

    pub fn get_config(env: Env) -> (Address, Address, i128) {
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let lp_address: Address = env.storage().instance().get(&DataKey::LpAddress).unwrap();
        let lp_share_bps: i128 = env.storage().instance().get(&DataKey::LpShareBps).unwrap();
        (treasury, lp_address, lp_share_bps)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(caller == &admin, "not admin");
    }
}
