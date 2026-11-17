# Contributing to Kora

Thank you for your interest in contributing to the **Kora Programming Language & Framework**!  
Kora is an open-source, memory-safe backend programming language engineered for high performance, developer ergonomics, and strict architectural discipline.

---

## 1. Development Prerequisites

To contribute to the compiler, runtime, or standard library, ensure you have:
- **Rust Toolchain**: Stable 1.80+ (`rustup update stable`).
- **Cargo**: Bundled with Rust.
- **Git**: For source control.
- **Node.js 18+ & VSCE** (Optional): Only if contributing to the VS Code extension in `integrations/vscode`.

---

## 2. Repository Layout

```text
kora-framework/
├── crates/             # The 23 modular Rust crates forming the Kora compiler & runtime
├── examples/           # Executable real-world sample programs (01 through 20+)
├── integrations/       # IDE integrations (VS Code / Antigravity IDE extension)
├── documentation/      # Self-contained documentation website (HTML/CSS/JS)
├── docs/               # Markdown specification and grammar documents
├── .agent/             # AI Agent rules, engineering standards, and workflows
└── scripts/            # Setup and deployment helper scripts
```

---

## 3. Contribution Workflow

1. **Fork & Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Implement Feature or Fix**:
   - Write clean, well-tested Rust code.
   - Respect crate boundaries: never introduce circular dependencies in `Cargo.toml`.
   - Never let raw `rustc` errors leak to Kora developers; all diagnostics must originate from Kora's compiler pipeline.
3. **Run Mandatory Pre-Commit Checks**:
   ```bash
   # 1. Check code formatting
   cargo fmt --all -- --check

   # 2. Run Clippy linter with zero warnings tolerated
   cargo clippy --workspace --all-targets -- -D warnings

   # 3. Run entire test suite
   cargo test --workspace

   # 4. Check all executable Kora examples
   for f in examples/*/main.kora examples/09_enterprise_clean_architecture/src/main.kora examples/13_modular_monolith_ecommerce/src/main.kora; do
       kora check "$f"
   done
   ```
4. **Submit Pull Request**:
   - Write a clear, concise PR description.
   - Link related GitHub issues.
   - Ensure GitHub Actions CI passes completely.

---

## 4. Architectural Rules & Invariants

All contributions must strictly respect Kora's Clean Architecture invariants:

1. **Rule E5001 (Class Purity)**:
   Service and controller class files must only define classes. Do not declare inline `model`, `enum`, or `interface` items inside a class file.
2. **Rule E5002 (Model Purity)**:
   Domain entity and model files must strictly define models. Do not declare classes or enums inside model files.
3. **Rule E5003 (Interface Purity)**:
   Interface contract files must strictly define interfaces.
4. **Rule E5004 (Root Entry Purity)**:
   `main.kora` is strictly for dependency injection, route mounting via `app.use(RouterClass)`, and server startup (`app.listen(port)`).
5. **No Fake APIs**:
   Never document or introduce syntax that is not implemented across all compiler stages (Lexer -> Parser -> AST -> HIR -> TypeChecker -> Ownership -> Codegen).

---

## 5. Adding New Crates

Before adding a new crate to the workspace:
1. Ensure the functionality does not naturally belong in an existing crate (e.g. `kora-runtime` or `kora-orm`).
2. Add the crate to `Cargo.toml` under `[workspace.members]`.
3. Provide a dedicated `README.md` explaining:
   - Purpose and scope.
   - Public APIs.
   - Architecture and dependencies.
   - Usage examples and unit tests.

---

## 6. Contributor Recognition

Whenever your pull request is merged into `main`, our automated release pipeline recognizes your contribution in the official release notes and documentation. Thank you for making Kora faster, safer, and better for developers worldwide!
