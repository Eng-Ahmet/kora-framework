//! Set Data Structures for the Kora Runtime.
//!
//! Provides comprehensive set operations and algebra:
//! - `HashSet<T>` and `Set<T>`
//! - `BTreeSet<T>`
//! - `OrderedSet<T>`
//! - `BitSet`
//! - `MultiSet<T>`

use std::collections::{BTreeSet as StdBTreeSet, HashMap as StdHashMap, HashSet as StdHashSet};
use std::fmt;
use std::hash::Hash;

/// Hash Set with full set algebra: union, intersection, difference, and symmetric difference.
#[derive(Clone, Default)]
pub struct HashSet<T> {
    inner: StdHashSet<T>,
}

impl<T: Eq + Hash + Clone> HashSet<T> {
    pub fn new() -> Self {
        Self {
            inner: StdHashSet::new(),
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: StdHashSet::with_capacity(capacity),
        }
    }

    pub fn insert(&mut self, value: T) -> bool {
        self.inner.insert(value)
    }

    pub fn add(&mut self, value: T) -> bool {
        self.insert(value)
    }

    pub fn remove(&mut self, value: &T) -> bool {
        self.inner.remove(value)
    }

    pub fn contains(&self, value: &T) -> bool {
        self.inner.contains(value)
    }

    pub fn has(&self, value: &T) -> bool {
        self.contains(value)
    }

    pub fn union(&self, other: &Self) -> Self {
        Self {
            inner: self.inner.union(&other.inner).cloned().collect(),
        }
    }

    pub fn intersection(&self, other: &Self) -> Self {
        Self {
            inner: self.inner.intersection(&other.inner).cloned().collect(),
        }
    }

    pub fn difference(&self, other: &Self) -> Self {
        Self {
            inner: self.inner.difference(&other.inner).cloned().collect(),
        }
    }

    pub fn symmetric_difference(&self, other: &Self) -> Self {
        Self {
            inner: self
                .inner
                .symmetric_difference(&other.inner)
                .cloned()
                .collect(),
        }
    }

    pub fn is_subset(&self, other: &Self) -> bool {
        self.inner.is_subset(&other.inner)
    }

    pub fn is_superset(&self, other: &Self) -> bool {
        self.inner.is_superset(&other.inner)
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn length(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn to_vec(&self) -> Vec<T> {
        self.inner.iter().cloned().collect()
    }
}

impl<T: fmt::Debug> fmt::Debug for HashSet<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Set{:?}", self.inner)
    }
}

pub type Set<T> = HashSet<T>;

impl<T: Eq + Hash + Clone> FromIterator<T> for HashSet<T> {
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> Self {
        Self {
            inner: iter.into_iter().collect(),
        }
    }
}

/// Ordered Set preserving insertion sequence.
#[derive(Clone, Default)]
pub struct OrderedSet<T> {
    order: Vec<T>,
    set: StdHashSet<T>,
}

impl<T: Eq + Hash + Clone> OrderedSet<T> {
    pub fn new() -> Self {
        Self {
            order: Vec::new(),
            set: StdHashSet::new(),
        }
    }

    pub fn insert(&mut self, item: T) -> bool {
        if self.set.insert(item.clone()) {
            self.order.push(item);
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, item: &T) -> bool {
        if self.set.remove(item) {
            if let Some(pos) = self.order.iter().position(|x| x == item) {
                self.order.remove(pos);
            }
            true
        } else {
            false
        }
    }

    pub fn contains(&self, item: &T) -> bool {
        self.set.contains(item)
    }

    pub fn as_slice(&self) -> &[T] {
        &self.order
    }

    pub fn len(&self) -> usize {
        self.order.len()
    }

    pub fn is_empty(&self) -> bool {
        self.order.is_empty()
    }

    pub fn clear(&mut self) {
        self.order.clear();
        self.set.clear();
    }
}

/// Sorted Set using balanced B-Tree.
#[derive(Clone, Default)]
pub struct BTreeSet<T> {
    inner: StdBTreeSet<T>,
}

impl<T: Ord + Clone> BTreeSet<T> {
    pub fn new() -> Self {
        Self {
            inner: StdBTreeSet::new(),
        }
    }

    pub fn insert(&mut self, item: T) -> bool {
        self.inner.insert(item)
    }

    pub fn remove(&mut self, item: &T) -> bool {
        self.inner.remove(item)
    }

