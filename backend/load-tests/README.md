# Load Tests (k6)

## Prerequisites

```bash
brew install k6          # macOS
# or: https://k6.io/docs/getting-started/installation/
```

## Run against staging

```bash
BASE_URL=https://api-staging.dabdub.xyz/api/v1 k6 run load-tests/payments.k6.ts
```

## Run locally

```bash
# Start the backend first, then:
k6 run load-tests/payments.k6.ts
```

## Thresholds

| Metric | Target |
|--------|--------|
| p95 latency | < 500ms |
| Error rate | < 0.1% |
| Load | 100 VUs / 1,000 req/min |
