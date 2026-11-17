# Kora AI Assistant & Knowledge Engine (RAG)

The Kora AI Assistant combines an embedded deterministic rule engine with optional local or cloud LLM integration.

## Knowledge Sources

The Copilot indexes multiple authoritative sources:
1. `integrations/vscode/knowledge/`: Machine-readable JSON specifications and Markdown documents covering language grammar, types, expressions, compiler pipeline, framework APIs, CLI commands, examples, and rules.
2. `.agent/rules/`: Rules 01–10 (Single-Null, Clean Architecture, Database ORM, Concurrency, Testing).
3. `docs/`: Comprehensive guides and architecture specifications.

## Dual-Mode Operation

### 1. Embedded Knowledge Engine (Default & Offline)
- Requires zero API keys and zero internet access.
- Evaluates code compliance, audits architecture, and cites relevant rule files.

### 2. External LLM Integration (Ollama, OpenAI, Gemini)
Configured via VS Code settings:
- `kora.copilot.provider`: `"embedded"` | `"ollama"` | `"openai"` | `"gemini"` | `"anthropic"` | `"custom"`
- `kora.copilot.endpoint`: e.g. `http://localhost:11434` for local Ollama
- `kora.copilot.model`: e.g. `llama3`, `codellama`, `gpt-4o`
- `kora.copilot.apiKey`: API key for cloud providers

