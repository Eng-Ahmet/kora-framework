# Rule 06: Data Structures & Collections

## 1. Sequential Collections
- `Vector<T>`: Dynamic resizable array. Methods: `push(item)`, `pop()`, `get(idx)`, `len()`, `isEmpty()`.
- `Deque<T>`: Double-ended queue for FIFO/LIFO streaming.
- `LinkedList<T>`: Doubly-linked list for fast insertions.

## 2. Associative & Set Collections
- `HashMap<K, V>`: Hash table with $O(1)$ lookup.
- `BTreeMap<K, V>`: Sorted associative tree with $O(\log n)$ range queries.
- `HashSet<T>`: Unordered unique element set.
- `BTreeSet<T>`: Ordered unique element set.

## 3. Specialized Data Structures
- `BinaryHeap<T>`: Priority queue with max-heap or min-heap ordering.
- `BloomFilter`: Probabilistic membership testing with near-zero false positive rate.
- `PrefixTrie`: High-speed autocomplete and prefix matching string dictionary.
- `LRUCache<K, V>`: Fixed-capacity cache with least-recently-used eviction.
