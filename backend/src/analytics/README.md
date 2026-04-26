# Analytics Module

This module provides comprehensive analytics for the payment platform, including merchant performance metrics and top merchant identification.

## API Endpoints

### GET /api/v1/admin/analytics/merchants

Retrieves general merchant analytics including signup trends and activation rates.

#### Response Format

```json
{
  "generatedAt": "2026-04-24T10:00:00.000Z",
  "dailySignups": [
    {
      "date": "2026-04-01",
      "signups": 15
    }
  ],
  "activationRate": {
    "windowDays": 7,
    "activatedMerchants": 85,
    "totalMerchants": 100,
    "percentage": 85
  },
  "monthlyActiveMerchants": {
    "month": "2026-04",
    "count": 250
  }
}
```

### GET /api/v1/admin/analytics/top-merchants

Retrieves the top merchants ranked by total USD volume in the selected period.

#### Query Parameters

- `limit` (optional): Number of merchants to return (1-100, default: 10)
- `period` (optional): Time period for analysis (`7d`, `30d`, `90d`, default: `30d`)

#### Example Request

```bash
GET /api/v1/admin/analytics/top-merchants?limit=10&period=30d
```

#### Response Format

```json
{
  "merchants": [
    {
      "businessName": "Acme Corp",
      "volume": 125000.50,
      "paymentCount": 450,
      "settlementCount": 12,
      "country": "US"
    },
    {
      "businessName": "Global Payments Ltd",
      "volume": 98750.25,
      "paymentCount": 320,
      "settlementCount": 8,
      "country": "CA"
    }
  ],
  "period": "30d",
  "generatedAt": "2026-04-24T10:00:00.000Z"
}
```

### GET /api/v1/analytics/funnel

Retrieves payment conversion funnel analytics showing the percentage of payments that progress through each stage from creation to settlement.

#### Query Parameters

- `startDate` (optional): Start date for analysis (ISO 8601 format, default: 30 days ago)
- `endDate` (optional): End date for analysis (ISO 8601 format, default: current date)
- `network` (optional): Filter by payment network (`stellar`)
- `period` (optional): Grouping period (`day`, `week`, `month`)

#### Example Request

```bash
GET /api/v1/analytics/funnel?startDate=2026-03-01&endDate=2026-04-01&network=stellar
```

#### Response Format

```json
{
  "stages": [
    {
      "stage": "created",
      "count": 1000,
      "percentage": 100
    },
    {
      "stage": "confirmed",
      "count": 850,
      "percentage": 85,
      "dropOffCount": 150,
      "dropOffPercentage": 15
    },
    {
      "stage": "settling",
      "count": 800,
      "percentage": 80,
      "dropOffCount": 50,
      "dropOffPercentage": 5.88
    },
    {
      "stage": "settled",
      "count": 750,
      "percentage": 75,
      "dropOffCount": 50,
      "dropOffPercentage": 6.25
    }
  ],
  "totalCreated": 1000,
  "period": {
    "startDate": "2026-03-01T00:00:00.000Z",
    "endDate": "2026-04-01T00:00:00.000Z"
  },
  "network": "stellar",
  "generatedAt": "2026-04-24T10:00:00.000Z"
}
```

## Payment Funnel Features

- **Stage tracking**: Monitors payments through created → confirmed → settling → settled
- **Conversion rates**: Calculates percentage conversion at each stage
- **Drop-off analysis**: Shows count and percentage of payments lost at each transition
- **Network filtering**: Filter analysis by payment network (e.g., Stellar)
- **Date range filtering**: Analyze specific time periods
- **Failed/expired tracking**: Separate tracking for failed and expired payments
- **Real-time data**: No caching for up-to-date conversion metrics

## Top Merchants Features

- **Volume-based ranking**: Merchants ordered by total USD volume
- **Tie-breaking**: When volumes are equal, merchants are ordered by payment count
- **Period filtering**: Configurable time periods (7, 30, or 90 days)
- **Caching**: Results cached for 10 minutes for improved performance
- **Active merchants only**: Only includes merchants with `active` status
- **Confirmed payments only**: Only counts payments with status `confirmed`, `settling`, or `settled`

## Use Cases

- **Payment funnel optimization**: Identify bottlenecks in payment processing
- **Conversion rate monitoring**: Track payment success rates over time
- **Network performance analysis**: Compare conversion rates across different networks
- **Drop-off investigation**: Understand where payments fail in the process
- Identify platform's most valuable merchants
- Analyze merchant performance distribution
- Monitor merchant growth trends
- Platform capacity planning
- Business development prioritization
- Performance analysis and optimization