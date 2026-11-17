# Rule 11: VS Code Extension, Language Server & Developer Tooling

The official Kora VS Code Extension (`integrations/vscode/`) is a core component of the Kora language ecosystem, providing intelligent IDE capabilities, compile-time diagnostics, and an AI-driven architecture assistant.

## 1. Extension Architecture

```
integrations/vscode/
├── package.json                   # Extension manifest, activation events, settings, commands
├── language-configuration.json    # Auto-closing pairs, brackets, indentation rules
├── syntaxes/                      # TextMate grammar for .kora and .kr files
├── snippets/                      # Canonical snippets for Clean Architecture slices
├── icons/                         # Dedicated Kora file theme icons
├── client/
│   ├── extension.js               # Main extension entrypoint & provider registrations
│   └── kora-copilot-engine.js     # Embedded Copilot & RAG knowledge engine
└── knowledge/                     # Machine-readable language & compiler specifications
    ├── language/                  # Syntax, grammar, keywords, types, expressions, declarations
    ├── compiler/                  # Architecture, pipeline, diagnostics, semantic analysis
    ├── framework/                 # API index, components, patterns
    ├── cli/                       # Commands, generators
    ├── examples/                  # 23-example catalog metadata & testing patterns
    └── rules/                     # Coding standards, architecture rules, testing rules
```

## 2. Mandatory Language Providers

The extension MUST register and maintain native VS Code language providers:

1. **Context-Aware Autocompletion (`CompletionItemProvider`)**:
   - Must provide keyword completions (`model`, `class`, `interface`, `actor`, `fn`, `init`, `let`, `var`, `match`, etc.).
   - Must provide decorator completions (`@table`, `@collection`, `@primary`, `@required`, `@email`, etc.).
   - **Member Dot Completion**: Typing `.` after an identifier (e.g. `user.`) MUST inspect the AST/model definition and suggest actual fields and method signatures with parameter types.
   - Built-in object completions for `app.`, `db.`, `actor.`, and `channel.`.

2. **Rich Hover Documentation (`HoverProvider`)**:
   - Hovering over language keywords, decorators, types, or symbols MUST display rich Markdown documentation.
   - Must explain the Clean Architecture role (Presentation, Application, Data Access, Core Entity, Boundary DTO).
   - Must cite compiler rules (e.g. Rule 01 for `null`, Rule 04 for `init`, Rule 07 for `@table`).

3. **Go to Definition (`DefinitionProvider` - F12)**:
   - Must support jumping directly to symbol declarations (`model`, `class`, `interface`, `fn`, `let`, `var`).

4. **Document Outline & Breadcrumbs (`DocumentSymbolProvider`)**:
   - Must produce structured `vscode.DocumentSymbol` hierarchies for the Outline tree view and Breadcrumbs.

5. **Canonical Formatting (`DocumentFormattingEditProvider` - Shift+Alt+F)**:
   - Must apply standard 4-space indentation and clean block boundaries.

6. **Folding Ranges (`FoldingRangeProvider`)**:
   - Must support folding of multi-line blocks `{ ... }`.

7. **Code Actions & 1-Click Quick Fixes (💡)**:
   - Replace banned `undefined` with `null` (`E2005`).
   - Add missing `init(...)` dependency injection constructor (`E5001`).
   - Scaffold unit and load test suites for active file.
   - Audit active file against `.agent/rules/`.

## 3. Sidebar Webview: Kora Assistant (`kora.assistantView`)

The extension sidebar contains 5 specialized modules:
- **🔍 Inspector**: Displays active file classification (Runnable Entrypoint, Clean Architecture Service/Controller, Automated Test Suite), line count, symbols, and live compiler diagnostics from `kora check`.
- **🏛️ Architecture Explorer**: Scans workspace and visualizes Clean Architecture layers (Controllers, Services, Repositories, Entities, Models, Tests) with layer counters and data flow maps.
- **🎓 Learning Center**: Hands-on interactive tutorials (Models, DI with `init`, Actors with mailboxes, Load testing with teardown) with 1-click "Insert into Editor 📝" buttons.
- **🤖 Copilot AI Chat**: Context-aware chat assistant performing RAG retrieval from `.agent/rules/`, `docs/`, and `knowledge/`. Supports dual-mode: embedded offline engine or external LLM (Ollama, OpenAI, Gemini).
- **📦 Examples Catalog**: Visual browser for all 23 official production examples with 1-click scaffolding via `kora example init <slug>`.

## 4. Extension Packaging & Build Rules

1. Any modification to `integrations/vscode/` MUST pass syntax checks:
   ```bash
   node -c integrations/vscode/client/extension.js
   node -c integrations/vscode/client/kora-copilot-engine.js
   ```
2. The extension MUST package cleanly into `dist/kora-vscode-0.8.0.vsix` without unhandled errors:
   ```bash
   cd integrations/vscode
   npx @vscode/vsce package --no-git-tag-version 0.8.0 --allow-missing-repository
   cp kora-vscode-0.8.0.vsix ../../dist/
   rm -f kora-vscode-0.8.0.vsix
   ```
3. The `.vsix` binary MUST NOT be tracked in git (ignored via `dist/` in `.gitignore`).

