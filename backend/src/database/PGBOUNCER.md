# PgBouncer Configuration Guide

PgBouncer is a lightweight connection pooler for PostgreSQL. Use it when horizontally scaling the backend to avoid exhausting PostgreSQL's `max_connections`.

## When to Use PgBouncer

- Running multiple backend instances (e.g., Kubernetes pods, Railway replicas)
- PostgreSQL `max_connections` is being hit under load
- You want to reduce connection overhead on the database server

## Installation

```bash
# Ubuntu / Debian
sudo apt-get install pgbouncer

# Docker
docker run -d --name pgbouncer \
  -e DATABASE_URL="postgres://user:pass@db-host:5432/cheesepay" \
  -p 5432:5432 \
  edoburu/pgbouncer
```

## Recommended `pgbouncer.ini`

```ini
[databases]
cheesepay = host=<DB_HOST> port=5432 dbname=cheesepay

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Transaction pooling is recommended for stateless apps
pool_mode = transaction

; Total connections PgBouncer will open to PostgreSQL
server_pool_size = 25

; Max client connections across all pools
max_client_conn = 200

; Idle server connections are closed after this many seconds
server_idle_timeout = 60

; Acquire timeout for a server connection (seconds)
query_wait_timeout = 10

log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

## Application Settings with PgBouncer

When using PgBouncer in **transaction** mode, set the app pool to a small size since PgBouncer multiplexes connections:

```env
DB_HOST=pgbouncer-host
DB_PORT=5432
DB_POOL_MIN=2
DB_POOL_MAX=10        # Lower than without PgBouncer — PgBouncer handles the rest
DB_ACQUIRE_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=60000
```

> **Note:** In transaction pool mode, `SET` commands, advisory locks, and `LISTEN/NOTIFY` do not work reliably. Avoid these in application code.

## Monitoring Pool Health

The `PoolMonitorService` logs a warning every 30 seconds when the pool is exhausted:

```
[DB Pool] Pool exhausted — total=20 active=20 idle=0 waiting=3
```

If you see this frequently, either increase `DB_POOL_MAX` or add a PgBouncer instance.
