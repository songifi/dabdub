# Grafana Dashboard — HTTP Request Latency

This document provides PromQL queries and a Grafana panel configuration for visualizing per-endpoint latency percentiles using the `http_request_duration_ms` histogram exported by the application.

## Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_ms` | Histogram | `method`, `route`, `status` | Request latency in milliseconds |
| `http_requests_total` | Counter | `method`, `route`, `status` | Total number of HTTP requests |

## PromQL Queries

### p50 (median) latency per endpoint

```promql
histogram_quantile(0.50,
  sum(rate(http_request_duration_ms_bucket{route=~"$route"}[5m])) by (le, route)
)
```

### p95 latency per endpoint

```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_ms_bucket{route=~"$route"}[5m])) by (le, route)
)
```

### p99 latency per endpoint

```promql
histogram_quantile(0.99,
  sum(rate(http_request_duration_ms_bucket{route=~"$route"}[5m])) by (le, route)
)
```

### Request rate (RPS) per endpoint

```promql
sum(rate(http_requests_total{route=~"$route"}[5m])) by (route)
```

### Error rate per endpoint

```promql
sum(rate(http_requests_total{status=~"4..|5..",route=~"$route"}[5m])) by (route)
/
sum(rate(http_requests_total{route=~"$route"}[5m])) by (route)
```

## Grafana Panel JSON

You can import the following panel JSON into a Grafana dashboard. It assumes:
- Data source: Prometheus
- Variable: `$route` — label_values(http_request_duration_ms, route)

```json
{
  "id": null,
  "title": "HTTP Latency per Endpoint",
  "type": "timeseries",
  "targets": [
    {
      "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_ms_bucket{route=~\"$route\"}[5m])) by (le, route))",
      "legendFormat": "p50 {{ route }}",
      "refId": "A"
    },
    {
      "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket{route=~\"$route\"}[5m])) by (le, route))",
      "legendFormat": "p95 {{ route }}",
      "refId": "B"
    },
    {
      "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_ms_bucket{route=~\"$route\"}[5m])) by (le, route))",
      "legendFormat": "p99 {{ route }}",
      "refId": "C"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "ms",
      "custom": {
        "drawStyle": "line",
        "lineInterpolation": "linear",
        "pointSize": 5,
        "showPoints": "auto"
      }
    },
    "overrides": []
  },
  "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
  "options": {
    "tooltip": { "mode": "multi" },
    "legend": { "displayMode": "table", "placement": "right" }
  }
}
```

## Additional Panels

### Total Requests Counter

```json
{
  "title": "Total Requests",
  "type": "stat",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total[5m]))",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": { "unit": "reqps" }
  }
}
```

### Slow Request Rate (>1s)

Use the `_bucket` metric with the `le="+Inf"` and `le="1000"` buckets, or filter by log events `slow_http_request` if log-based metrics are available.

```promql
(
  sum(rate(http_request_duration_ms_bucket{le="+Inf",route=~"$route"}[5m])) by (route)
  -
  sum(rate(http_request_duration_ms_bucket{le="1000",route=~"$route"}[5m])) by (route)
)
/
sum(rate(http_request_duration_ms_bucket{le="+Inf",route=~"$route"}[5m])) by (route)
```

## Notes

- Ensure `scrape_interval` in Prometheus is ≤ 15s for accurate rate calculations.
- The histogram uses millisecond buckets (`[5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]`), suitable for REST APIs.
- Use `route` label (e.g., `/api/v1/users/:id`) rather than `originalUrl` to keep cardinality bounded.

