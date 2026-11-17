# Sequential Data Structures in Kora

This example demonstrates Kora's native sequential collections:

## Included Structures

1. **`Vector<T>`** (`Array<T>`): Dynamic contiguous array with automatic capacity resizing, bounds checking, and fast random access.
2. **`VecDeque<T>`**: Double-ended queue with amortized $O(1)$ push and pop at both ends (`push_front`, `push_back`, `pop_front`, `pop_back`).
3. **`LinkedList<T>`**: Doubly-linked list with $O(1)$ head and tail insertions and node manipulations.
4. **`Stack<T>`**: Strict LIFO (Last-In, First-Out) data structure with `push`, `pop`, and `peek`.
5. **`Queue<T>`**: Strict FIFO (First-In, First-Out) data structure with `enqueue`, `dequeue`, and `peek`.
6. **`CircularBuffer<T>`**: Fixed-capacity ring buffer with overwrite policy on saturation, ideal for telemetry, audio streams, and logs.
7. **`Matrix<T>` & `Tensor<T>`**: 2D and N-dimensional structured tensors for scientific computing, neural models, and linear algebra.

## Syntax & Usage

```kora
// Vector initialization with generic collection literal
let numbers = Vector<Int>[10, 20, 30, 40]
numbers.push(50)

// Stack LIFO
let stack = Stack<String>()
stack.push("Action 1")
let last = stack.pop()

// Queue FIFO
let queue = Queue<Int>()
queue.enqueue(101)
let job = queue.dequeue()

// Circular Buffer
let ring = CircularBuffer<Float>(16)
ring.push(1.0)
```

## Running the Verification

```bash
cargo run -p kora-cli -- check examples/15_data_structures_sequential/main.kora
```
