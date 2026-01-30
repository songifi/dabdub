# Security Policy

This API is secured with the following measures:

## 1. CORS
Cross-Origin Resource Sharing is restricted.
- **Allowed Origins**: Configured via `CORS_WHITELIST` environment variable (comma-separated).
- **Default**: Blocks all origins if not whitelisted (except in non-production environments).

## 2. Rate Limiting
We use a Redis-backed rate limiter to prevent abuse.
- **Global Limit**: 100 requests per 15 minutes per IP (DoS protection level).
- **API Endpoint Limit**: 10 requests per minute by default.
- **API Key**: If `X-API-KEY` header is present, limits are applied per API key.

### Configuration
Environment variables:
- `REDIS_HOST`: Redis host for rate limit storage.
- `REDIS_PORT`: Redis port.

## 3. Headers (Helmet)
We use `helmet` to set secure HTTP headers:
- `Content-Security-Policy`: Default restrictive policy.
- `Strict-Transport-Security`: Enforced.
- `X-Content-Type-Options`: nosniff.
- `X-Frame-Options`: SAMEORIGIN.

## 4. Request Size
- **JSON Body**: Max 10mb.
- **URL Encoded**: Max 10mb.
