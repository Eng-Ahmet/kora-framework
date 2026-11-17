# Workflow: Example Creation & Validation

1. **Scaffold Directory**:
   - Create `examples/XX_feature_name/` with `models/`, `interfaces/`, `services/`, `routes/`, `main.kora`.
2. **Apply Clean Architecture Invariants**:
   - `model` for DTOs and database schemas.
   - `interface` for service/repository contracts.
   - `class` with `init(dependency: Interface)` for services.
   - `class Router` with `registerRoutes(app: App)` for endpoints.
   - `class Application` with `bootstrap() -> Unit { let app = run(); app.use(Router); app.listen(port); }`.
3. **Verify with CLI**:
   - `./target/release/kora check examples/XX_feature_name/main.kora`
   - `./target/release/kora run examples/XX_feature_name/main.kora`
4. **Document**:
   - Add `README.md` and `docker-compose.yml` (if database or external cache is involved).
