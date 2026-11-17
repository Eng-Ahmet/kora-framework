# Example 22: NoSQL Document Store (MongoDB-compatible) Clean Architecture

This example demonstrates how Kora natively interfaces with **Schema-Free Document Stores (MongoDB-compatible)** using Clean Architecture and compile-time dependency injection.

## Architectural Layers

```
examples/22_nosql_document_store/
├── main.kora                                  # Application entrypoint (app.use)
├── models/
│   └── document.models.kora                   # Audit Event & Filter Models
├── interfaces/
│   └── document.repository.interface.kora     # Document Store Contract
├── services/
│   └── mongo_document.service.kora            # MongoDB Repository Implementation
├── routes/
│   └── document.routes.kora                   # HTTP Endpoints (Router Class)
└── docker-compose.yml                         # MongoDB 7.0 + Mongo Express UI
```

## Features Demonstrated

1. **Schema-Free Document Storage**: Storing rich polymorphic audit trails (`coll.insertOne(event)`).
2. **Collection Abstraction**: Dynamic document collections via `db.collection("audit_events")`.
3. **Compound & Query Filters**: Fast document lookups (`coll.findOne(type)`).
4. **Bulk Deletion / Retention**: Pruning historical audit records (`coll.deleteMany(timestamp)`).
5. **Clean Architecture Compliance**: Zero global state, router encapsulation, interface segregation.

## Running the Example

```bash
# Start MongoDB & Mongo-Express
docker compose up -d

# Verify compilation
kora check examples/22_nosql_document_store/main.kora

# Run the server
kora run examples/22_nosql_document_store/main.kora
```
