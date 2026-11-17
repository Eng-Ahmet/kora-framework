# Specialized Data Structures in Kora

This example demonstrates Kora's native algorithmic data structures designed for high-performance backend systems.

## Included Structures

1. **`PriorityQueue<T>`** (`BinaryHeap<T>`): Max/Min binary heap prioritizing critical backend events, scheduled jobs, and rate limiters.
2. **`Trie<T>`** (`RadixTree<T>`): Prefix tree enabling fast routing table matches, URL parameter dispatch, and autocomplete queries.
3. **`Graph<T>`** (`DirectedGraph<T>`): Adjacency-list graph model supporting topological dependency resolution, microservice dependency tracing, and BFS/DFS graph traversals.
4. **`DisjointSet<T>`**: Union-Find disjoint-set forest with union by rank and path compression ($O(\alpha(n))$ time complexity) for network partition and clustering.
5. **`BloomFilter<T>`**: Probabilistic bit set delivering $O(k)$ membership tests with zero false negatives to shield databases and caches.
6. **`LRUCache<K, V>`** / **`LFUCache<K, V>`**: Constant-time $O(1)$ Least-Recently-Used / Least-Frequently-Used caches with deterministic eviction policies.

## Running the Verification

```bash
cargo run -p kora-cli -- check examples/18_data_structures_specialized/main.kora
```
