# Rule 08: Concurrency, Actors & Stream Processing

## 1. Actor Model & Message Passing
- Actors run as isolated lightweight tasks communicating solely through typed message mailboxes.
- Supported operations:
  - `tell(msg)`: Asynchronous non-blocking message dispatch (fire-and-forget).
  - `ask(msg, timeout)`: Request-response pattern with deterministic timeout cancellation.

## 2. Channels & Task Groups
- **MPSC Channels**: Multi-producer, single-consumer bounded channels preventing memory exhaustion.
- **Broadcast Channels**: 1-to-N event pub/sub.
- **Structured Task Groups**: Spawns concurrent tasks with structured nursery cancellation; if one task fails, remaining siblings are cleanly aborted.

## 3. Stream Processing
- Pipelines: `filter`, `map`, `take`, `fold`.
- Low-latency batching for telemetry and high-throughput events.
