# Automatic & Safe Type Inference in Kora

This example demonstrates Kora's Hindley-Milner-inspired static type inference, algebraic data types (`enum`), data schemas (`model`), and exhaustive pattern matching.

## Key Capabilities

1. **Primitive Inference**: Variables declared with `let` infer their precise static type automatically:
   - String literals $\rightarrow$ `String`
   - Integer literals $\rightarrow$ `Int` (with explicit widths `Int8`..`Int64`, `UInt`..`UInt64`)
   - Float literals $\rightarrow$ `Float` (with explicit widths `Float32`, `Float64`, `Decimal`)
   - Boolean literals $\rightarrow$ `Bool`
   - Character literals `'c'` $\rightarrow$ `Char`
2. **Collection Inference**: Arrays, Vectors, and Maps infer homogenous element/key/value types statically (`[10, 20]` $\rightarrow$ `Array<Int>`).
3. **Data Models**: Declared with `model` for DTOs and database schemas with strong static typing.
4. **Algebraic Enums**: Support both simple unit variants and parameterized payload variants (`PaymentStatus.Failed(String)`).
5. **Pattern Matching**: Exhaustive pattern matching over enum variants using `match`, enforced at compile time.
6. **Functional Options & Results**: Native `Option<T>` (`Some`/`None`) and `Result<T, E>` (`Ok`/`Err`) with zero implicit nullability.

## Running the Verification

```bash
cargo run -p kora-cli -- check examples/19_type_inference_and_types/main.kora
```
