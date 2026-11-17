# Rule 09: Example Architecture Standards & Official Catalog

## 1. Directory Structure Requirements
Every project under `examples/` must follow the Clean Architecture layout and provide both unit tests and peak load tests:

```
examples/XX_name/
├── main.kora               # Application entrypoint with Application bootstrap or main()
├── src/                    # (For multi-file projects: entities, models, services, controllers)
│   ├── entities/           # @table persistent database entities
│   ├── models/             # Pure immutable DTO models
│   ├── repositories/       # Data persistence interfaces & implementations
│   ├── services/           # Domain business logic with DI (init)
│   └── controllers/        # Presentation HTTP/WebSocket handlers
├── tests/                  # Automated test suites
│   ├── <name>_unit.test.kora   # Pure Unit Test Suite
│   └── <name>_load.test.kora   # Peak Load & Stress Test Suite (with mandatory teardown)
├── README.md               # Explanation, architecture tree, and execution commands
└── docker-compose.yml      # (Optional) Real database or cache container
```

## 2. Compilability & Test Execution Guarantee
- Every example MUST pass `kora check <entrypoint>` with 0 errors.
- Every example MUST pass `kora run <entrypoint>` successfully.
- Every example MUST pass `kora test tests/<name>_unit.test.kora` and `kora test tests/<name>_load.test.kora`.
- All 23 catalog examples MUST pass recursive batch verification:
  ```bash
  kora test examples/   # 92/92 tests must pass (0 failures)
  ```
- No dummy pseudo-code or syntactically incomplete snippets are permitted.

## 3. Official Catalog & CLI Management
The 23 official examples are registered in the CLI metadata catalog and can be downloaded, cached, and searched:

```bash
kora example list                  # View all 23 official examples
kora example info <slug>           # Inspect documentation and summary
kora example search <query>        # Search across categories and descriptions
kora example init <slug> [dest]    # Scaffold into a new project (cached in ~/.kora/cache/examples/)
kora example update                # Synchronize local cache from GitHub
```
*(Aliases: `kora ex`, `kora examples`)*
