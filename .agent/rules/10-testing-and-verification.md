# Rule 10: Testing, Formatting & Verification Workflow

## 1. Mandatory Pre-Commit Suite
Before completing any task, an agent MUST execute and verify:
1. `cargo fmt --all -- --check`: Formatter check with zero diffs.
2. `cargo clippy --workspace --all-targets -- -D warnings`: Linter check with zero warnings.
3. `cargo test --workspace`: Comprehensive test suite across all 23 crates.
4. `kora check examples/...`: Ensure all modified or created `.kora` files compile cleanly.

## 2. Benchmark & Performance Regressions
Any change to `kora-runtime`, `kora-codegen`, or `kora-lexer` must run `cargo bench` or run microbenchmarks in `crates/kora-bench` to prove zero latency regression.
