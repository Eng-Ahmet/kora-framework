# Example 04: Multi-Engine Database Suite (MySQL, PostgreSQL, SQLite, NoSQL & Redis Cache)

## Overview
This enterprise reference example demonstrates Kora's unified **Multi-Engine Database Suite** and ORM layer:
- **Relational SQL Engines**: First-class support for **MySQL**, **PostgreSQL**, and **SQLite**:
  - Auto-dialect switching: MySQL (`` `col` `` and `?`), PostgreSQL (`"col"` and `$1, $2`), SQLite (`"col"` and `?1`).
  - 100% Parameterized Query Builder immune to SQL injection.
  - Complex Joins (`INNER JOIN`, `LEFT JOIN`), Group By, Having, and Aggregates (`count`, `sum`, `avg`, `min`, `max`).
- **ACID Transaction Management**:
  - Atomic multi-operation fund transfers with isolation levels (`RepeatableRead`, `Serializable`).
  - Automatic Rollback on error and Savepoint support.
- **NoSQL Document Database (MongoDB-compatible)**:
  - Schema-free collections: `db.collection("customer_audit_events").insertOne(...)`.
  - Nested dot-path queries (`"metadata.device"`), update operators, unique indexes, and pagination.
- **In-Memory Key-Value Store & Cache (Redis-compatible)**:
  - String caching with TTL expiration: `db.cache.setEx(key, val, ttl)`.
  - Atomic counters (`incr`, `decr`), Hashes (`hset`, `hget`), and Lists (`lpush`, `rpop`).
- **Strict Clean Architecture Segregation**:
  - Independent models in `models/` (enforcing `E5002`).
  - Repository IoC contracts in `interfaces/` (enforcing `E5003`).
  - Modular implementation in `services/` (enforcing `E5001`).
  - Decoupled router mounted in `main.kora` via `app.use(CustomerRouter)`.

---

## Directory Structure
```text
04_mysql_database_orm/
├── README.md
├── main.kora                               # Clean Application Container with app.use(CustomerRouter)
├── docker-compose.yml                      # Production MySQL 8.4 & PostgreSQL container specs
├── mysql-init.sql                          # MySQL relational schema & sample records
├── interfaces/
│   └── customer.repository.interface.kora  # Multi-engine repository interface contract
├── models/
│   └── customer.models.kora                # Relational, Document, Cache & Transfer DTOs
├── routes/
│   └── customer.routes.kora                # REST Router delegating to multi-engine repository
└── services/
    └── mysql_customer.service.kora         # SQL, NoSQL Document Store & Redis cache implementation
```

---

## Multi-Engine Capabilities

### 1. Relational SQL Query Builder
```kora
let q = this.db.query("SELECT id, full_name, email, credit_balance, active FROM customers WHERE email = ?")
let res = this.db.customers.create(customer)
let exec = this.db.execute("UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?")
```

### 2. ACID Transactional Fund Transfer
```kora
let b = this.db.begin()
let debit = this.db.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?")
let credit = this.db.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?")
let c = this.db.commit()
```

### 3. NoSQL Document Store Operations
```kora
let docId = this.db.collection("customer_audit_events").insertOne(doc)
let found = this.db.collection("customer_audit_events").findOne(customerId)
```

### 4. Redis-Compatible Key-Value Cache
```kora
let ok = this.db.cache.setEx(profile.cacheKey, profile.cachedSession, profile.ttlSeconds)
let session = this.db.cache.get(cacheKey)
let hits = this.db.cache.incr("rate_limit_counter")
```

---

## Verification & Execution Commands

### 1. Type Check Application
```bash
kora check main.kora
```
Output:
```text
✓ Checked `main.kora` — 0 errors (frontend & ownership verified).
```

### 2. Compile & Run Native Service
```bash
kora run main.kora
```
Output:
```text
⚡ Route/Middleware mounted: CustomerRouter
⚡ Server listening on http://127.0.0.1:3000
```

### 3. Run Multi-Engine ORM Rust Test Suite
```bash
cargo test -p kora-orm
```
Output:
```text
test tests::security_verifies_sql_injection_immunity_with_malicious_payloads ... ok
test tests::verifies_mysql_and_postgres_dialects_and_joins ... ok
test tests::verifies_nosql_document_store_operations ... ok
test tests::verifies_schema_migration_ddl_generation ... ok
test tests::verifies_redis_key_value_cache_store ... ok
test tests::runs_in_memory_sqlite_query_builder ... ok

test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; finished in 0.00s
```
