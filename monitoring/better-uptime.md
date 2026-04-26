# Better Uptime Configuration

Better Uptime is the **secondary monitor and on-call escalation layer**. It polls every **30 seconds** from multiple regions and supports phone call / SMS escalation — ensuring on-call is reached within 5 minutes of an incident.

---

## 1. Create an Account

Sign up at https://betteruptime.com. The "Basic" plan supports 30-second check intervals and on-call scheduling.

---

## 2. Configure On-Call Schedules

### Create On-Call Calendar

1. Go to **On-call** → **Schedules** → **New Schedule**
2. Name: `CheesePay On-Call`
3. Add team members with their phone numbers (for SMS/call escalation)
4. Set rotation: weekly or follow-the-sun as appropriate
5. Save

### Escalation Policy

1. **On-call** → **Escalation Policies** → **New Policy**
2. Name: `CheesePay Escalation`
3. Steps:
   - Step 1 (0 min): Notify on-call via **SMS + Phone call**
   - Step 2 (5 min): Notify backup on-call via **SMS + Phone call**
   - Step 3 (10 min): Notify `#oncall` Slack channel
4. Save

---

## 3. Add Monitors

### Monitor 1 — API Liveness

| Field | Value |
|-------|-------|
| URL | `https://api.cheesepay.xyz/health` |
| Name | `CheesePay API Liveness` |
| Check Frequency | **30 seconds** |
| Request Timeout | 15 seconds |
| Expected Status Code | 200 |
| Confirmation Period | 0 (alert immediately on first failure) |
| Regions | US East, EU West, Asia Pacific (multi-region) |
| Escalation Policy | CheesePay Escalation |

### Monitor 2 — API Readiness (DB + Stellar)

| Field | Value |
|-------|-------|
| URL | `https://api.cheesepay.xyz/health/ready` |
| Name | `CheesePay API Readiness` |
| Check Frequency | **30 seconds** |
| Request Timeout | 15 seconds |
| Expected Status Code | 200 |
| Confirmation Period | 0 |
| Regions | US East, EU West, Asia Pacific |
| Escalation Policy | CheesePay Escalation |

**Advanced → Response Validation:**
- Check that response body contains `"status":"up"` (Terminus format)

### Monitor 3 — Stellar Horizon Connectivity

| Field | Value |
|-------|-------|
| URL | `https://horizon.stellar.org/` |
| Name | `Stellar Horizon` |
| Check Frequency | 1 minute |
| Expected Status Code | 200 |
| Confirmation Period | 1 check |
| Escalation Policy | CheesePay Escalation (Slack only) |

---

## 4. Slack Integration

1. **Integrations** → **Slack** → **Connect**
2. Authorize Better Uptime to your workspace
3. Select channel: `#alerts`
4. Enable: Down alerts, Up alerts, Incident created, Incident resolved

---

## 5. PagerDuty Integration (Optional)

If you use PagerDuty for on-call:

1. **Integrations** → **PagerDuty** → **Connect**
2. Enter your PagerDuty API key
3. Select the service to route incidents to
4. Map Better Uptime escalation policy → PagerDuty service

---

## 6. Status Page

Better Uptime also provides a hosted status page as an alternative to UptimeRobot's.

1. **Status Pages** → **New Status Page**
2. Name: `CheesePay Status`
3. Custom Domain: `status.cheesepay.xyz`
4. Add monitors: API Liveness, API Readiness, Stellar Horizon
5. Group them:
   - **API**: Liveness, Readiness
   - **Infrastructure**: Stellar Horizon
6. Enable subscriber notifications (email)

### DNS

```
status.cheesepay.xyz  CNAME  statuspage.betteruptime.com
```

---

## 7. Incident Workflow

When `/health/ready` returns 503:

1. Better Uptime detects failure at T+0s (30-sec poll)
2. Confirmation: immediate (0 confirmation period)
3. Incident created at T+30s
4. SMS + phone call to on-call at T+30s
5. If no acknowledgement in 5 min → escalate to backup
6. Slack `#alerts` notified at T+30s
7. Status page updated automatically

This satisfies:
- ✅ Downtime detected within 2 minutes (30-sec polling)
- ✅ On-call alerted within 5 minutes (immediate phone call)

---

## 8. Heartbeat Monitor (Optional but Recommended)

Add a heartbeat to verify the app is actively running cron jobs:

1. **Heartbeats** → **New Heartbeat**
2. Name: `CheesePay Cron Health`
3. Period: 5 minutes, Grace: 2 minutes
4. Copy the heartbeat URL

Then add a cron job in the NestJS app to ping it every 5 minutes (see `backend/src/cron/` for the cron infrastructure).

```typescript
// In a cron service
@Cron('*/5 * * * *')
async pingHeartbeat(): Promise<void> {
  const url = this.config.get<string>('BETTER_UPTIME_HEARTBEAT_URL');
  if (url) await axios.get(url).catch(() => {});
}
```

---

## Environment Variables

```bash
# Better Uptime
BETTER_UPTIME_API_TOKEN=your_better_uptime_api_token
BETTER_UPTIME_HEARTBEAT_URL=https://betteruptime.com/api/v1/heartbeat/xxxxx
```

---

## Verification Checklist

- [ ] Both API monitors show green
- [ ] On-call schedule has at least one person assigned
- [ ] Escalation policy tested: pause monitor → confirm phone call within 5 min
- [ ] Slack integration sends to `#alerts`
- [ ] Status page accessible at `status.cheesepay.xyz`
- [ ] Heartbeat monitor receiving pings (if configured)
