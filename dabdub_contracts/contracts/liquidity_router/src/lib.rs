#![no_std]

mod test;

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Symbol, Vec};

const RATE_BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Route {
    SorobanAMM,
    StellarClassicDEX,
}

#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct FallbackRouteUsed {
    pub pool_id: Address,
    pub amount: i128,
    pub reserve: i128,
}

#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct PathPaymentExecuted {
    pub send_asset: Address,
    pub dest_asset: Address,
    pub amount: i128,
    pub amount_out: i128,
    pub rate_bps: i128,
    pub path_len: u32,
    pub used_direct_fallback: bool,
}

#[soroban_sdk::contractclient(name = "AmmClient")]
pub trait AmmInterface {
    fn get_reserves(env: Env) -> (i128, i128);
}

#[contract]
pub struct LiquidityRouter;

#[contractimpl]
impl LiquidityRouter {
    pub fn path_pay(
        env: Env,
        send_asset: Address,
        dest_asset: Address,
        amount: i128,
        send_max: i128,
        path: Vec<Address>,
    ) -> i128 {
        if amount <= 0 {
            panic!("amount must be > 0");
        }
        if send_max <= 0 {
            panic!("send_max must be > 0");
        }
        if send_asset == dest_asset {
            panic!("Invalid path");
        }
        if amount > send_max {
            panic!("send_max exceeded");
        }

        let path_len = path.len();
        if path_len > 0 {
            Self::validate_path(&path, &send_asset, &dest_asset);
        }

        // Path is pre-computed off-chain; this stub keeps execution isolated.
        let amount_out = Self::stub_path_output(amount, path_len);
        let rate_bps = Self::effective_rate_bps(amount, amount_out);

        env.events().publish(
            (Symbol::new(&env, "PathPaymentExecuted"),),
            PathPaymentExecuted {
                send_asset,
                dest_asset,
                amount,
                amount_out,
                rate_bps,
                path_len,
                used_direct_fallback: path_len == 0,
            },
        );

        amount_out
    }

    /// Checks if the AMM pool has sufficient depth for a swap.
    /// Returns SorobanAMM if depth is sufficient (< 10% impact),
    /// otherwise returns StellarClassicDEX and emits an event.
    pub fn check_and_route(
        env: Env,
        pool_address: Address,
        amount_in: i128,
    ) -> Route {
        // Query AMM reserves via cross-contract call
        let amm_client = AmmClient::new(&env, &pool_address);
        let (reserve_a, _reserve_b) = amm_client.get_reserves();
        
        // Depth check: amount_in must be less than 10% of reserves
        // S < R / 10
        if amount_in < reserve_a / 10 {
            Route::SorobanAMM
        } else {
            // Emit FallbackRouteUsed event
            env.events().publish(
                (Symbol::new(&env, "FallbackRouteUsed"),),
                FallbackRouteUsed {
                    pool_id: pool_address,
                    amount: amount_in,
                    reserve: reserve_a,
                },
            );
            Route::StellarClassicDEX
        }
    }

    fn validate_path(path: &Vec<Address>, send_asset: &Address, dest_asset: &Address) {
        for i in 0..path.len() {
            let hop = path.get(i).unwrap();
            if hop == send_asset.clone() || hop == dest_asset.clone() {
                panic!("Invalid path");
            }
            if i > 0 {
                let previous = path.get(i - 1).unwrap();
                if hop == previous {
                    panic!("Invalid path");
                }
            }
        }
    }

    fn stub_path_output(amount: i128, path_len: u32) -> i128 {
        amount
            .checked_add(path_len as i128)
            .expect("overflow")
    }

    fn effective_rate_bps(amount: i128, amount_out: i128) -> i128 {
        amount_out
            .checked_mul(RATE_BPS_DENOMINATOR)
            .expect("overflow")
            .checked_div(amount)
            .expect("div by zero")
    }
}
