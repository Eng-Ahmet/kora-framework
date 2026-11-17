//! Sequential Data Structures for the Kora Runtime.
//!
//! Provides memory-safe, bounds-checked, high-performance sequential collections:
//! - `Vector<T>` and `Array<T>`
//! - `VecDeque<T>`
//! - `LinkedList<T>`
//! - `Stack<T>`
//! - `Queue<T>`
//! - `CircularBuffer<T>`
//! - `FixedArray<T, N>`
//! - `Matrix<T>`
//! - `Tensor<T>`

use std::collections::VecDeque as StdVecDeque;
use std::fmt;
use std::ops::{Index, IndexMut};

/// Dynamically sized growable array with safe bounds-checked indexing.
#[derive(Clone, PartialEq, Eq, Default)]
pub struct Vector<T> {
    inner: Vec<T>,
}

impl<T> Vector<T> {
    pub fn new() -> Self {
        Self { inner: Vec::new() }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: Vec::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, value: T) {
        self.inner.push(value);
    }

    pub fn pop(&mut self) -> Option<T> {
        self.inner.pop()
    }

    pub fn get(&self, index: usize) -> Option<&T> {
        self.inner.get(index)
    }

    pub fn get_mut(&mut self, index: usize) -> Option<&mut T> {
        self.inner.get_mut(index)
    }

    pub fn set(&mut self, index: usize, value: T) -> Result<(), &'static str> {
        if index < self.inner.len() {
            self.inner[index] = value;
            Ok(())
        } else {
            Err("index out of bounds")
        }
    }

    pub fn insert(&mut self, index: usize, value: T) -> Result<(), &'static str> {
        if index <= self.inner.len() {
            self.inner.insert(index, value);
            Ok(())
        } else {
            Err("insert index out of bounds")
        }
    }

    pub fn remove(&mut self, index: usize) -> Option<T> {
        if index < self.inner.len() {
            Some(self.inner.remove(index))
        } else {
            None
        }
    }

    pub fn length(&self) -> usize {
        self.inner.len()
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    pub fn capacity(&self) -> usize {
        self.inner.capacity()
    }

    pub fn reserve(&mut self, additional: usize) {
        self.inner.reserve(additional);
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn first(&self) -> Option<&T> {
        self.inner.first()
    }

    pub fn last(&self) -> Option<&T> {
        self.inner.last()
    }

    pub fn reverse(&mut self) {
        self.inner.reverse();
    }

    pub fn as_slice(&self) -> &[T] {
        &self.inner
    }

    pub fn as_mut_slice(&mut self) -> &mut [T] {
        &mut self.inner
    }

    pub fn filter<F>(&self, predicate: F) -> Self
    where
        T: Clone,
        F: Fn(&T) -> bool,
    {
        Self {
            inner: self
                .inner
                .iter()
                .filter(|x| predicate(x))
                .cloned()
                .collect(),
        }
    }

    pub fn map<U, F>(&self, transform: F) -> Vector<U>
    where
        F: Fn(&T) -> U,
    {
        Vector {
            inner: self.inner.iter().map(transform).collect(),
        }
    }

    pub fn reduce<U, F>(&self, initial: U, mut accumulator: F) -> U
    where
        F: FnMut(U, &T) -> U,
    {
        let mut acc = initial;
        for item in &self.inner {
            acc = accumulator(acc, item);
        }
        acc
    }
}

impl<T: Ord> Vector<T> {
    pub fn sort(&mut self) {
        self.inner.sort();
    }
}

impl<T: PartialEq> Vector<T> {
    pub fn contains(&self, item: &T) -> bool {
        self.inner.contains(item)
    }
}

impl<T: fmt::Debug> fmt::Debug for Vector<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Vector{:?}", self.inner)
    }
}

impl<T> From<Vec<T>> for Vector<T> {
    fn from(v: Vec<T>) -> Self {
        Self { inner: v }
    }
}

impl<T> From<Vector<T>> for Vec<T> {
    fn from(v: Vector<T>) -> Self {
        v.inner
    }
}

