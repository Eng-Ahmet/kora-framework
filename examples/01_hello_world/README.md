# Example 01: Hello World & Language Fundamentals

## Overview
This example demonstrates the core syntax, Clean Architecture principles, and class structures of Kora:
- **Declarative Data Models**: Pure data schemas defined via `model` in dedicated `models/` files.
- **Algebraic Data Types (`enum`)**: Enums with unit, tuple, or structured variants in dedicated `enums/` files.
- **Service Classes (`class`)**: Encapsulated business logic and pattern matching residing strictly in dedicated `services/` classes.
- **Clean Architecture & Separation of Concerns**: Strict architectural segregation between models, enums, service classes, and the entrypoint.
- **Strict Architectural Validation**: No mixing of models or enums within service classes or main files.

## Directory Structure
```
01_hello_world/
├── README.md
├── main.kora                                  # Clean entrypoint orchestrating services
├── enums/
│   └── order_status.enum.kora                 # Dedicated algebraic enum definition
├── models/
│   └── coordinates.model.kora                 # Dedicated declarative data model
└── services/
    └── order_processor.service.kora           # Dedicated OrderProcessor class
```

## Running the Example
```bash
# Type check the source files
kora check main.kora

# Execute the entrypoint
kora run main.kora
```

## Expected Output
```
Ahmet
Order payment confirmed
```
