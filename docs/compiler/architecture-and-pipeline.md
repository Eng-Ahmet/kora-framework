# Kora Compiler Architecture & Compilation Pipeline

The Kora compiler is implemented entirely in pure Rust, designed for high compiler throughput, deterministic memory safety without a garbage collector, and native machine code output.

## Architecture Overview

```
Source (.kora / .kr)
       │
       ▼
 [ kora-lexer ] ──────► Token Stream (Span, TokenKind)
       │
       ▼
 [ kora-parser ] ─────► Abstract Syntax Tree (kora-ast::Module)
       │
       ▼
 [ kora-hir ] ────────► Scoped HIR & Symbol Resolution Tables
       │
       ▼
 [ kora-ty ] ─────────► Type Checking, Hindley-Milner Inference, Single-Null
       │
       ▼
 [ kora-ownership ] ──► Affine Ownership & Borrow Analysis
       │
       ▼
 [ kora-codegen ] ────► Memory-Safe Rust Source (.kora-build/src/main.rs)
       │
       ▼
 [ rustc / LLVM ] ────► Native Release Binary Artifact
```

## Compiler Crates

1. **`kora-lexer`**:
   - Tokenizes source code into high-fidelity tokens with UTF-8 byte span preservation (`kora-span`).
   - Rejects non-conforming tokens with `error[E1001]`.

2. **`kora-parser`**:
   - Recursive descent parser with predictive lookahead.
   - Enforces the Single-Null standard: parses `null` and `Option<T>`, explicitly bans `undefined` (`error[E2005]`).
   - Produces strongly-typed AST nodes (`kora-ast`).

3. **`kora-hir`**:
   - Resolves module imports, lexical scopes, and symbol tables.
   - Identifies undeclared symbols with `error[E3001]`.

4. **`kora-ty`**:
   - Performs Hindley-Milner type inference and static type checking.
   - Forbids invalid type coercions (e.g. arithmetic between `String` and `Int` emits `error[E4001]`).
   - Validates that mandatory struct/model fields are supplied (`error[E4004]`).

5. **`kora-ownership`**:
   - Verifies move semantics, variable mutability (`let` vs `var`), and memory lifetime bounds.

6. **`kora-codegen`**:
   - Emits clean, idiomatic, and highly optimized Rust code.
   - Target build directory is `.kora-build/` with automated dependency manifests.
