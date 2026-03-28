# Unstake Implementation TODO

## Steps:

- [x] 1. Update src/lib.rs: Add Error enum, extend DataKey for StakedBalance(String), LiquidBalance(String), StakeStartLedger(String)
- [x] 2. Update src/lib.rs: Add UnstakedEvent, get_stake_balance fn, get_liquid_balance fn
- [x] 3. Update src/lib.rs: Add stake fn (admin, transfer token, update storage)
- [ ] 4. Update src/lib.rs: Add unstake fn with validation, yield calc, storage updates, TTL bump, event
- [ ] 4. Update src/lib.rs: Add unstake fn with validation, yield calc, storage updates, TTL bump, event
- [ ] 5. Update src/test.rs: Add comprehensive tests (stake/unstake happy/edge cases, invariant)
- [ ] 6. Build: cd dadbub_contracts/contracts/vault && soroban contract build
- [ ] 7. Test: soroban contract test
- [ ] 8. Verify all tests pass and complete task

Current: Starting step 1.
