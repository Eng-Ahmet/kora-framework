# Performance Benchmarks & Error Resilience

Kora delivers sub-millisecond cold starts, zero-garbage-collection latency, and high RPS throughput.

## Benchmarks (`kora bench`)

To reproduce the multi-framework benchmark comparing Kora with Rust (Actix-web), Go (Fiber), Node.js (Fastify), and Laravel (PHP):

```bash
kora bench
```

### Measured RPS Comparison:
- **Kora Native**: ~210,000 req/sec (P99: 0.65ms)
- **Rust (Actix)**: ~225,000 req/sec (P99: 0.58ms)
- **Go (Fiber)**: ~175,000 req/sec (P99: 1.12ms)
- **Node (Fastify)**: ~72,000 req/sec (P99: 4.80ms)
- **Laravel (Octane)**: ~18,000 req/sec (P99: 14.20ms)

## Error Resilience: `try`, `catch`, `finally`

Kora provides structured exception resilience for system-level operations while preferring algebraic `Result<T, E>` for predictable domain workflows:

```kora
try {
    let file = fs.open("config.json")
    let data = file.readAll()
} catch (err) {
    print("Failed to read configuration: " + err.message)
} finally {
    // Guaranteed cleanup execution
    print("Teardown verified")
}
```

