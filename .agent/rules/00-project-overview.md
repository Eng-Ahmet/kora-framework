# Rule 00: Project Overview & Mission

## 1. Context & Scope
Kora is a compiled, statically typed systems & enterprise programming language designed for scalable, production-grade cloud services and native applications. It bridges the ergonomics of high-level web frameworks with the raw execution speed, deterministic memory safety, and concurrency of compiled Rust.

## 2. Fundamental Laws for AI Agents
1. **Never Invent Imaginary Syntax or APIs**: Every code snippet, test, and documentation written by an agent must be fully valid according to the Kora compiler (`kora-parser`, `kora-ty`, `kora-codegen`).
2. **Deterministic Architecture**: Adhere strictly to Clean Architecture (`E5001`-`E5004`). All route handlers must live in `Router` classes; all business logic must be isolated in `Service` classes; all data persistence must be abstracted behind `interfaces`.
3. **No Raw Compiler Leakage**: Any misuse of types or models in `.kora` files must be caught during front-end type checking and reported with a standard diagnostic (`E0xxx`-`E5xxx`), never leaking rustc compilation errors to the developer.
4. **Zero Unsafe in User-Generated Code**: The Kora code generator emits 100% safe, verified Rust.
