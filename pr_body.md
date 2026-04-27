## 📌 Summary
Implements [Soroban] Liquidity pool health check and fallback routing contract (#842).

## 🚀 What was done
- Developed a pre-swap validation layer within the Soroban contract logic.
- Implemented cross-contract calls to fetch real-time reserve data from AMM pools.
- Built a fallback mechanism to redirect swap execution to the Stellar Classic DEX when AMM liquidity is thin.
- Integrated event emission for transparency on routing decisions.

## 🧠 Key Logic
- **Depth Verification:** The contract now evaluates if $S < (R \times 0.10)$, where $S$ is the swap size and $R$ is the total reserve. 
- **Hybrid Routing:** By bridging Soroban smart contracts with Stellar Classic assets, the system optimizes for the best possible price execution.
- **Event Audit:** The `FallbackRouteUsed` event captures the pool ID and the impact threshold that triggered the diversion.

## 🔒 Validations
- Verified that the cross-contract call handles potential target contract failures gracefully.
- Ensured that the 10% threshold is robust against rounding errors in fixed-point math.

## 🧪 Tests
- ✅ Mock-based unit tests for "Deep Pool" (Soroban routing).
- ✅ Mock-based unit tests for "Shallow Pool" (DEX fallback routing).
- ✅ Event emission verification during fallback triggers.
- ✅ Gas usage audit for the pre-swap check overhead.

## 📎 Notes
- This implementation relies on accurate price/reserve data from the target AMM contracts.

Closes #842
