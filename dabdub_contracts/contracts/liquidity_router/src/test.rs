#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Events, vec, Address, Env, IntoVal, Symbol};

#[contract]
pub struct MockAmm;

#[contractimpl]
impl MockAmm {
    pub fn get_reserves(env: Env) -> (i128, i128) {
        let res_a = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "res_a"))
            .unwrap_or(0);
        let res_b = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, "res_b"))
            .unwrap_or(0);
        (res_a, res_b)
    }

    pub fn set_reserves(env: Env, res_a: i128, res_b: i128) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "res_a"), &res_a);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "res_b"), &res_b);
    }
}

#[test]
fn test_deep_pool_routing() {
    let env = Env::default();
    let pool_address = env.register_contract(None, MockAmm);
    let router_id = env.register_contract(None, LiquidityRouter);
    let router_client = LiquidityRouterClient::new(&env, &router_id);

    // Set high reserves: 1000
    let amm_client = MockAmmClient::new(&env, &pool_address);
    amm_client.set_reserves(&1000i128, &1000i128);

    // Swap 50 (5% of 1000) -> Should be deep enough (50 * 10 = 500 < 1000)
    let route = router_client.check_and_route(&pool_address, &50i128);
    assert_eq!(route, Route::SorobanAMM);

    // Check no fallback event emitted
    assert_eq!(env.events().all().len(), 0);
}

#[test]
fn test_swap_xlm_to_usdc_emits_event() {
    let env = Env::default();
    let router_id = env.register_contract(None, LiquidityRouter);
    let router_client = LiquidityRouterClient::new(&env, &router_id);

    let amount_out = router_client.swap_xlm_to_usdc(&1000i128, &990i128);

    assert_eq!(amount_out, 990);

    let events = env.events().all();
    let event = events.last().unwrap();
    assert_eq!(
        event.0,
        vec![&env, Symbol::new(&env, "SwapExecuted").into_val(&env)]
    );
    assert_eq!(
        event.1,
        SwapExecuted {
            amount_in: 1000,
            amount_out: 990,
        }
        .into_val(&env)
    );
}

#[test]
#[should_panic(expected = "min_out not met")]
fn test_swap_xlm_to_usdc_reverts_when_min_out_not_met() {
    let env = Env::default();
    let router_id = env.register_contract(None, LiquidityRouter);
    let router_client = LiquidityRouterClient::new(&env, &router_id);

    router_client.swap_xlm_to_usdc(&1000i128, &991i128);
}

#[test]
fn test_shallow_pool_routing() {
    let env = Env::default();
    env.mock_all_auths();

    let pool_address = env.register_contract(None, MockAmm);
    let router_id = env.register_contract(None, LiquidityRouter);
    let router_client = LiquidityRouterClient::new(&env, &router_id);

    // Set low reserves: 100
    let amm_client = MockAmmClient::new(&env, &pool_address);
    amm_client.set_reserves(&100i128, &100i128);

    // Swap 20 (20% of 100) -> Should trigger fallback (20 * 10 = 200 >= 100)
    let route = router_client.check_and_route(&pool_address, &20i128);
    assert_eq!(route, Route::StellarClassicDEX);

    // Verify event
    let events = env.events().all();
    assert!(events.len() >= 1);

    let event = events.last().unwrap();

    // The event should match our FallbackRouteUsed struct
    // Topics: (Symbol(FallbackRouteUsed),)
    assert_eq!(
        event.0,
        vec![&env, Symbol::new(&env, "FallbackRouteUsed").into_val(&env)]
    );

    // Data check (simplistic for this test)
    let expected_event = FallbackRouteUsed {
        pool_id: pool_address,
        amount: 20,
        reserve: 100,
    };

    assert_eq!(event.1, expected_event.into_val(&env));
}

#[test]
fn test_borderline_depth() {
    let env = Env::default();
    let pool_address = env.register_contract(None, MockAmm);
    let router_id = env.register_contract(None, LiquidityRouter);
    let router_client = LiquidityRouterClient::new(&env, &router_id);

    // Set reserves: 100
    let amm_client = MockAmmClient::new(&env, &pool_address);
    amm_client.set_reserves(&100i128, &100i128);

    // Swap 10 (10% of 100) -> S * 10 < R ? 10 * 10 < 100 is False (100 < 100 is False)
    // So it should trigger fallback
    let route = router_client.check_and_route(&pool_address, &10i128);
    assert_eq!(route, Route::StellarClassicDEX);
}
