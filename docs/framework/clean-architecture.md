# Clean Architecture & Domain Invariants in Kora

Kora was engineered from inception to enforce Clean Architecture invariants directly at compile time.

## The 3-Layer Strict Boundary

```
[ Presentation Layer: Controllers / WebSockets ]
                      │
                      ▼ (Calls via Injected Interface)
[ Application Layer: Domain Services & Use Cases ]
                      │
                      ▼ (Fulfills Contract Interface)
[ Infrastructure & Data Access: Repositories & SQL Pools ]
                      │
                      ▼ (Maps to Core Domain)
[ Core Domain: Entities (@table) & Models (Pure DTOs) ]
```

## Architectural Invariants & Compiler Error Codes

### 1. E5001: Direct Infrastructure Instantiation Banned
Controllers and Domain Services must never directly instantiate raw database pools, HTTP clients, or file handles:
```kora
// ❌ COMPILE ERROR [E5001]: Direct infrastructure instantiation in service
class OrderService {
    fn createOrder() -> Unit {
        let db = Database() // ERROR: Banned
    }
}

// ✅ CORRECT: Dependency Injection via init(...)
class OrderService {
    repo: OrderRepository

    init(repo: OrderRepository) {
        this.repo = repo
    }
}
```

### 2. E5002: Dependency Inversion Violation
High-level application services must depend on abstract `interface` contracts rather than concrete driver implementations.

### 3. E5003: Entity Leaking into API Transport Layer
Relational database entities (`@table`) and NoSQL document models (`@collection`) must reside exclusively in `src/entities/`. They must NEVER be returned directly across HTTP/WebSocket boundaries without being mapped into pure DTO models (`src/models/`).

### 4. E5004: Missing Load Test Teardown
Load tests (`tests/*_load.test.kora`) must implement an explicit `teardown()` method to ensure zero resource leakage in test pipelines.

