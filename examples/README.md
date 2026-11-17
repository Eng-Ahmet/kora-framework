# Kora Official Examples & Architecture Catalog

Welcome to the official collection of Kora examples. Each example is housed in its own isolated directory to prevent collisions, demonstrate clean code patterns, and illustrate specific capabilities of the Kora language and framework.

---

## 📚 Examples Directory Index

| # | Example Directory | Topic / Paradigm | Key Features Demonstrated | Command |
|:---:|:---|:---|:---|:---|
| **01** | [`01_hello_world`](./01_hello_world/) | **Language Fundamentals** | Models, algebraic enums, pattern matching, functions, static typing | `kora run examples/01_hello_world/main.kora` |
| **02** | [`02_clean_architecture_users`](./02_clean_architecture_users/) | **Clean Architecture REST** | Model/service segregation, interface contracts, dependency injection | `kora run examples/02_clean_architecture_users/main.kora` |
| **03** | [`03_crud_products_api`](./03_crud_products_api/) | **Full CRUD & Dynamic SEO/Geo** | `GET`/`POST`/`PUT`/`DELETE`, OpenGraph/Twitter SEO, client Geo headers | `kora run examples/03_crud_products_api/main.kora` |
| **04** | [`04_mysql_database_orm`](./04_mysql_database_orm/) | **Multi-Engine Relational SQL ORM** | MySQL/PostgreSQL/SQLite pools, parameterized queries, ACID transactions, NoSQL collections, Redis caching | `kora run examples/04_mysql_database_orm/main.kora` |
| **05** | [`05_jwt_auth_argon2`](./05_jwt_auth_argon2/) | **Enterprise Security** | Argon2id password hashing, HMAC-SHA256 JWT tokens, auth DTOs | `kora run examples/05_jwt_auth_argon2/main.kora` |
| **06** | [`06_realtime_websockets`](./06_realtime_websockets/) | **Realtime & WebSockets** | Pub/sub topic broadcasting, channel presence, realtime streaming | `kora run examples/06_realtime_websockets/main.kora` |
| **07** | [`07_async_actors_concurrency`](./07_async_actors_concurrency/) | **Actor Model Concurrency** | Isolated actor state, MPSC channels, non-blocking background workers | `kora run examples/07_async_actors_concurrency/main.kora` |
| **08** | [`08_openapi_swagger`](./08_openapi_swagger/) | **OpenAPI 3.1 & Swagger UI** | Zero-config spec discovery, interactive `/docs` UI, dynamic head meta | `kora run examples/08_openapi_swagger/main.kora` |
| **09** | [`09_enterprise_clean_architecture`](./09_enterprise_clean_architecture/) | **Full Enterprise Showcase** | 40+ source files, DDD modules, middleware, database layer | `kora run examples/09_enterprise_clean_architecture/src/main.kora` |
| **10** | [`10_dto_validation_and_types`](./10_dto_validation_and_types/) | **DTO Defense & Type Safety** | Robust validation, files/images, JSON, arrays, enums | `kora run examples/10_dto_validation_and_types/main.kora` |
| **11** | [`11_operators_control_flow_and_resilience`](./11_operators_control_flow_and_resilience/) | **Operators & Try/Catch Resilience** | `??`, `+=`, `for..in`, `break`, `continue`, `try/catch/finally` | `kora run examples/11_operators_control_flow_and_resilience/main.kora` |
| **12** | [`12_microservice_event_driven`](./12_microservice_event_driven/) | **Event-Driven Architecture** | Outbox pattern, domain event publisher, event sourcing | `kora run examples/12_microservice_event_driven/main.kora` |
| **13** | [`13_modular_monolith_ecommerce`](./13_modular_monolith_ecommerce/) | **Modular Monolith** | Bounded contexts, catalog and billing modules | `kora run examples/13_modular_monolith_ecommerce/src/main.kora` |
| **14** | [`14_realtime_iot_telemetry`](./14_realtime_iot_telemetry/) | **IoT Telemetry Ingestion** | High-throughput metric collection, device presence | `kora run examples/14_realtime_iot_telemetry/main.kora` |
| **15** | [`15_data_structures_sequential`](./15_data_structures_sequential/) | **Sequential Collections** | `Vector`, `Array`, `VecDeque`, `LinkedList`, `Stack`, `Queue`, `CircularBuffer` | `kora run examples/15_data_structures_sequential/main.kora` |
| **16** | [`16_data_structures_associative`](./16_data_structures_associative/) | **Associative Collections** | `Map`, `HashMap`, `BTreeMap`, `OrderedMap`, `MultiMap`, `BiMap`, Map Literals | `kora run examples/16_data_structures_associative/main.kora` |
| **17** | [`17_data_structures_sets`](./17_data_structures_sets/) | **Set Collections & Set Algebra** | `Set`, `HashSet`, `BTreeSet`, `OrderedSet`, `BitSet`, `MultiSet`, union/intersection | `kora run examples/17_data_structures_sets/main.kora` |
| **18** | [`18_data_structures_specialized`](./18_data_structures_specialized/) | **Specialized Algorithmic Structures** | `PriorityQueue`, `BinaryHeap`, `Trie`, `Graph`, `DisjointSet`, `BloomFilter`, `LRUCache` | `kora run examples/18_data_structures_specialized/main.kora` |
| **19** | [`19_type_inference_and_types`](./19_type_inference_and_types/) | **Automatic & Safe Type Inference** | Hindley-Milner inference, algebraic enums, pattern matching, typed models | `kora run examples/19_type_inference_and_types/main.kora` |
| **20** | [`20_concurrency_and_streams`](./20_concurrency_and_streams/) | **Concurrency, Channels & Streams** | Async channels, task actors, stream data pipelines, memory arenas | `kora run examples/20_concurrency_and_streams/main.kora` |
| **21** | [`21_caching_and_kv_store`](./21_caching_and_kv_store/) | **Redis In-Memory Key-Value Caching** | Fast TTL key expiration, atomic rate-limiting counters, session cache | `kora run examples/21_caching_and_kv_store/main.kora` |
| **22** | [`22_nosql_document_store`](./22_nosql_document_store/) | **MongoDB NoSQL Document Store** | Schema-free audit trails, dynamic collection querying, compound indexing, bulk pruning | `kora run examples/22_nosql_document_store/main.kora` |
| **23** | [`23_enterprise_reporting_media_email`](./23_enterprise_reporting_media_email/) | **Enterprise Reporting, PDF, Excel & Email** | Native PDF invoices, CSV spreadsheets, secure media processing, TLS email delivery, entities/ segregation | `kora run examples/23_enterprise_reporting_media_email/main.kora` |

---

## 🏛️ Strict Clean Architecture Standards

All examples in this repository strictly satisfy Kora's compiler-enforced architectural guard rules:
1. **Model-Class Segregation (`E5003`)**: Data entities defined via `model` and business classes defined via `class` are never co-located in the same file.
2. **Interface Purity (`E5002`)**: Files inside `interfaces/` and `models/` contain zero executable server logic or route handlers.
3. **Enum Purity (`E5001`)**: Files inside `enums/` contain pure variant definitions without methods or routes.
4. **Lean Orchestration (`E5004`)**: `main.kora` is reserved for dependency wiring and mounting routes via `app.use(Router)`.

---

## 🧪 Verifying All Examples

You can verify the entire catalog in one command:
```bash
# Type check all example entrypoints
for dir in examples/[0-9]*; do
  file="$dir/main.kora"
  [ ! -f "$file" ] && file="$dir/src/main.kora"
  echo "Checking $file..."
  kora check "$file" || exit 1
done
```
