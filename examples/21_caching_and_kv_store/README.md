# Example 21: Redis & Key-Value Caching Architecture

This example demonstrates how Kora natively interfaces with **In-Memory Key-Value Stores (Redis-compatible)** using Clean Architecture and compile-time dependency injection.

## Architectural Layers

```
examples/21_caching_and_kv_store/
├── main.kora                                  # Application entrypoint (app.use)
├── models/
│   └── cache.models.kora                      # DTOs & Domain Models
├── interfaces/
│   └── cache.repository.interface.kora        # Cache Contract
├── services/
│   └── redis_cache.service.kora               # Redis Cache Implementation
├── routes/
│   └── cache.routes.kora                      # HTTP Endpoints (Router Class)
└── docker-compose.yml                         # Production-grade Redis 7 Alpine
```

## Features Demonstrated

1. **TTL Expiration**: Storing keys with explicit time-to-live seconds (`db.setEx(key, val, ttl)`).
2. **Atomic Rate Limiting**: Incrementing counters atomically (`db.incr(clientIp)`) to enforce traffic limits.
3. **Session Store**: Structured session management with automatic expiration.
4. **Clean Architecture Compliance**: Zero global state, router encapsulation, interface segregation.

## Running the Example

```bash
# Start Redis container
docker compose up -d

# Verify compilation
kora check examples/21_caching_and_kv_store/main.kora

# Run the server
kora run examples/21_caching_and_kv_store/main.kora
```
