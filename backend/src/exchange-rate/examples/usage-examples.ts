/**
 * Exchange Rate & Liquidity Provider Management - Usage Examples
 */

// GET /api/v1/rates/current
const getCurrentRates = async () => {
  const response = await fetch('http://localhost:3000/api/v1/rates/current', {
    headers: { Authorization: 'Bearer <admin-token>' },
  });
  return response.json();
};

// POST /api/v1/rates/override
const setRateOverride = async () => {
  const response = await fetch('http://localhost:3000/api/v1/rates/override', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer <finance-admin-token>',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokenSymbol: 'ETH',
      fiatCurrency: 'USD',
      rate: '3000.00',
      durationMinutes: 60,
      reason: 'Market experiencing high volatility, setting stable rate',
    }),
  });
  return response.json();
};

// GET /api/v1/liquidity-providers
const listProviders = async () => {
  const response = await fetch(
    'http://localhost:3000/api/v1/liquidity-providers',
    {
      headers: { Authorization: 'Bearer <admin-token>' },
    },
  );
  return response.json();
};

// PATCH /api/v1/liquidity-providers/:id
const updateProvider = async (providerId: string) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/liquidity-providers/${providerId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer <super-admin-token>',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priority: 1,
        feePercentage: '0.0150',
      }),
    },
  );
  return response.json();
};

export { getCurrentRates, setRateOverride, listProviders, updateProvider };
