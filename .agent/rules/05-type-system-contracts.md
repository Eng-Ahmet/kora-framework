# Rule 05: Type System Contracts & Subtyping

## 1. Supported Primitive Types
`Int`, `Int8`, `Int16`, `Int32`, `Int64`, `UInt`, `UInt8`, `UInt16`, `UInt32`, `UInt64`, `Float`, `Float32`, `Float64`, `Decimal`, `Bool`, `Char`, `String`, `Unit`, `Never`.

## 2. Generic & Composite Types
- `Option<T>`: Represents nullable values (`Some(val)` or `null`).
- `Result<T, E>`: Represents fallible operations (`Ok(val)` or `Err(err)`).
- `Vector<T>`, `Array<T>`: Sequential dynamic collections.
- `HashMap<K, V>`, `BTreeMap<K, V>`: Associative key-value collections.
- `HashSet<T>`, `BTreeSet<T>`: Set collections.
- `Database`: Built-in multi-engine database container supporting SQL tables, NoSQL collections, and Redis caching.

## 3. Interface Conformance Rules
A class implementing an `interface` must fulfill every declared method signature exactly (parameter types, return types, and async specifier). Missing methods or parameter mismatches trigger `E4008`.
