# Compilation Pipeline

```
Source (.kora / .kr)
       │
       ▼
 [ kora-lexer ] ──► Token Stream (Span, TokenKind)
       │
       ▼
 [ kora-parser ] ──► Abstract Syntax Tree (AST Module)
       │
       ▼
 [ kora-hir ] ──► Scoped HIR & Symbol Tables
       │
       ▼
 [ kora-ty ] ──► Type Checking & Single-Null Verification
       │
       ▼
 [ kora-ownership ] ──► Borrow & Lifetime Verification
       │
       ▼
 [ kora-codegen ] ──► Native Rust Code (.kora-build/src/main.rs)
       │
       ▼
 [ rustc / LLVM ] ──► Native Executable Binary
```

Commands:
- `kora check <file>`: Lex -> Parse -> HIR -> Type -> Ownership (stops before codegen for instant feedback)
- `kora run <file>`: Full pipeline to native execution
- `kora build <file>`: Compiles native release artifact into `.kora-build/`
- `kora lsp`: Starts JSON-RPC 2.0 Language Server on stdio