impl<T> Index<usize> for Vector<T> {
    type Output = T;
    fn index(&self, index: usize) -> &Self::Output {
        &self.inner[index]
    }
}

impl<T> IndexMut<usize> for Vector<T> {
    fn index_mut(&mut self, index: usize) -> &mut Self::Output {
        &mut self.inner[index]
    }
}

/// Type alias for Array<T>, mapping to Vector<T>.
pub type Array<T> = Vector<T>;

/// Double-ended queue wrapper with constant-time front and back insertions.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct VecDeque<T> {
    inner: StdVecDeque<T>,
}

impl<T> VecDeque<T> {
    pub fn new() -> Self {
        Self {
            inner: StdVecDeque::new(),
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: StdVecDeque::with_capacity(capacity),
        }
    }

    pub fn push_back(&mut self, val: T) {
        self.inner.push_back(val);
    }

    pub fn push_front(&mut self, val: T) {
        self.inner.push_front(val);
    }

    pub fn pop_back(&mut self) -> Option<T> {
        self.inner.pop_back();
        None
    }

    pub fn pop_front(&mut self) -> Option<T> {
        self.inner.pop_front()
    }

    pub fn front(&self) -> Option<&T> {
        self.inner.front()
    }

    pub fn back(&self) -> Option<&T> {
        self.inner.back()
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }
}

/// Doubly-linked list.
#[derive(Debug, Clone, Default)]
pub struct LinkedList<T> {
    inner: std::collections::LinkedList<T>,
}

impl<T> LinkedList<T> {
    pub fn new() -> Self {
        Self {
            inner: std::collections::LinkedList::new(),
        }
    }

    pub fn push_front(&mut self, val: T) {
        self.inner.push_front(val);
    }

    pub fn push_back(&mut self, val: T) {
        self.inner.push_back(val);
    }

    pub fn pop_front(&mut self) -> Option<T> {
        self.inner.pop_front()
    }

    pub fn pop_back(&mut self) -> Option<T> {
        self.inner.pop_back()
    }

    pub fn front(&self) -> Option<&T> {
        self.inner.front()
    }

    pub fn back(&self) -> Option<&T> {
        self.inner.back()
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }
}

/// LIFO Stack data structure.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Stack<T> {
    elements: Vec<T>,
}

impl<T> Stack<T> {
    pub fn new() -> Self {
        Self {
            elements: Vec::new(),
        }
    }

    pub fn push(&mut self, item: T) {
        self.elements.push(item);
    }

    pub fn pop(&mut self) -> Option<T> {
        self.elements.pop()
    }

    pub fn peek(&self) -> Option<&T> {
        self.elements.last()
    }

    pub fn peek_mut(&mut self) -> Option<&mut T> {
        self.elements.last_mut()
    }

    pub fn length(&self) -> usize {
        self.elements.len()
    }

    pub fn len(&self) -> usize {
        self.elements.len()
    }

    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }

    pub fn clear(&mut self) {
        self.elements.clear();
    }
}

/// FIFO Queue data structure.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Queue<T> {
    elements: StdVecDeque<T>,
}

impl<T> Queue<T> {
    pub fn new() -> Self {
        Self {
            elements: StdVecDeque::new(),
        }
    }

    pub fn enqueue(&mut self, item: T) {
        self.elements.push_back(item);
    }

    pub fn push(&mut self, item: T) {
        self.enqueue(item);
    }

    pub fn dequeue(&mut self) -> Option<T> {
        self.elements.pop_front()
    }

    pub fn pop(&mut self) -> Option<T> {
        self.dequeue()
    }

    pub fn peek(&self) -> Option<&T> {
        self.elements.front()
    }

    pub fn length(&self) -> usize {
        self.elements.len()
    }

    pub fn len(&self) -> usize {
        self.elements.len()
    }

    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }

    pub fn clear(&mut self) {
        self.elements.clear();
    }
}

/// Circular Buffer / Ring Buffer with bounded capacity.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CircularBuffer<T> {
    buffer: Vec<Option<T>>,
    capacity: usize,
    head: usize,
    tail: usize,
    size: usize,
}

