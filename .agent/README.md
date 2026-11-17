# Kora AI Agent Governance & Engineering System

This directory contains the operational guidelines, rules, specialized subagent roles, workflows, and templates that govern all autonomous AI coding agents operating within the **Kora Framework** repository.

---

## 1. Directory Structure

```
.agent/
├── README.md               # This document (governance overview & rules index)
├── config.yaml             # Agent configuration & workspace mappings
├── agents/                 # Specialized agent role definitions
│   ├── compiler-architect.md
│   ├── language-engineer.md
│   ├── runtime-engineer.md
│   ├── orm-engineer.md
│   ├── security-auditor.md
│   ├── performance-engineer.md
│   └── documentation-engineer.md
├── rules/                  # Mandatory engineering & architectural laws
│   ├── 00-project-overview.md
│   ├── 01-language-philosophy.md
│   ├── 02-architecture-invariants.md
│   ├── 03-compiler-pipeline.md
│   ├── 04-clean-architecture.md
│   ├── 05-type-system-contracts.md
│   ├── 06-data-structures-and-collections.md
│   ├── 07-database-multi-engine-orm.md
│   ├── 08-concurrency-actors-streams.md
│   ├── 09-examples-standards.md
│   ├── 10-testing-and-verification.md
│   └── 11-vscode-extension-and-tooling.md
├── workflows/              # Standard operating procedures
│   ├── add-language-feature.md
│   ├── compiler-bug-fix.md
│   ├── documentation-sync.md
│   └── example-creation.md
├── templates/              # Standard templates for crates, examples, and ADRs
│   ├── crate-template.md
│   ├── example-template.md
│   └── adr-template.md
└── standards/              # Core coding, security & performance standards
    ├── architecture-standards.md
    ├── coding-standards.md
    ├── performance-standards.md
    ├── security-standards.md
    ├── testing-standards.md
    └── tooling-standards.md
```

---

## 2. Mandatory Laws for All Agents

1. **Clean Architecture Enforcement**:
   - `model` for pure immutable DTOs and boundary schemas.
   - `@table` entities strictly in `src/entities/`, never leaking into API transport boundaries.
   - `interface` for service/repository contracts.
   - `class` with `init(dependency: Interface)` for services (compile-time DI).
   - `class Router` with `registerRoutes(app: App)` for endpoints.
   - Mount routers inside `Application.bootstrap()` using `app.use(MyRouter)`.
   - Never define models or enums inside classes.
2. **Single-Null Standard & Zero-Guessing**:
   - Kora strictly forbids `undefined` (`error[E2005]`). Only `null` and `Option<T>` are supported.
   - Never invent dummy fallbacks masking missing or corrupt data.
3. **Comprehensive Test Suite & Mandatory Teardown**:
   - All generated features and examples must include both unit tests and peak load tests.
   - Every load test (`*_load.test.kora`) must implement explicit `teardown()` (`error[E5004]`).
4. **IDE & Extension Tooling Alignment**:
   - Maintain native VS Code providers (`CompletionItemProvider`, `HoverProvider`, `DefinitionProvider`, `DocumentSymbolProvider`, `DocumentFormattingEditProvider`, `FoldingRangeProvider`).
   - Keep the Kora Copilot Engine synchronized with `.agent/rules/`, `docs/`, and `knowledge/`.
5. **Deterministic Typing**:
   - Every file must pass `kora check` and `kora run` cleanly.
   - Zero raw `rustc` diagnostic leakage to developers.
6. **Mandatory Quality Gates**:
   - `cargo fmt --all -- --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
   - `kora test examples/` (all 92 tests passing)
