# Kora Architecture & Compiler Pipeline Specifications

> **"Write Less. Build Faster. Run Smarter."**  
> The comprehensive engineering architecture of the Kora programming language compiler and runtime ecosystem.

---

## 1. Architectural Philosophy & Core Tenets

Kora is engineered from first principles as an expressive, memory-safe backend programming language targeting high-throughput distributed systems, web gateways, and enterprise microservices.

### Core Design Invariants:
1. **Zero-Cost Abstractions**: High-level syntax lowers directly into optimal, `#![forbid(unsafe_code)]` native Rust compiled via LLVM with zero garbage collection pauses.
2. **Strict Clean Architecture Enforcement (`E5001`-`E5004`)**: Architectural boundaries are enforced by the compiler and language server at compile-time:
   - `E5001`: Prohibits defining models, enums, or interfaces inside service/controller class files.
   - `E5002`: Prohibits defining classes or enums inside model files.
   - `E5003`: Prohibits defining models, classes, or enums inside interface files.
   - `E5004`: Keeps `main.kora` strictly focused on composition and server bootstrapping via `app.use(RouterClass)`.
3. **Automatic Safe Type Inference**: Local variables (`let` and `var`) receive bidirectional Hindley-Milner-inspired type inference without sacrificing static compile-time soundness.
4. **Unified Multi-Engine Data Layer**: First-class standard library support for Relational SQL (MySQL, PostgreSQL, SQLite), NoSQL Document Store (MongoDB-compatible), and In-Memory Key-Value Caching (Redis-compatible).

---

## 2. Complete Compiler Pipeline

```text
┌────────────────────────────────────────────────────────┐
│                   Kora Source Code                     │
│                     (*.kora, *.kr)                     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  1. kora-lexer & kora-span                             │
│     • Character stream to Token stream                 │
│     • Preserves precise byte-level source spans        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  2. kora-parser                                        │
│     • Pratt operator precedence parsing                │
│     • Emits Abstract Syntax Tree (AST)                 │
│     • Syntax error recovery and diagnostics            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  3. kora-ast & kora-hir                                │
│     • AST lowering to High-Level Intermediate Rep (HIR)│
│     • Semantic desugaring of control flow and macros   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  4. kora-ty (Type System & Inference)                  │
│     • Bidirectional type inference (TypeInferenceEngine│
│     • Interface conformance & DI contract validation   │
│     • Exhaustive pattern matching verification         │
│     • Enforces E5001-E5004 Clean Architecture rules    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  5. kora-ownership                                     │
│     • Borrow checker & escape analysis                 │
│     • Move semantics and lifetime resolution           │
│     • Generates OwnershipPlan for codegen              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  6. kora-codegen                                       │
│     • Emits `#![forbid(unsafe_code)]` Rust source code │
│     • Automatic argument cloning for multi-use vars    │
│     • Wires App container, routing, and DI resolution  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  7. Cargo & LLVM Toolchain                             │
│     • Compiles generated Rust into native machine code │
│     • Optimized binary emitted into .kora-build/bin    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  8. Execution & Kora Runtime (kora-runtime)            │
│     • Native high-speed collections                    │
│     • Async actors, channels, and task groups          │
│     • Multi-engine database connection pools           │
└────────────────────────────────────────────────────────┘
```

---

## 3. Crate Responsibilities & Boundaries

The Kora codebase is partitioned into unidirectional, loosely coupled crates:

| Crate | Purpose | Key Modules / Types |
| :--- | :--- | :--- |
| `crates/kora-span` | Source location primitives | `Span`, `SourceMap`, `BytePos`, line/column resolution |
| `crates/kora-diagnostics` | Rich compiler diagnostics | `Diagnostic`, `DiagnosticEngine`, colored snippet renderer |
| `crates/kora-lexer` | Lexical analysis | `Lexer`, `Token`, `TokenKind`, string interpolation |
| `crates/kora-parser` | Syntax parsing | `Parser`, recursive descent, Pratt precedence parsing |
| `crates/kora-ast` | Abstract Syntax Tree | `Module`, `Item`, `Stmt`, `Expr`, `TypeExpr`, `Pattern` |
| `crates/kora-hir` | High-Level IR | `HirModule`, `HirItem`, `HirExpr`, semantic desugaring |
| `crates/kora-ty` | Type checking & inference | `TypeChecker`, `Ty`, `TypeInferenceEngine`, interface conformance |
| `crates/kora-ownership` | Memory & borrow analysis | `OwnershipChecker`, `OwnershipPlan`, move/borrow tracking |
| `crates/kora-codegen` | Native Rust emitter | `generate_rust()`, struct/class lowering, route registration |
| `crates/kora-runtime` | Core standard library | `Vector`, `HashMap`, `LruCache`, `BloomFilter`, `Actor`, `Stream` |
| `crates/kora-orm` | Multi-engine database suite| `SqlDialect`, `QueryBuilder`, `DocumentStore`, `KeyValueStore` |
| `crates/kora-http` | HTTP server & routing | `App`, route tree, request/response lifecycle, middleware |
| `crates/kora-auth` | Identity & security | JWT token issuance, Argon2 password hashing, RBAC |
| `crates/kora-realtime` | Realtime streaming | WebSockets, room presence, bidirectional pub/sub |
| `crates/kora-queue` | Background task queues | Priority job queues, retry backoff, workers |
| `crates/kora-observability` | Telemetry & metrics | Prometheus metrics, trace ID propagation, structured logging |
| `crates/kora-lsp` | Language Server Protocol | Autocompletion, diagnostics, hover, definition provider |
| `crates/kora-cli` | Command-line toolchain | `check`, `run`, `build`, `test`, `fmt`, `lsp`, `bench`, `db` |
| `crates/kora-fmt` | Canonical formatter | Source code AST-based pretty printer |
| `crates/kora-testing` | Unit test assertions | Automated test runner harness |
| `crates/kora-bench` | Benchmarking framework | High-concurrency performance benchmark engine |
| `crates/kora-pkg` | Package management | Distributed package resolution and registry client |
| `crates/kora-profiler` | Execution profiler | CPU and memory profiling instrumentation |

---

## 4. Multi-Engine Database Architecture

The `kora-orm` crate provides unified data persistence through three distinct tiers:

1. **Relational SQL Tier (`crates/kora-orm/src/dialect.rs` & `query.rs`)**:
   - Auto-adapts syntax and parameter placeholders for MySQL (`?`), PostgreSQL (`$1, $2`), and SQLite (`?1`).
   - 100% Parameterized queries preventing SQL injection vulnerabilities.
   - Fluent query builder with Joins, Group By, Having, and Aggregates.
2. **NoSQL Document Store Tier (`crates/kora-orm/src/nosql.rs`)**:
   - Embedded schema-free JSON/BSON document store matching MongoDB's collection semantics.
   - Dot-path nested querying (`user.profile.age`), update operators (`$set`, `$inc`), and unique index constraints.
3. **In-Memory Key-Value & Cache Tier (`crates/kora-orm/src/kv.rs`)**:
   - Thread-safe Redis-compatible store supporting strings with TTL expiration, atomic counters (`incr`, `decr`), hashes (`hset`, `hget`), and lists (`lpush`, `rpop`).

---

## 5. Security & Isolation Guarantees

- **No Raw Pointer Exposure**: Kora programs cannot construct raw unmanaged pointers.
- **Forbid Unsafe**: Generated Rust code includes `#![forbid(unsafe_code)]` at the crate root.
- **Memory Safety Without GC Pauses**: Rust's affine ownership and borrow checker guarantee memory safety at compile time with zero garbage collection overhead.
