# Set Data Structures in Kora

This example demonstrates Kora's native mathematical set collections and set algebra operations.

## Included Structures

1. **`Set<T>`** (`HashSet<T>`): Amortized $O(1)$ membership checking, deduplication, and insertion.
2. **`BTreeSet<T>`**: Logarithmic $O(\log n)$ ordered set maintaining strict element sorting.
3. **`OrderedSet<T>`**: Set maintaining exact insertion order while preserving uniqueness.
4. **`BitSet`**: Compact bit vector for dense integer sets, flags, and rapid bitwise set intersections.
5. **`MultiSet<T>`**: Bag/multiset data structure tracking element occurrences and frequencies.

## Supported Set Algebra

- **`union(other)`**: Combines elements from both sets ($A \cup B$).
- **`intersection(other)`**: Returns only elements present in both sets ($A \cap B$).
- **`difference(other)`**: Returns elements in $A$ not present in $B$ ($A \setminus B$).
- **`symmetric_difference(other)`**: Returns elements present in either set but not both ($A \triangle B$).
- **`is_subset(other)`**: Checks if all elements are contained in the target set ($A \subseteq B$).
- **`contains(value)`**: Fast membership check ($x \in A$).

## Running the Verification

```bash
cargo run -p kora-cli -- check examples/17_data_structures_sets/main.kora
```
