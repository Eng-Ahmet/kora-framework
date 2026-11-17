# Compiler Diagnostics & Troubleshooting Guide

| Code | Severity | Description | Recommended Fix |
|------|----------|-------------|-----------------|
| `E1001` | Error | Unrecognized token or invalid character | Remove non-standard unicode characters or syntax typos. |
| `E2001` | Error | Syntax error / unexpected token | Check for mismatched braces, brackets, or semicolons. |
| `E2005` | Error | Use of banned `undefined` keyword | Replace `undefined` with `null` or `Option<T>` (Rule 01). |
| `E3001` | Error | Undefined identifier in scope | Declare binding with `let` or import module from `src/`. |
| `E4001` | Error | Type mismatch | Ensure types match or use explicit parsing/formatting. |
| `E4004` | Error | Missing required field in model instantiation | Supply all declared non-optional fields in the struct literal. |
| `E4008` | Error | Class missing interface method implementation | Implement all abstract methods declared in the interface. |
| `E5001` | Error | Controller/Service directly instantiating raw infrastructure | Inject repository or database interface via `init(...)` constructor. |
| `E5002` | Error | Service directly depending on concrete database driver | Depend on interface abstraction rather than concrete class. |
| `E5003` | Error | Domain entity leaking into API transport layer | Map `@table` entity to pure DTO model before returning to client. |
| `E5004` | Error | Missing load test teardown | Implement explicit `teardown()` method in load test suite. |
