# Kora Testing Standards

## Rule 10: Mandatory Unit & Load Testing with Teardown
1. **Unit Tests (`tests/<domain>_unit.test.kora`)**:
   - Must cover business logic, boundary validation, status changes, and null-safety.
   - Must use mock or in-memory repositories to ensure total isolation and repeatability.

2. **Load & Stress Tests (`tests/<domain>_load.test.kora`)**:
   - Must simulate high throughput (1,000 to 10,000 operations).
   - Must track and report execution duration, throughput (req/sec), and latency.
   - **MANDATORY TEARDOWN**: Load tests must explicitly release connections, actors, and resources upon completion (`error[E5004]`).
