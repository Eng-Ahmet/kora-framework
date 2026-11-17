# Rule 07: Multi-Engine Database & ORM Integration

## 1. Multi-Engine Architecture
Kora's database tier provides first-class support for three core paradigms:
1. **Relational SQL (MySQL, PostgreSQL, SQLite)**:
   - Automated migration and table blueprint generation.
   - Safe parameterized queries (`db.query(sql)` / `db.execute(sql)`).
   - Dynamic table CRUD (`db.customers.create(...)`, `db.orders.findUnique(...)`).
   - ACID transaction blocks (`db.begin()`, `db.commit()`, `db.rollback()`).
2. **Document NoSQL (MongoDB-compatible)**:
   - Dynamic collections via `db.collection("name")`.
   - Operations: `insertOne(doc)`, `findOne(filter)`, `find(filter)`, `updateOne(filter, update)`, `deleteMany(filter)`.
   - Nested dot-path queries (`metadata.ip`).
3. **Key-Value Cache (Redis-compatible)**:
   - Fast cache operations: `db.get(key)`, `db.set(key, val)`, `db.setEx(key, val, ttl)`.
   - Atomic rate-limiting counters: `db.incr(key)`, `db.decr(key)`.
   - Hashes and queues: `db.hset(key, field, val)`, `db.lpush(key, val)`, `db.rpop(key)`.

## 2. Testing & Mock Data Prohibition
Never use hardcoded mock objects where a database connection is specified. Include a real `docker-compose.yml` for services requiring external databases.

## 3. Mandatory Database Entity & Model Distinction
Whenever a `model` is defined for database persistence, it MUST be explicitly identified and annotated:
- **Relational SQL Tables**: Must be annotated with `@table("table_name")` (or `@entity @table("...")`), with primary key `@id`, and column attributes like `@column("column_name")`, `@unique`, `@index`.
- **NoSQL Document Collections**: Must be annotated with `@collection("collection_name")`, with `@id` and field indexing annotations.
- **DTOs vs Database Entities**: Plain DTOs, request payloads, and API response envelopes (e.g. `LoginRequest`, `UserProfileDto`, `GeoLocation`) must remain unannotated by table decorators. This structural distinction between persistence models and transport models is mandatory across the framework.
