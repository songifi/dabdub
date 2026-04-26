import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const loginLatency = new Trend('login_latency', true);
const createPaymentLatency = new Trend('create_payment_latency', true);
const listPaymentsLatency = new Trend('list_payments_latency', true);

// ─── Options ──────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 1000,          // 1,000 req/min
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 150,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],   // p95 < 500ms
    error_rate: ['rate<0.001'],          // < 0.1% errors
    login_latency: ['p(95)<500'],
    create_payment_latency: ['p(95)<500'],
    list_payments_latency: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function randomEmail(): string {
  return `loadtest_${__VU}_${Date.now()}@test.com`;
}

// ─── Setup: register one account per VU ───────────────────────────────────────
export function setup() {
  // Pre-register a shared test account used by all VUs
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: 'k6_shared@test.com',
      password: 'K6TestPass123!',
      businessName: 'K6 Load Test',
      businessType: 'testing',
      country: 'US',
    }),
    { headers: jsonHeaders() },
  );

  // If already registered, login instead
  if (res.status === 409) {
    const login = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: 'k6_shared@test.com', password: 'K6TestPass123!' }),
      { headers: jsonHeaders() },
    );
    return { token: login.json('accessToken') as string };
  }

  return { token: res.json('accessToken') as string };
}

// ─── Default function ─────────────────────────────────────────────────────────
export default function (data: { token: string }) {
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% — login
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: 'k6_shared@test.com', password: 'K6TestPass123!' }),
      { headers: jsonHeaders() },
    );
    loginLatency.add(Date.now() - start);
    const ok = check(res, { 'login 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  } else if (scenario < 0.65) {
    // 35% — create payment
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/payments`,
      JSON.stringify({ amountUsd: 10 + Math.floor(Math.random() * 90), description: 'k6 test' }),
      { headers: jsonHeaders(data.token) },
    );
    createPaymentLatency.add(Date.now() - start);
    const ok = check(res, { 'create payment 201': (r) => r.status === 201 });
    errorRate.add(!ok);
  } else {
    // 35% — list payments
    const start = Date.now();
    const res = http.get(`${BASE_URL}/payments?page=1&limit=20`, {
      headers: jsonHeaders(data.token),
    });
    listPaymentsLatency.add(Date.now() - start);
    const ok = check(res, { 'list payments 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  }

  sleep(0.05); // small think time
}
