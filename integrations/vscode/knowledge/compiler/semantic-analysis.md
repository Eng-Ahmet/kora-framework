# Semantic Analysis in Kora

Semantic analysis in Kora operates over the HIR (High-Level Intermediate Representation) across three primary passes:

1. **Symbol Resolution**:
   - Builds lexical symbol tables for variables, functions, models, classes, and interfaces.
   - Resolves cross-file module imports.
   - Detects duplicate symbol definitions and unresolved identifiers (`E3001`).

2. **Type Inference and Checking (`kora-ty`)**:
   - Type inference using Hindley-Milner algorithms.
   - Ensures exhaustive pattern matching for enums and ADTs.
   - Validates that non-optional types cannot receive `null`.
   - Prevents dynamic coercion between incompatible types (e.g. `String + Int`).

3. **Clean Architecture & Boundary Rules (`E5001`-`E5004`)**:
   - Analyzes layer boundaries:
     - Presentation / Controllers (`src/controllers/`)
     - Application / Domain Services (`src/services/`)
     - Data Access / Repositories (`src/repositories/`)
     - Core Entities (`src/entities/`)
   - Emits compile-time diagnostics when inversion of control or encapsulation is broken.