    pub fn contains(&self, item: &T) -> bool {
        self.inner.contains(item)
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

/// Compact BitSet for boolean and flag arrays.
#[derive(Clone, Default)]
pub struct BitSet {
    words: Vec<u64>,
}

impl BitSet {
    pub fn new() -> Self {
        Self { words: Vec::new() }
    }

    pub fn with_capacity(bits: usize) -> Self {
        let num_words = bits.div_ceil(64);
        Self {
            words: vec![0; num_words],
        }
    }

    pub fn insert(&mut self, bit: impl std::convert::TryInto<usize>) {
        if let Ok(b) = bit.try_into() {
            let word_idx = b / 64;
            let bit_idx = b % 64;
            if word_idx >= self.words.len() {
                self.words.resize(word_idx + 1, 0);
            }
            self.words[word_idx] |= 1 << bit_idx;
        }
    }

    pub fn remove(&mut self, bit: impl std::convert::TryInto<usize>) {
        if let Ok(b) = bit.try_into() {
            let word_idx = b / 64;
            let bit_idx = b % 64;
            if word_idx < self.words.len() {
                self.words[word_idx] &= !(1 << bit_idx);
            }
        }
    }

    pub fn contains(&self, bit: impl std::convert::TryInto<usize>) -> bool {
        if let Ok(b) = bit.try_into() {
            let word_idx = b / 64;
            let bit_idx = b % 64;
            if word_idx < self.words.len() {
                (self.words[word_idx] & (1 << bit_idx)) != 0
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        self.words.iter().map(|w| w.count_ones() as usize).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn count(&self) -> usize {
        self.words.iter().map(|w| w.count_ones() as usize).sum()
    }

    pub fn clear(&mut self) {
        self.words.clear();
    }
}

/// MultiSet / Bag counting element multiplicity.
#[derive(Clone, Default)]
pub struct MultiSet<T> {
    counts: StdHashMap<T, usize>,
}

impl<T: Eq + Hash + Clone> MultiSet<T> {
    pub fn new() -> Self {
        Self {
            counts: StdHashMap::new(),
        }
    }

    pub fn insert(&mut self, item: T) {
        *self.counts.entry(item).or_insert(0) += 1;
    }

    pub fn remove(&mut self, item: &T) -> bool {
        if let Some(c) = self.counts.get_mut(item) {
            if *c > 1 {
                *c -= 1;
            } else {
                self.counts.remove(item);
            }
            true
        } else {
            false
        }
    }

    pub fn count(&self, item: &T) -> usize {
        self.counts.get(item).copied().unwrap_or(0)
    }

    pub fn contains(&self, item: &T) -> bool {
        self.counts.contains_key(item)
    }

    pub fn total_items(&self) -> usize {
        self.counts.values().sum()
    }

    pub fn unique_items(&self) -> usize {
        self.counts.len()
    }

    pub fn clear(&mut self) {
        self.counts.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_algebra() {
        let mut first = Set::new();
        first.insert(1);
        first.insert(2);
        first.insert(3);
        first.insert(4);

        let mut second = Set::new();
        second.insert(3);
        second.insert(4);
        second.insert(5);
        second.insert(6);

        let common = first.intersection(&second);
        assert_eq!(common.len(), 2);
        assert!(common.contains(&3));
        assert!(common.contains(&4));

        let combined = first.union(&second);
        assert_eq!(combined.len(), 6);

        let unique = first.difference(&second);
        assert_eq!(unique.len(), 2);
        assert!(unique.contains(&1));
        assert!(unique.contains(&2));
    }

    #[test]
    fn test_bit_set() {
        let mut bs = BitSet::new();
        bs.insert(5);
        bs.insert(128);
        assert!(bs.contains(5));
        assert!(bs.contains(128));
        assert!(!bs.contains(6));
        assert_eq!(bs.count(), 2);
        bs.remove(5);
        assert!(!bs.contains(5));
        assert_eq!(bs.count(), 1);
    }

    #[test]
    fn test_multiset() {
        let mut ms = MultiSet::new();
        ms.insert("apple");
        ms.insert("apple");
        ms.insert("orange");
        assert_eq!(ms.count(&"apple"), 2);
        assert_eq!(ms.count(&"orange"), 1);
        assert_eq!(ms.total_items(), 3);
        assert_eq!(ms.unique_items(), 2);
        ms.remove(&"apple");
        assert_eq!(ms.count(&"apple"), 1);
    }
}
