# Kora Compiler Architecture

The Kora compiler is implemented entirely in Rust with zero unsafe blocks in userland semantics, targeting native compilation and high-throughput execution.

## Core Compilation Stages

1. **Lexical Analysis (`kora-lexer`)**:
   Converts raw UTF-8 source into a strongly typed token stream with precise source span tracking (`kora-span`).
2. **Syntactic Parsing (`kora-parser`)**:
   Recursive descent parser emitting an Abstract Syntax Tree (`kora-ast`).
3. **High-Level Intermediate Representation (`kora-hir`)**:
   Desugars AST into explicit control flow, scopes, and symbol resolution tables.
4. **Type Checking & Inference (`kora-ty`)**:
   Hindley-Milner type inference engine validating algebraic types, generics, and null-safety.
5. **Ownership & Borrow Analysis (`kora-ownership`)**:
   Enforces compile-time single-ownership rules and lifetime bounds without a runtime garbage collector.
6. **Code Generation (`kora-codegen`)**:
   Translates verified HIR into optimized, memory-safe Rust native code, compiled via `rustc` with LLVM backends.
7. **Runtime Support (`kora-runtime`)**:
   Async reactor loop (Tokio), actor mailboxes, WebSocket hubs, and database connection pooling.

