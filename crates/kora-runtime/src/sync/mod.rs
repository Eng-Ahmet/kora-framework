//! Synchronization Primitives and Concurrent Collections for Kora.

use std::collections::{HashMap as StdHashMap, HashSet as StdHashSet};
use std::sync::atomic::{AtomicBool as StdAtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex as StdMutex, RwLock as StdRwLock};

/// Thread-safe Mutex wrapper.
#[derive(Debug, Default)]
pub struct Mutex<T> {
    inner: StdMutex<T>,
}

impl<T> Mutex<T> {
    pub fn new(val: T) -> Self {
        Self {
            inner: StdMutex::new(val),
        }
    }

    pub fn lock(&self) -> std::sync::MutexGuard<'_, T> {
        self.inner.lock().expect("mutex lock poisoned")
    }

    pub fn try_lock(&self) -> Option<std::sync::MutexGuard<'_, T>> {
        self.inner.try_lock().ok()
    }
}

/// Reader-Writer Lock allowing concurrent readers or a single writer.
#[derive(Debug, Default)]
pub struct RwLock<T> {
    inner: StdRwLock<T>,
}

impl<T> RwLock<T> {
    pub fn new(val: T) -> Self {
        Self {
            inner: StdRwLock::new(val),
        }
    }

    pub fn read(&self) -> std::sync::RwLockReadGuard<'_, T> {
        self.inner.read().expect("rwlock read poisoned")
    }

    pub fn write(&self) -> std::sync::RwLockWriteGuard<'_, T> {
        self.inner.write().expect("rwlock write poisoned")
    }
}

/// Atomic 64-bit Integer.
#[derive(Debug, Default)]
pub struct AtomicInt {
    inner: AtomicI64,
}

impl AtomicInt {
    pub fn new(val: i64) -> Self {
        Self {
            inner: AtomicI64::new(val),
        }
    }

    pub fn get(&self) -> i64 {
        self.inner.load(Ordering::SeqCst)
    }

    pub fn set(&self, val: i64) {
        self.inner.store(val, Ordering::SeqCst);
    }

    pub fn add(&self, val: i64) -> i64 {
        self.inner.fetch_add(val, Ordering::SeqCst)
    }

    pub fn sub(&self, val: i64) -> i64 {
        self.inner.fetch_sub(val, Ordering::SeqCst)
    }
}

/// Atomic Boolean flag.
#[derive(Debug, Default)]
pub struct AtomicBool {
    inner: StdAtomicBool,
}

impl AtomicBool {
    pub fn new(val: bool) -> Self {
        Self {
            inner: StdAtomicBool::new(val),
        }
    }

    pub fn get(&self) -> bool {
        self.inner.load(Ordering::SeqCst)
    }

    pub fn set(&self, val: bool) {
        self.inner.store(val, Ordering::SeqCst);
    }

    pub fn swap(&self, val: bool) -> bool {
        self.inner.swap(val, Ordering::SeqCst)
    }
}

/// Concurrent Hash Map supporting safe multithreaded reads and writes.
#[derive(Clone, Default)]
pub struct ConcurrentHashMap<K, V> {
    inner: Arc<StdRwLock<StdHashMap<K, V>>>,
}

impl<K: Eq + std::hash::Hash + Clone, V: Clone> ConcurrentHashMap<K, V> {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(StdRwLock::new(StdHashMap::new())),
        }
    }

    pub fn insert(&self, key: K, val: V) {
        let mut guard = self.inner.write().expect("lock error");
        guard.insert(key, val);
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let guard = self.inner.read().expect("lock error");
        guard.get(key).cloned()
    }

    pub fn remove(&self, key: &K) -> Option<V> {
        let mut guard = self.inner.write().expect("lock error");
        guard.remove(key)
    }

    pub fn len(&self) -> usize {
        let guard = self.inner.read().expect("lock error");
        guard.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// Concurrent Hash Set for multi-threaded membership tracking.
#[derive(Clone, Default)]
pub struct ConcurrentHashSet<T> {
    inner: Arc<StdRwLock<StdHashSet<T>>>,
}

impl<T: Eq + std::hash::Hash + Clone> ConcurrentHashSet<T> {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(StdRwLock::new(StdHashSet::new())),
        }
    }

    pub fn insert(&self, item: T) -> bool {
        let mut guard = self.inner.write().expect("lock error");
        guard.insert(item)
    }

    pub fn contains(&self, item: &T) -> bool {
        let guard = self.inner.read().expect("lock error");
        guard.contains(item)
    }

    pub fn remove(&self, item: &T) -> bool {
        let mut guard = self.inner.write().expect("lock error");
        guard.remove(item)
    }

    pub fn len(&self) -> usize {
        let guard = self.inner.read().expect("lock error");
        guard.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atomic_int_and_bool() {
        let atomic_val = AtomicInt::new(10);
        assert_eq!(atomic_val.add(5), 10);
        assert_eq!(atomic_val.get(), 15);

        let flag = AtomicBool::new(false);
        assert!(!flag.swap(true));
        assert!(flag.get());
    }

    #[test]
    fn test_concurrent_map() {
        let cmap = ConcurrentHashMap::new();
        cmap.insert("k1", 100);
        cmap.insert("k2", 200);
        assert_eq!(cmap.get(&"k1"), Some(100));
        assert_eq!(cmap.len(), 2);
    }
}
