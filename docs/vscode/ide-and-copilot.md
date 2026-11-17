# Kora VS Code Extension & IDE Intelligence Guide

The official Kora VS Code extension (`kora-vscode`) provides language tooling, autocompletion, real-time diagnostics, and an integrated AI Copilot.

## Core Capabilities

1. **Context-Aware Autocompletion**:
   - Suggests keywords, decorators (`@table`, `@required`), types, and snippets.
   - Dot-triggered member completion (`user.`): parses document models and suggests fields and methods.
2. **Hover Documentation**:
   - Rich Markdown previews of types, function signatures, clean architecture rules, and decorator behaviors.
3. **Go to Definition (F12)**:
   - Jumps directly to symbol declarations (`model`, `class`, `interface`, `fn`, `let`, `var`).
4. **Outline & Document Symbols**:
   - Renders classes, models, interfaces, and functions in the Breadcrumbs and Outline panel.
5. **Canonical Code Formatting (Shift+Alt+F)**:
   - Formats source code according to Kora style guidelines.
6. **Code Actions & 1-Click Quick Fixes (💡)**:
   - Replace `undefined` with `null` (`E2005`).
   - Add missing `init(...)` constructor (`E5001`).
   - Scaffold unit and load tests for active file.
   - Audit file against `.agent/rules/`.
7. **Kora Assistant Activity Bar Webview**:
   - **Inspector**: Real-time file analysis, entrypoint/test detection, compiler diagnostics.
   - **Architecture Explorer**: Workspace Clean Architecture layer visualizer.
   - **Learning Center**: Hands-on lessons with runnable code examples.
   - **Copilot Chat**: RAG-augmented AI chat answering questions with authoritative citations.
   - **Examples Catalog**: Browse all 23 production examples with 1-click cloning.

