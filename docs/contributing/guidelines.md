# Contributing Guidelines

Thank you for contributing to the Kora ecosystem!

## Core Engineering Principles

1. **Repository-First Development**:
   - Inspect actual code in `crates/`, `integrations/`, and `examples/` before introducing changes.
   - Ground all features in the actual compiler AST and semantics.
2. **Zero-Guessing Principle**:
   - Never introduce fallback dummy defaults masking missing data.
   - Throw explicit errors or use typed `Result` / `Option`.
3. **Clean Architecture Standards**:
   - Preserve layer boundaries: Controllers -> Services -> Repositories -> Entities -> DTOs.
4. **Testing Requirements**:
   - All new features and examples must include both unit tests and load tests with explicit `teardown()`.

## Verification Commands

Before opening a pull request:
```bash
cargo fmt --all -- --check
cargo check --workspace
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
kora test examples/
```

