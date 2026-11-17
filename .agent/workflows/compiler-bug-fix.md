# Workflow: Compiler Bug Fix & Regression Guard

1. **Reproduce via Minimal Test**:
   - Write a minimal `.kora` reproducer or a unit test in the target crate (`crates/kora-*/tests`).
2. **Identify Stage**:
   - Check if bug is in Lexer (`kora-lexer`), Parser (`kora-parser`), HIR Lowering (`kora-hir`), Type Checking (`kora-ty`), Ownership (`kora-ownership`), or Codegen (`kora-codegen`).
3. **Fix with Diagnostic Code**:
   - Never panic or let raw `rustc` errors leak. Emit a user-friendly `Diagnostic::error("E...", ...)`.
4. **Run Verification**:
   - `cargo test -p <affected-crate>`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
