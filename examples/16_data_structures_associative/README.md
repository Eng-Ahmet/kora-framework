# Associative Data Structures in Kora

This example demonstrates Kora's native key-value associative collections and map literal expressions.

## Included Structures

1. **`HashMap<K, V>`** (`Map<K, V>`): Amortized $O(1)$ hash map with SipHash/AHash collision resistance and Entry API.
2. **`BTreeMap<K, V>`**: Logarithmic $O(\log n)$ sorted balanced search tree, supporting range queries and ordered iteration.
3. **`OrderedMap<K, V>`**: Hash map preserving exact insertion order for predictable serialization and HTTP headers.
4. **`MultiMap<K, V>`**: One-to-many associative structure where each key maps to a vector of values.
5. **`BiMap<K, V>`**: Bidirectional bijection structure supporting $O(1)$ lookups by either key or value.

## Syntax & Usage

```kora
// Explicit constructor
let users = HashMap<String, User>()
users.insert("ahmet", User { id: 1, name: "Ahmet", email: "ahmet@kora.dev", role: "admin" })

// Safe retrieval
let user_opt = users.get("ahmet")
let exists = users.contains_key("ahmet")

// Map Literal with Automatic Type Inference: Map<String, Int>
let scores = {
    "team_alpha": 95,
    "team_beta": 88
}
```

## Running the Verification

```bash
cargo run -p kora-cli -- check examples/16_data_structures_associative/main.kora
```