impl<T> CircularBuffer<T> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be positive");
        let mut buffer = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            buffer.push(None);
        }
        Self {
            buffer,
            capacity,
            head: 0,
            tail: 0,
            size: 0,
        }
    }

    pub fn push(&mut self, item: T) -> Option<T> {
        let overwritten = if self.is_full() {
            let old = self.buffer[self.tail].take();
            self.tail = (self.tail + 1) % self.capacity;
            old
        } else {
            self.size += 1;
            None
        };

        self.buffer[self.head] = Some(item);
        self.head = (self.head + 1) % self.capacity;
        overwritten
    }

    pub fn pop(&mut self) -> Option<T> {
        if self.is_empty() {
            return None;
        }

        let val = self.buffer[self.tail].take();
        self.tail = (self.tail + 1) % self.capacity;
        self.size -= 1;
        val
    }

    pub fn peek(&self) -> Option<&T> {
        if self.is_empty() {
            None
        } else {
            self.buffer[self.tail].as_ref()
        }
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn length(&self) -> usize {
        self.size
    }

    pub fn len(&self) -> usize {
        self.size
    }

    pub fn is_empty(&self) -> bool {
        self.size == 0
    }

    pub fn is_full(&self) -> bool {
        self.size == self.capacity
    }

    pub fn clear(&mut self) {
        for slot in &mut self.buffer {
            *slot = None;
        }
        self.head = 0;
        self.tail = 0;
        self.size = 0;
    }
}

/// Fixed-size array with compile-time or static bounds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FixedArray<T, const N: usize> {
    elements: [T; N],
}

impl<T, const N: usize> FixedArray<T, N> {
    pub fn new(elements: [T; N]) -> Self {
        Self { elements }
    }

    pub fn get(&self, index: usize) -> Option<&T> {
        if index < N {
            Some(&self.elements[index])
        } else {
            None
        }
    }

    pub fn get_mut(&mut self, index: usize) -> Option<&mut T> {
        if index < N {
            Some(&mut self.elements[index])
        } else {
            None
        }
    }

    pub const fn len(&self) -> usize {
        N
    }

    pub const fn is_empty(&self) -> bool {
        N == 0
    }

    pub fn as_slice(&self) -> &[T] {
        &self.elements
    }
}

/// 2-Dimensional Matrix abstraction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Matrix<T> {
    rows: usize,
    cols: usize,
    data: Vec<T>,
}

impl<T: Clone> Matrix<T> {
    pub fn new(rows: usize, cols: usize, default_value: T) -> Self {
        Self {
            rows,
            cols,
            data: vec![default_value; rows * cols],
        }
    }

    pub fn from_flat(rows: usize, cols: usize, data: Vec<T>) -> Result<Self, &'static str> {
        if data.len() == rows * cols {
            Ok(Self { rows, cols, data })
        } else {
            Err("data length must equal rows * cols")
        }
    }

    pub fn rows(&self) -> usize {
        self.rows
    }

    pub fn cols(&self) -> usize {
        self.cols
    }

    pub fn get(&self, row: usize, col: usize) -> Option<&T> {
        if row < self.rows && col < self.cols {
            Some(&self.data[row * self.cols + col])
        } else {
            None
        }
    }

    pub fn set(&mut self, row: usize, col: usize, val: T) -> Result<(), &'static str> {
        if row < self.rows && col < self.cols {
            self.data[row * self.cols + col] = val;
            Ok(())
        } else {
            Err("matrix coordinates out of bounds")
        }
    }

    pub fn transpose(&self) -> Matrix<T> {
        let mut result = Matrix::new(self.cols, self.rows, self.data[0].clone());
        for r in 0..self.rows {
            for c in 0..self.cols {
                result.set(c, r, self.get(r, c).unwrap().clone()).unwrap();
            }
        }
        result
    }
}

