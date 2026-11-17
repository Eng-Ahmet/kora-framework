# Kora Coding Standards & Rules

## Rule 01: Single-Null Standard (No `undefined`)
- Kora supports only `null` to denote the intentional absence of a value.
- The TypeScript `undefined` keyword is strictly banned by the compiler (`error[E2005]`).
- Optional types are expressed with `Type?`.

## Rule 02: Immutability by Default
- Bindings declared with `let` are immutable.
- Bindings declared with `var` are mutable and must be scoped as locally as possible.
- Pure DTOs are declared with `model` and are strictly immutable data structures.

## Rule 03: Zero-Guessing Data Handling
- Never mask missing values with arbitrary fallback defaults (`|| ''`, `|| 0`).
- Always validate existence explicitly or return typed `Result` or `Option`.
- Corrupt or missing required data must throw a domain error or return an error state.

