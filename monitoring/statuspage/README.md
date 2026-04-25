# Status Page — status.cheesepay.xyz

Self-hosted status page deployed as a **Cloudflare Worker**. It:

1. Serves `index.html` at `status.cheesepay.xyz`
2. Proxies `GET /api/status` → `https://api.cheesepay.xyz/health/admin` (avoids CORS, adds 30s edge cache)
3. The HTML polls `/api/status` every 60 seconds and renders real-time component status

---

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Cloudflare account with `cheesepay.xyz` zone added
- `wrangler login` completed

---

## Deploy

```bash
cd monitoring/statuspage

# Install wrangler if needed
npm install -g wrangler

# Authenticate
wrangler login

# Set your Cloudflare account ID in wrangler.toml
# account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"

# Deploy to production
wrangler deploy
```

The worker will be live at `status.cheesepay.xyz` within seconds.

---

## DNS

Cloudflare Workers with a custom route handle DNS automatically when the zone is on Cloudflare (orange-cloud proxy). No additional CNAME needed.

If the zone is NOT on Cloudflare, add:
```
status.cheesepay.xyz  CNAME  cheesepay-status.YOUR_SUBDOMAIN.workers.dev
```

---

## Local Development

```bash
wrangler dev
# Opens http://localhost:8787
```

Note: In local dev, `STATUS_HTML` text blob may not load — the worker falls back to a placeholder. Test the full flow after deploying.

---

## What the Status Page Shows

| Component | Source field | Critical? |
|-----------|-------------|-----------|
| Database | `components.database` | Yes — 503 if down |
| Stellar / Horizon | `components.stellar` | Yes — 503 if down |
| Partner API | `components.partnerApi` | No — degraded only |
| Redis / Queue | `components.redis` | No — degraded only |
| Background Jobs | `components.queue` | No — degraded only |

Data comes from `GET /health/admin` which is defined in `backend/src/health/health.controller.ts`.

---

## Updating the Status Page

Edit `index.html` and redeploy:

```bash
wrangler deploy
```

Changes are live globally within ~30 seconds.
