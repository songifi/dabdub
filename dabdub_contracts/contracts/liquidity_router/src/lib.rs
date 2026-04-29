#![no_std]

mod test;

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Symbol};

const BPS_DENOMINATOR: i128 = 10_000;
const MAX_SLIPPAGE_BPS: i128 = 100;

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
pub struct SwapExecuted {
    pub amount_in: i128,
    pub amount_out: i128,
}

#[soroban_sdk::contractclient(name = "AmmClient")]
pub trait AmmInterface {
    fn get_reserves(env: Env) -> (i128, i128);
    fn swap_xlm_to_usdc(env: Env, amount: i128, min_out: i128) -> i128;
}

#[contract]
pub struct LiquidityRouter;

#[contractimpl]
impl LiquidityRouter {
    pub fn swap_xlm_to_usdc(env: Env, amount: i128, min_out: i128) -> i128 {
        if amount <= 0 {
            panic!("amount must be > 0");
        }
        if min_out < 0 {
            panic!("min_out must be >= 0");
        }

        // Placeholder for a future AMM cross-contract call; keep uncoupled.
        let amount_out = Self::stub_amm_swap(amount);
        if amount_out < min_out {
            panic!("min_out not met");
        }

        env.events().publish(
            (Symbol::new(&env, "SwapExecuted"),),
            SwapExecuted {
                amount_in: amount,
                amount_out,
            },
        );

        amount_out
    }

    /// Checks if the AMM pool has sufficient depth for a swap.
    /// Returns SorobanAMM if depth is sufficient (< 10% impact),
    /// otherwise returns StellarClassicDEX and emits an event.
    pub fn check_and_route(env: Env, pool_address: Address, amount_in: i128) -> Route {
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

    fn stub_amm_swap(amount: i128) -> i128 {
        amount
            .checked_mul(BPS_DENOMINATOR - MAX_SLIPPAGE_BPS)
            .expect("overflow")
            .checked_div(BPS_DENOMINATOR)
            .expect("div by zero")
    }
}
