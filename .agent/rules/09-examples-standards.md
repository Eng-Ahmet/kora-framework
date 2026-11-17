# Rule 09: Example Architecture Standards

## 1. Directory Structure Requirements
Every example under `examples/` must follow one of the two standard layouts:

### Standard Service Layout
```
examples/XX_name/
├── main.kora               # Application entrypoint with Application class
├── models/                 # Domain models and DTOs
├── interfaces/             # Service & repository contracts
├── services/               # Concrete business logic implementations
├── routes/                 # HTTP routers mounted via app.use
├── README.md               # Explanation, architecture tree, commands
└── docker-compose.yml      # (Optional) Real database or cache container
```

## 2. Compilability Guarantee
- Every example MUST pass `kora check <entrypoint>` with 0 errors.
- Every example MUST pass `kora run <entrypoint>` successfully.
- No dummy pseudo-code or syntactically incomplete snippets are permitted.
