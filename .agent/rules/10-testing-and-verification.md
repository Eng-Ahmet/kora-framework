# Rule 10: Testing, Formatting & Verification Workflow

## 1. Mandatory Pre-Commit Suite
Before completing any task, an agent MUST execute and verify:
1. `cargo fmt --all -- --check`: Formatter check with zero diffs.
2. `cargo clippy --workspace --all-targets -- -D warnings`: Linter check with zero warnings.
3. `cargo test --workspace`: Comprehensive test suite across all crates.
4. `kora test [path]`: Automated test runner verifying unit tests, load tests, and main lifecycle assertions.
5. `kora test examples/`: Comprehensive verification across all 23 catalog projects (all 92 tests must pass).
6. `kora doctor`: Toolchain, compiler, cache, and GitHub connectivity health check.

## 2. VS Code Extension Verification
When modifying files in `integrations/vscode/`:
1. Verify JavaScript syntax:
   ```bash
   node -c integrations/vscode/client/extension.js
   node -c integrations/vscode/client/kora-copilot-engine.js
   ```
2. Verify package creation:
   ```bash
   cd integrations/vscode && npx @vscode/vsce package --no-git-tag-version 0.8.0 --allow-missing-repository
   cp kora-vscode-0.8.0.vsix ../../dist/
   rm -f kora-vscode-0.8.0.vsix
   ```

## 3. Mandatory Load Test Teardown (E5004)
Every load test suite (`*_load.test.kora`) MUST implement explicit resource teardown:
- Purge synthetic test records from database or mock repositories.
- Close open channels or worker actors.
- Release allocated connection handles.
- Failure to implement teardown triggers `error[E5004]`.

## 4. Benchmark & Performance Regressions
Any change to `kora-runtime`, `kora-codegen`, or `kora-lexer` must run `cargo bench` or run microbenchmarks in `crates/kora-bench` to prove zero latency regression.
