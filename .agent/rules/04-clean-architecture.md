# Rule 04: Clean Architecture Invariants & Diagnostics (E5001 - E5004)

## 1. Clean Architecture Violations Detected at Compile Time
The Kora compiler natively validates architectural integrity:

- **`E5001`: Direct Infrastructure Instantiation**:
  Controllers and Services must never instantiate database connections or raw infrastructure directly inside handler methods. Dependencies must be injected via `init(...)`.
- **`E5002`: Missing Interface Abstraction**:
  High-level services must depend on `interface` abstractions, never on direct concrete database drivers or low-level network clients.
- **`E5003`: Leaking Domain Entity via Controller**:
  Domain entities must not be returned directly across API boundaries without being wrapped in DTOs or validated models.
- **`E5004`: Circular Architectural Layer Dependency**:
  Domain layer must not depend on Application layer; Application layer must not depend on Infrastructure.

## 2. HTTP Routing Pattern
- Always encapsulate route registration inside a `Router` class.
- Mount routers inside `Application.bootstrap()` using `app.use(MyRouter)`.
- Never define standalone loose route handlers in global script scope.

## 3. Directory Segregation: Entities vs Models (DTOs)
- **Database Table Entities**: All persisted relational database models (`@table("...")`) and NoSQL document models (`@collection("...")`) must be stored in `entities/` (e.g. `entities/*.entity.kora`).
- **Data Transfer Objects (DTOs)**: All API request/response payloads, validation schemas, and transport models must be stored in `models/` or `dto/` (e.g. `models/*.models.kora` or `models/*.dto.kora`) and must never carry `@table` or `@collection` decorators.
- Mixing database table definitions inside `models/` alongside transport DTOs is strictly prohibited.
