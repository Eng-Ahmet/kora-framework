# Rule 01: Language Philosophy & Grammar Invariants

## 1. Syntax Characteristics
- **Clean & Modern**: Optional semicolons, type inference (`let x = 10`), concise lambda expressions `(x: Int) => x * 2`.
- **Hybrid Data Modeling**:
  - `struct`: Value types with public/private properties.
  - `model`: Declarative database entities, DTOs, and API schemas.
  - `interface`: Structural and behavioral contracts enforcing dependency inversion.
  - `class`: Pure OOP service/controller components supporting constructors (`init`), method encapsulation, and compile-time DI.
  - `enum`: Tagged unions with pattern matching support.

## 2. Invariant Rules for File Structure
- **No In-Class Enums or Models**: Declaring `enum` or `model` definitions inside a `class` body is strictly forbidden. All domain models and enums must be declared at the top-level or imported from dedicated modules (`models/*.kora`, `enums/*.kora`).
- **Single Responsibility**: Each file should focus on one architectural responsibility (Routes, Services, Repositories, Models).
