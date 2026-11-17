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
│   └── 10-testing-and-verification.md
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
    └── testing-standards.md
```

---

## 2. Mandatory Laws for All Agents

1. **Clean Architecture Enforcement**:
   - `model` for DTOs and database schemas.
   - `interface` for service/repository contracts.
   - `class` with `init(dependency: Interface)` for services.
   - `class Router` with `registerRoutes(app: App)` for endpoints.
   - Mount routers inside `Application.bootstrap()` using `app.use(MyRouter)`.
   - Never define models or enums inside classes.
2. **Deterministic Typing**:
   - Every file must pass `kora check` and `kora run` cleanly.
   - Zero raw `rustc` diagnostic leakage to developers.
3. **Mandatory Quality Gates**:
   - `cargo fmt --all -- --check`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`
