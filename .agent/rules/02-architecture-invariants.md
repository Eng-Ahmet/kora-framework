# Rule 02: Architecture & Crate Dependency Invariants

## 1. Single Source of Truth
All compiler and framework crates reside in `crates/kora-*`. Never introduce duplicate crates or parallel source trees.

## 2. Unidirectional Dependency Flow
The crate hierarchy is strictly directed and acyclic:
1. `kora-span`: Base source location and spans (zero workspace dependencies).
2. `kora-diagnostics`: Standardized error reporting (`kora-span`).
3. `kora-ast`: Abstract Syntax Tree definitions (`kora-span`).
4. `kora-lexer`: Token streaming and lexical analysis.
5. `kora-parser`: AST construction from tokens.
6. `kora-hir`: High-level intermediate representation and symbol resolution.
7. `kora-ty`: Hindley-Milner type checking, Clean Architecture rules (`E5001`-`E5004`), and interface validation.
8. `kora-ownership`: Affine ownership, borrow checking, and lifecycle analysis.
9. `kora-codegen`: Emits production-grade Rust code.
10. `kora-runtime`: Concurrency, actor mailboxes, task groups, channels, and event loops.
11. `kora-orm`: Dialect-agnostic SQL, NoSQL collections, and Redis caching.
12. `kora-cli`: Developer tooling, CLI runner, build driver, and compiler driver.