/// Multi-dimensional Tensor abstraction with arbitrary dimensions and strides.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tensor<T> {
    shape: Vec<usize>,
    strides: Vec<usize>,
    data: Vec<T>,
}

impl<T: Clone> Tensor<T> {
    pub fn new(shape: Vec<usize>, default_val: T) -> Self {
        let total_size: usize = shape.iter().product();
        let mut strides = vec![1; shape.len()];
        if !shape.is_empty() {
            for i in (0..shape.len() - 1).rev() {
                strides[i] = strides[i + 1] * shape[i + 1];
            }
        }
        Self {
            shape,
            strides,
            data: vec![default_val; total_size],
        }
    }

    pub fn shape(&self) -> &[usize] {
        &self.shape
    }

    pub fn rank(&self) -> usize {
        self.shape.len()
    }

    pub fn size(&self) -> usize {
        self.data.len()
    }

    fn linear_index(&self, indices: &[usize]) -> Option<usize> {
        if indices.len() != self.shape.len() {
            return None;
        }
        let mut idx = 0;
        for (i, &c) in indices.iter().enumerate() {
            if c >= self.shape[i] {
                return None;
            }
            idx += c * self.strides[i];
        }
        Some(idx)
    }

    pub fn get(&self, indices: &[usize]) -> Option<&T> {
        let idx = self.linear_index(indices)?;
        self.data.get(idx)
    }

    pub fn set(&mut self, indices: &[usize], val: T) -> Result<(), &'static str> {
        let idx = self
            .linear_index(indices)
            .ok_or("tensor indices out of bounds")?;
        self.data[idx] = val;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_operations() {
        let mut v = Vector::new();
        v.push(10);
        v.push(20);
        v.push(30);
        assert_eq!(v.length(), 3);
        assert_eq!(v.get(1), Some(&20));
        assert_eq!(v.pop(), Some(30));
        assert_eq!(v.remove(0), Some(10));
        assert_eq!(v.length(), 1);
        assert_eq!(v.first(), Some(&20));
    }

    #[test]
    fn test_stack_operations() {
        let mut s = Stack::new();
        s.push(1);
        s.push(2);
        assert_eq!(s.peek(), Some(&2));
        assert_eq!(s.pop(), Some(2));
        assert_eq!(s.pop(), Some(1));
        assert!(s.is_empty());
    }

    #[test]
    fn test_queue_operations() {
        let mut q = Queue::new();
        q.enqueue("first");
        q.enqueue("second");
        assert_eq!(q.peek(), Some(&"first"));
        assert_eq!(q.dequeue(), Some("first"));
        assert_eq!(q.dequeue(), Some("second"));
        assert!(q.is_empty());
    }

    #[test]
    fn test_circular_buffer() {
        let mut cb = CircularBuffer::new(3);
        assert_eq!(cb.push(1), None);
        assert_eq!(cb.push(2), None);
        assert_eq!(cb.push(3), None);
        assert!(cb.is_full());
        // Overwrite oldest item (1)
        assert_eq!(cb.push(4), Some(1));
        assert_eq!(cb.pop(), Some(2));
        assert_eq!(cb.pop(), Some(3));
        assert_eq!(cb.pop(), Some(4));
        assert!(cb.is_empty());
    }

    #[test]
    fn test_matrix_operations() {
        let mut m = Matrix::new(2, 3, 0);
        m.set(0, 1, 42).unwrap();
        m.set(1, 2, 99).unwrap();
        assert_eq!(m.get(0, 1), Some(&42));
        assert_eq!(m.get(1, 2), Some(&99));
        let t = m.transpose();
        assert_eq!(t.rows(), 3);
        assert_eq!(t.cols(), 2);
        assert_eq!(t.get(1, 0), Some(&42));
    }

    #[test]
    fn test_tensor_operations() {
        let mut tensor = Tensor::new(vec![2, 2, 2], 0);
        tensor.set(&[1, 0, 1], 77).unwrap();
        assert_eq!(tensor.get(&[1, 0, 1]), Some(&77));
        assert_eq!(tensor.get(&[0, 0, 0]), Some(&0));
    }
}
