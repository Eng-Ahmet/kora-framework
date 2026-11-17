# Rule 03: Compiler Pipeline & Verification Workflow

## 1. The 8 Stages of Kora Compilation
1. **Source Discovery**: Resolves imports and dependencies.
2. **Lexical Analysis (`kora-lexer`)**: Generates token stream with spans.
3. **Syntactic Analysis (`kora-parser`)**: Builds the AST.
4. **Desugaring & Lowering (`kora-hir`)**: Flattens nested expressions into typed HIR items.
5. **Type Checking & Architecture Verification (`kora-ty`)**:
   - Resolves all symbol types.
   - Enforces Clean Architecture diagnostics `E5001`-`E5004`.
   - Validates interface implementations.
6. **Ownership & Borrow Analysis (`kora-ownership`)**: Ensures zero data races and memory leaks.
7. **Rust Code Generation (`kora-codegen`)**: Emits optimized Rust with memory-safe primitives and tokio runtime integration.
8. **Native Compilation & Execution (`rustc` / `cargo`)**: Emits native binary in `.kora-build`.

## 2. Agent Responsibilities
When diagnosing errors, agents must pinpoint the earliest stage where the failure occurred. Never mask a type system defect with a codegen workaround.
