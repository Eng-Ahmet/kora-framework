//! Associative Data Structures for the Kora Runtime.
//!
//! Provides memory-safe associative key-value collections:
//! - `HashMap<K, V>` and `Map<K, V>`
//! - `BTreeMap<K, V>`
//! - `OrderedMap<K, V>`
//! - `MultiMap<K, V>`
//! - `BiMap<K, V>`

use std::collections::{BTreeMap as StdBTreeMap, HashMap as StdHashMap};
use std::fmt;
use std::hash::Hash;

/// Standard Hash Table map with safe retrieval, insertion, removal, and entry inspection.
#[derive(Clone, Default)]
pub struct HashMap<K, V> {
    inner: StdHashMap<K, V>,
}

impl<K: Eq + Hash, V> HashMap<K, V> {
    pub fn new() -> Self {
        Self {
            inner: StdHashMap::new(),
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: StdHashMap::with_capacity(capacity),
        }
    }

    pub fn insert(&mut self, key: K, value: V) -> Option<V> {
        self.inner.insert(key, value)
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.inner.get(key)
    }

    pub fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        self.inner.get_mut(key)
    }

    pub fn remove(&mut self, key: &K) -> Option<V> {
        self.inner.remove(key)
    }

    pub fn contains_key(&self, key: &K) -> bool {
        self.inner.contains_key(key)
    }

    #[allow(non_snake_case)]
    pub fn containsKey(&self, key: &K) -> bool {
        self.contains_key(key)
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

    pub fn keys(&self) -> Vec<&K> {
        self.inner.keys().collect()
    }

    pub fn values(&self) -> Vec<&V> {
        self.inner.values().collect()
    }
}

impl<K: fmt::Debug, V: fmt::Debug> fmt::Debug for HashMap<K, V> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "HashMap{:?}", self.inner)
    }
}

pub type Map<K, V> = HashMap<K, V>;

/// Sorted Map backed by a balanced B-Tree for deterministic in-order iteration.
#[derive(Clone, Default)]
pub struct BTreeMap<K, V> {
    inner: StdBTreeMap<K, V>,
}

impl<K: Ord, V> BTreeMap<K, V> {
    pub fn new() -> Self {
        Self {
            inner: StdBTreeMap::new(),
        }
    }

    pub fn insert(&mut self, key: K, value: V) -> Option<V> {
        self.inner.insert(key, value)
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.inner.get(key)
    }

