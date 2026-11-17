# Rule 00: Project Overview & Ecosystem Mission

## 1. Context & Scope
Kora is a compiled, statically typed systems & enterprise backend programming language and complete developer ecosystem. It bridges the developer ergonomics of high-level languages with the raw execution speed, deterministic memory safety, and concurrency of compiled Rust.

The Kora ecosystem encompasses:
1. **Core Compiler & Runtime (`crates/`)**: Multi-stage Rust compiler (lexer, parser, AST, HIR, type system, ownership engine, codegen) emitting optimized native binaries without a garbage collector.
2. **Kora CLI Toolchain (`kora-cli`)**: Scaffolding (`kora create`), feature generation (`kora g feature`), testing (`kora test`), environment diagnostics (`kora doctor`), and GitHub catalog management (`kora example`).
3. **VS Code & Modern IDE Integration (`integrations/vscode/`)**: Language Server Protocol (LSP), context-aware autocompletion, real-time compiler diagnostics, Clean Architecture auditor, and an embedded Kora Copilot Engine indexing documentation and `.agent/rules/`.
4. **Official 23 Reference Examples (`examples/`)**: Comprehensive catalog spanning microservices, WebSockets, actors, ORM, security, IoT, and enterprise reporting—all equipped with both unit tests and peak load tests.

## 2. Fundamental Laws for AI Agents
1. **Never Invent Imaginary Syntax or APIs**: Every code snippet, test, and documentation written by an agent must be fully valid according to the Kora compiler (`kora-parser`, `kora-ty`, `kora-codegen`).
2. **Deterministic Clean Architecture**: Adhere strictly to Clean Architecture (`E5001`-`E5004`). All route handlers must live in `Router` or `Controller` classes; all business logic must be isolated in `Service` classes; all data persistence must be abstracted behind `interfaces` passed via `init(...)`.
3. **Single-Null Standard & Zero-Guessing**: Kora strictly forbids `undefined` (`error[E2005]`). Never guess values or mask missing data with arbitrary default fallbacks.
4. **Comprehensive Test Suite**: Every generated feature or example must provide both unit tests (`*_unit.test.kora`) and load tests (`*_load.test.kora`) with guaranteed `teardown()`.
5. **No Raw Compiler Leakage**: Any misuse of types or models in `.kora` files must be caught during front-end type checking and reported with a standard diagnostic (`E0xxx`-`E5xxx`), never leaking rustc compilation errors to the developer.
6. **Zero Unsafe in User-Generated Code**: The Kora code generator emits 100% safe, verified Rust.
