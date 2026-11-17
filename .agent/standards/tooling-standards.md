# Tooling & IDE Standards

This document establishes standards for developer tooling, the command-line interface (`kora-cli`), language server protocol (`kora-lsp`), and the VS Code extension (`integrations/vscode/`).

## 1. CLI Standards (`kora-cli`)

1. **Deterministic Exit Codes**:
   - Success: `ExitCode::SUCCESS` (0)
   - Failure: `ExitCode::FAILURE` (1)
2. **Helpful Terminal Diagnostics**:
   - Errors must print formatted snippets with file, line, and column coordinates (`--> file.kora:line:col`).
   - Every error must include an error code (`E1001`–`E5004`, `T1001`).
3. **Scaffolding Conventions**:
   - `kora new <name>` and `kora g feature <name>` must generate:
     - Clean Architecture layers: `entities/`, `models/`, `repositories/`, `services/`, `controllers/`
     - Test suites: `tests/<name>_unit.test.kora` and `tests/<name>_load.test.kora` with `teardown()`.
4. **Examples Management**:
   - Examples are downloaded and cached in `~/.kora/cache/examples/` (or `$KORA_CACHE_DIR/examples/`).
   - Support `list`, `info`, `init`, `search`, and `update`.

## 2. VS Code Extension Standards (`kora-vscode`)

1. **Zero External Dependencies**:
   - The extension client executes via native VS Code APIs and Node.js standard libraries (`child_process`, `fs`, `path`, `http`, `https`).
   - Keeps VSIX package lightweight (<150 KB) and free of runtime vulnerability vulnerabilities.
2. **Native Language Providers**:
   - `CompletionItemProvider`: Context-aware keyword, decorator, type, and dot-member autocompletions.
   - `HoverProvider`: Markdown documentation citing Clean Architecture roles and rule references.
   - `DefinitionProvider`: Symbol navigation (F12) across models, classes, and functions.
   - `DocumentSymbolProvider`: Complete Outline View and Breadcrumb hierarchy.
   - `DocumentFormattingEditProvider`: Canonical 4-space indentation.
   - `CodeActionProvider`: Quick fixes for `E2005` (replace `undefined` with `null`), `E5001` (add `init(...)`), scaffolding tests, and rules auditing.
3. **Kora Copilot Sidebar**:
   - **Inspector Tab**: Real-time file analysis and compiler diagnostics.
   - **Architecture Explorer**: Live layer counters and data flow visualizer.
   - **Learning Center**: Hands-on interactive lessons with 1-click editor insertion.
   - **Copilot Chat**: RAG-augmented AI chat with `.agent/rules/` and `docs/` indexed.
   - **Examples Browser**: 23 catalog examples with 1-click scaffolding.
