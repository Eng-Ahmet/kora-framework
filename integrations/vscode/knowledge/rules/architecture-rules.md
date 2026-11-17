# Kora Clean Architecture Rules

## Rule 04: Layer Inversion & Separation of Concerns
1. **Controllers (`src/controllers/`)**:
   - Sole responsibility: Translate transport protocols (HTTP, WebSocket, gRPC) to application commands.
   - Must NEVER access the database directly or import database connection handles (`error[E5001]`).
   - Must delegate all business workflows to domain Services via constructor injection (`init`).

2. **Services (`src/services/`)**:
   - Contain all business validation, status transitions, and domain logic.
   - Must NEVER instantiate concrete database repositories directly (`error[E5002]`).
   - Must depend exclusively on Repository interfaces passed via `init(...)`.

3. **Repositories (`src/repositories/`)**:
   - Provide concrete database implementations (SQL, NoSQL, in-memory) fulfilling domain interfaces.

4. **Entities (`src/entities/`) vs DTOs (`src/models/`)**:
   - `@table` database entities must strictly reside in `src/entities/`.
   - Database entities MUST NEVER leak directly into public API responses (`error[E5003]`).
   - Controllers must return pure DTO models declared with `model`.

