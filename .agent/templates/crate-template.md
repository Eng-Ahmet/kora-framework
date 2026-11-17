# Template: New Crate Specification

```toml
# crates/kora-newcrate/Cargo.toml
[package]
name = "kora-newcrate"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
kora-span = { workspace = true }
kora-diagnostics = { workspace = true }
```

## Mandatory Elements:
1. `src/lib.rs` with top-level module documentation.
2. Unit tests covering edge cases and error handling.
3. Zero circular imports with other workspace crates.
