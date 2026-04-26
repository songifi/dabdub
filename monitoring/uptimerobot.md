# UptimeRobot Configuration

UptimeRobot is the **primary** external monitor. It polls from multiple global locations every **1 minute** — satisfying the "detected within 2 minutes" requirement.

---

## 1. Create an Account

Sign up at https://uptimerobot.com (free tier supports up to 50 monitors at 5-min intervals; paid "Pro" plan gives 1-min intervals — required here).

---

## 2. Create Alert Contacts

Before adding monitors, set up where alerts go.

### Email Alert Contact

1. Go to **My Settings → Alert Contacts → Add Alert Contact**
2. Type: **E-mail**
3. Friendly Name: `CheesePay On-Call`
4. E-mail: `oncall@cheesepay.xyz` (or your PagerDuty email integration address)
5. Save

### Slack Alert Contact

1. Add Alert Contact → Type: **Slack**
2. Friendly Name: `CheesePay #alerts`
3. Webhook URL: `$SLACK_WEBHOOK_URL` (see [Slack Webhook Setup](#slack-webhook-setup) below)
4. Save

---

## 3. Add Monitors

### Monitor 1 — API Liveness

| Field | Value |
|-------|-------|
| Monitor Type | HTTP(s) |
| Friendly Name | `CheesePay API - Liveness` |
| URL | `https://api.cheesepay.xyz/health` |
| Monitoring Interval | **1 minute** |
| Monitor Timeout | 30 seconds |
| Alert Contacts | CheesePay On-Call, CheesePay #alerts |
| Alert When Down For | **1 check** (immediate) |

Expected response: HTTP 200, body contains `"status":"ok"`.

Add a **keyword monitor** on top if you want body validation:
- Keyword: `"ok"`
- Keyword Type: exists

### Monitor 2 — API Readiness (DB + Stellar Horizon)

| Field | Value |
|-------|-------|
| Monitor Type | HTTP(s) |
| Friendly Name | `CheesePay API - Readiness (DB + Stellar)` |
| URL | `https://api.cheesepay.xyz/health/ready` |
| Monitoring Interval | **1 minute** |
| Monitor Timeout | 30 seconds |
| Alert Contacts | CheesePay On-Call, CheesePay #alerts |
| Alert When Down For | **1 check** |

This endpoint returns 503 when PostgreSQL or Stellar Horizon is unreachable — it's the most important monitor.

### Monitor 3 — Stellar Horizon (external dependency)

| Field | Value |
|-------|-------|
| Monitor Type | HTTP(s) |
| Friendly Name | `Stellar Horizon` |
| URL | `https://horizon.stellar.org/` |
| Monitoring Interval | 5 minutes |
| Alert Contacts | CheesePay #alerts |
| Alert When Down For | 2 checks |

This is informational — if Horizon is down independently, it explains `/health/ready` failures.

---

## 4. Status Page

1. Go to **Status Pages → Create Status Page**
2. Name: `CheesePay Status`
3. Custom Domain: `status.cheesepay.xyz`
4. Add all three monitors above
5. Set **Password Protection**: off (public page)
6. Enable **Subscribe to Updates** (email/RSS)

### DNS for Custom Domain

Add a CNAME record in your DNS provider:

```
status.cheesepay.xyz  CNAME  stats.uptimerobot.com
```

UptimeRobot will provision an SSL certificate automatically.

---

## 5. Slack Webhook Setup

1. Go to https://api.slack.com/apps → **Create New App** → From scratch
2. App Name: `UptimeRobot`, Workspace: your workspace
3. **Incoming Webhooks** → Activate → Add New Webhook to Workspace
4. Select channel: `#alerts` (or `#oncall`)
5. Copy the Webhook URL → paste into UptimeRobot alert contact

---

## 6. Notification Message Templates

UptimeRobot supports custom alert messages. Use these:

**Down alert:**
```
🔴 [CheesePay] *{{ monitorFriendlyName }}* is DOWN
URL: {{ monitorURL }}
Reason: {{ alertDetails }}
Time: {{ alertDateTime }}
Duration: {{ alertDuration }}
```

**Up alert:**
```
✅ [CheesePay] *{{ monitorFriendlyName }}* is back UP
URL: {{ monitorURL }}
Downtime: {{ alertDuration }}
```

---

## 7. Environment Variables

Add to your `.env` / secrets manager:

```bash
# UptimeRobot
UPTIMEROBOT_API_KEY=your_uptimerobot_api_key
UPTIMEROBOT_MAIN_API_KEY=your_main_api_key  # for programmatic monitor management
```

---

## 8. Programmatic Monitor Management (Optional)

If you want to manage monitors via CI/CD, use the UptimeRobot API:

```bash
# Create a monitor via API
curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=${UPTIMEROBOT_API_KEY}" \
  -d "format=json" \
  -d "type=1" \
  -d "url=https://api.cheesepay.xyz/health" \
  -d "friendly_name=CheesePay+API+-+Liveness" \
  -d "interval=60"
```

Monitor types: `1` = HTTP(s), `2` = keyword, `3` = ping.

---

## Verification Checklist

- [ ] Both monitors show green in UptimeRobot dashboard
- [ ] Test alert: pause a monitor → confirm Slack message arrives within 2 min
- [ ] Test alert: resume monitor → confirm recovery message
- [ ] Status page accessible at `status.cheesepay.xyz`
- [ ] DNS CNAME resolves correctly
- [ ] SSL certificate active on status page
