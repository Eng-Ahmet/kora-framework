# Concurrency & Stream Processing in Kora

This example demonstrates asynchronous message passing channels, stream processing pipelines, and thread synchronization primitives in Kora.

## Key Capabilities

1. **Typed Asynchronous Channels**: `channel<T>(capacity)` creates a bounded, memory-safe channel for backpressure-resistant message dispatch between actors and asynchronous tasks.
2. **Task Streaming**: `send(val)` dispatches typed records into worker queues without blocking event loop threads.
3. **Structured Concurrency**: Prevents orphaned background tasks through lifetime-scoped supervisor task groups.
4. **Thread-Safe Synchronization**: Runtime primitives for concurrent backend applications:
   - `Mutex<T>` & `RwLock<T>`: Non-poisoning mutual exclusion locks.
   - `AtomicInt` & `AtomicBool`: Lock-free atomic synchronization.
   - `ConcurrentHashMap<K, V>` & `ConcurrentHashSet<T>`: High-throughput concurrent collections.
5. **Memory Pools & Arena Allocator**: Rapid batch allocations for short-lived HTTP request lifecycles.

## Running the Verification

```bash
cargo run -p kora-cli -- check examples/20_concurrency_and_streams/main.kora
```