    pub fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        self.inner.get_mut(key)
    }

    pub fn remove(&mut self, key: &K) -> Option<V> {
        self.inner.remove(key)
    }

    pub fn contains_key(&self, key: &K) -> bool {
        self.inner.contains_key(key)
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

/// Ordered Map preserving exact key insertion sequence.
#[derive(Clone, Default)]
pub struct OrderedMap<K, V> {
    order: Vec<K>,
    map: StdHashMap<K, V>,
}

impl<K: Eq + Hash + Clone, V> OrderedMap<K, V> {
    pub fn new() -> Self {
        Self {
            order: Vec::new(),
            map: StdHashMap::new(),
        }
    }

    pub fn insert(&mut self, key: K, value: V) -> Option<V> {
        if !self.map.contains_key(&key) {
            self.order.push(key.clone());
        }
        self.map.insert(key, value)
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.map.get(key)
    }

    pub fn remove(&mut self, key: &K) -> Option<V> {
        if let Some(pos) = self.order.iter().position(|k| k == key) {
            self.order.remove(pos);
        }
        self.map.remove(key)
    }

    pub fn contains_key(&self, key: &K) -> bool {
        self.map.contains_key(key)
    }

    pub fn keys_ordered(&self) -> &[K] {
        &self.order
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    pub fn clear(&mut self) {
        self.order.clear();
        self.map.clear();
    }
}

/// MultiMap associating a single key with multiple values.
#[derive(Clone, Default)]
pub struct MultiMap<K, V> {
    inner: StdHashMap<K, Vec<V>>,
}

impl<K: Eq + Hash, V> MultiMap<K, V> {
    pub fn new() -> Self {
        Self {
            inner: StdHashMap::new(),
        }
    }

    pub fn insert(&mut self, key: K, value: V) {
        self.inner.entry(key).or_default().push(value);
    }

    pub fn get(&self, key: &K) -> Option<&[V]> {
        self.inner.get(key).map(|v| v.as_slice())
    }

    pub fn remove_all(&mut self, key: &K) -> Option<Vec<V>> {
        self.inner.remove(key)
    }

    pub fn contains_key(&self, key: &K) -> bool {
        self.inner.contains_key(key)
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn total_values(&self) -> usize {
        self.inner.values().map(Vec::len).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }
}

/// Bidirectional Map maintaining 1-to-1 forward and reverse lookups.
#[derive(Clone, Default)]
pub struct BiMap<K, V> {
    forward: StdHashMap<K, V>,
    backward: StdHashMap<V, K>,
}

impl<K: Eq + Hash + Clone, V: Eq + Hash + Clone> BiMap<K, V> {
    pub fn new() -> Self {
        Self {
            forward: StdHashMap::new(),
            backward: StdHashMap::new(),
        }
    }

    pub fn insert(&mut self, key: K, val: V) {
        // Remove existing associations to keep bijection pure
        if let Some(old_val) = self.forward.remove(&key) {
            self.backward.remove(&old_val);
        }
        if let Some(old_key) = self.backward.remove(&val) {
            self.forward.remove(&old_key);
        }
        self.forward.insert(key.clone(), val.clone());
        self.backward.insert(val, key);
    }

    pub fn get_by_key(&self, key: &K) -> Option<&V> {
        self.forward.get(key)
    }

    pub fn get_by_value(&self, val: &V) -> Option<&K> {
        self.backward.get(val)
    }

    pub fn remove_by_key(&mut self, key: &K) -> Option<V> {
        let val = self.forward.remove(key)?;
        self.backward.remove(&val);
        Some(val)
    }

    pub fn remove_by_value(&mut self, val: &V) -> Option<K> {
        let key = self.backward.remove(val)?;
        self.forward.remove(&key);
        Some(key)
    }

    pub fn len(&self) -> usize {
        self.forward.len()
    }

    pub fn is_empty(&self) -> bool {
        self.forward.is_empty()
    }

    pub fn clear(&mut self) {
        self.forward.clear();
        self.backward.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_map() {
        let mut map = HashMap::new();
        map.insert("name", "Ahmet");
        map.insert("city", "Istanbul");
        assert_eq!(map.get(&"name"), Some(&"Ahmet"));
        assert_eq!(map.len(), 2);
        assert!(map.contains_key(&"city"));
        assert_eq!(map.remove(&"city"), Some("Istanbul"));
        assert_eq!(map.len(), 1);
    }

    #[test]
    fn test_ordered_map() {
        let mut om = OrderedMap::new();
        om.insert("c", 3);
        om.insert("a", 1);
        om.insert("b", 2);
        assert_eq!(om.keys_ordered(), &["c", "a", "b"]);
    }

    #[test]
    fn test_multimap() {
        let mut mm = MultiMap::new();
        mm.insert("user", "read");
        mm.insert("user", "write");
        mm.insert("admin", "all");
        assert_eq!(mm.get(&"user"), Some(&["read", "write"][..]));
        assert_eq!(mm.total_values(), 3);
    }

    #[test]
    fn test_bimap() {
        let mut bm = BiMap::new();
        bm.insert(1, "one");
        bm.insert(2, "two");
        assert_eq!(bm.get_by_key(&1), Some(&"one"));
        assert_eq!(bm.get_by_value(&"two"), Some(&2));
        bm.remove_by_key(&1);
        assert_eq!(bm.get_by_value(&"one"), None);
    }
}
