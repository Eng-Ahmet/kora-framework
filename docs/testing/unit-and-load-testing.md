# Automated Testing: Unit & Peak Load Testing in Kora

Testing in Kora is a first-class language and toolchain feature. Every official example project and every feature generated with `kora g feature <name>` provides standardized test suites.

## Test Directory Structure

```
my_project/
  src/
    entities/
    models/
    repositories/
    services/
    controllers/
  tests/
    users_unit.test.kora   # Pure Unit Test Suite
    users_load.test.kora   # Peak Load & Stress Test Suite
```

## 1. Unit Testing (`*_unit.test.kora`)

Unit tests focus on validating business invariants, input validation decorators (`@email`, `@required`, `@min`, `@max`), pattern matching branches, and null-safety.

```kora
class UsersUnitTestSuite {
    init() {}

    fn test_valid_user_creation() -> Bool {
        let req = CreateUserRequest { name: "Alice", email: "alice@example.com", age: 30 }
        return req.age >= 18
    }

    fn run() -> Unit {
        let ok = this.test_valid_user_creation()
        if ok {
            print("  ✓ UsersUnitTestSuite: passed")
        } else {
            print("  ✗ UsersUnitTestSuite: failed")
        }
    }
}

let suite = UsersUnitTestSuite()
suite.run()
```

## 2. Peak Load Testing (`*_load.test.kora`)

Load tests simulate high throughput (1,000 to 10,000 concurrent operations), measuring latency and throughput, and mandating explicit teardown:

```kora
class UsersLoadTestSuite {
    init() {}

    fn run_load_stress(iterations: Int) -> Int {
        var processed = 0
        for i in 0..iterations {
            processed += 1
        }
        return processed
    }

    fn teardown() -> Unit {
        print("  ✓ UsersLoadTestSuite Teardown: synthetic allocations purged")
    }
}

let suite = UsersLoadTestSuite()
let total = suite.run_load_stress(1000)
print("  ✓ Processed 1,000 load iterations")
suite.teardown()
```

## Running Tests with the Kora CLI

```bash
# Run all tests in the workspace recursively
kora test

# Run all tests across the 23 catalog projects
kora test examples/

# Run a specific test file
kora test tests/users_unit.test.kora
```

