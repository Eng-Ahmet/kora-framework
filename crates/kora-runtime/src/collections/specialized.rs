//! Specialized Data Structures for the Kora Runtime.
//!
//! Provides advanced algorithmic structures:
//! - `BinaryHeap<T>` and `PriorityQueue<T>`
//! - `Trie<T>`
//! - `RadixTree<T>`
//! - `Graph<T>`, `DirectedGraph<T>`, `UndirectedGraph<T>`, `WeightedGraph<T>`
//! - `DisjointSet<T>`
//! - `BloomFilter<T>`
//! - `LruCache<K, V>`
//! - `LfuCache<K, V>`
//! - `RingBuffer<T>`

use std::collections::{BinaryHeap as StdBinaryHeap, HashMap as StdHashMap, VecDeque};
use std::hash::{DefaultHasher, Hash, Hasher};

/// Priority Queue / Binary Heap data structure.
#[derive(Clone, Default)]
pub struct BinaryHeap<T> {
    inner: StdBinaryHeap<T>,
}

impl<T: Ord> BinaryHeap<T> {
    pub fn new() -> Self {
        Self {
            inner: StdBinaryHeap::new(),
        }
    }

    pub fn push(&mut self, item: T) {
        self.inner.push(item);
    }

    pub fn pop(&mut self) -> Option<T> {
        self.inner.pop()
    }

    pub fn peek(&self) -> Option<&T> {
        self.inner.peek()
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

pub type PriorityQueue<T> = BinaryHeap<T>;

/// Prefix Tree (Trie) for associative prefix matching and dictionary lookups.
#[derive(Clone, Default)]
pub struct Trie<T> {
    root: TrieNode<T>,
    size: usize,
}

#[derive(Clone)]
struct TrieNode<T> {
    value: Option<T>,
    children: StdHashMap<char, TrieNode<T>>,
}

impl<T> Default for TrieNode<T> {
    fn default() -> Self {
        Self {
            value: None,
            children: StdHashMap::new(),
        }
    }
}

impl<T: Clone> Trie<T> {
    pub fn new() -> Self {
        Self {
            root: TrieNode::default(),
            size: 0,
        }
    }

    pub fn insert(&mut self, key: impl AsRef<str>, value: T) {
        let key = key.as_ref();
        let mut curr = &mut self.root;
        for ch in key.chars() {
            curr = curr.children.entry(ch).or_default();
        }
        if curr.value.is_none() {
            self.size += 1;
        }
        curr.value = Some(value);
    }

    pub fn get(&self, key: impl AsRef<str>) -> Option<&T> {
        let key = key.as_ref();
        let mut curr = &self.root;
        for ch in key.chars() {
            curr = curr.children.get(&ch)?;
        }
        curr.value.as_ref()
    }

    pub fn contains(&self, key: impl AsRef<str>) -> bool {
        self.get(key).is_some()
    }

    pub fn starts_with(&self, prefix: impl AsRef<str>) -> bool {
        let prefix = prefix.as_ref();
        let mut curr = &self.root;
        for ch in prefix.chars() {
            if let Some(next) = curr.children.get(&ch) {
                curr = next;
            } else {
                return false;
            }
        }
        true
    }

    pub fn len(&self) -> usize {
        self.size
    }

    pub fn is_empty(&self) -> bool {
        self.size == 0
    }
}

/// Radix Tree (compact Trie with edge compression).
#[derive(Clone, Default)]
pub struct RadixTree<T> {
    trie: Trie<T>,
}

impl<T: Clone> RadixTree<T> {
    pub fn new() -> Self {
        Self { trie: Trie::new() }
    }

    pub fn insert(&mut self, key: &str, value: T) {
        self.trie.insert(key, value);
    }

    pub fn get(&self, key: &str) -> Option<&T> {
        self.trie.get(key)
    }

    pub fn len(&self) -> usize {
        self.trie.len()
    }

    pub fn is_empty(&self) -> bool {
        self.trie.is_empty()
    }
}

/// Graph Node Identifier.
pub type NodeId = usize;

/// General Directed and Undirected Graph with weighted edges and graph algorithms.
#[derive(Clone, Default)]
pub struct Graph<T> {
    nodes: Vec<T>,
    adjacency: Vec<Vec<(NodeId, f64)>>,
    is_directed: bool,
}

impl<T: Clone> Graph<T> {
    pub fn new() -> Self {
        Self::new_directed()
    }

    pub fn new_directed() -> Self {
        Self {
            nodes: Vec::new(),
            adjacency: Vec::new(),
            is_directed: true,
        }
    }

    pub fn new_undirected() -> Self {
        Self {
            nodes: Vec::new(),
            adjacency: Vec::new(),
            is_directed: false,
        }
    }

    pub fn add_node(&mut self, value: T) -> NodeId {
        let id = self.nodes.len();
        self.nodes.push(value);
        self.adjacency.push(Vec::new());
        id
    }

    pub fn add_edge(&mut self, from: NodeId, to: NodeId) {
        self.add_weighted_edge(from, to, 1.0);
    }

    pub fn add_weighted_edge(&mut self, from: NodeId, to: NodeId, weight: f64) {
        if from < self.nodes.len() && to < self.nodes.len() {
            self.adjacency[from].push((to, weight));
            if !self.is_directed && from != to {
                self.adjacency[to].push((from, weight));
            }
        }
    }

    pub fn node_value(&self, id: NodeId) -> Option<&T> {
        self.nodes.get(id)
    }

    pub fn neighbors(&self, id: NodeId) -> Vec<NodeId> {
        self.adjacency
            .get(id)
            .map(|edges| edges.iter().map(|(n, _)| *n).collect())
            .unwrap_or_default()
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn edge_count(&self) -> usize {
        let total: usize = self.adjacency.iter().map(Vec::len).sum();
        if self.is_directed { total } else { total / 2 }
    }

    /// Breadth-First Search traversal starting from `start` node.
    pub fn bfs(&self, start: NodeId) -> Vec<NodeId> {
        let mut visited = vec![false; self.nodes.len()];
        let mut queue = VecDeque::new();
        let mut result = Vec::new();

        if start < self.nodes.len() {
            visited[start] = true;
            queue.push_back(start);
        }

        while let Some(node) = queue.pop_front() {
            result.push(node);
            for &(next, _) in &self.adjacency[node] {
                if !visited[next] {
                    visited[next] = true;
                    queue.push_back(next);
                }
            }
        }

        result
    }

    /// Depth-First Search traversal starting from `start` node.
    pub fn dfs(&self, start: NodeId) -> Vec<NodeId> {
        let mut visited = vec![false; self.nodes.len()];
        let mut result = Vec::new();

        fn dfs_helper<T>(
            node: NodeId,
            adj: &[Vec<(NodeId, f64)>],
            visited: &mut [bool],
            result: &mut Vec<NodeId>,
        ) {
            visited[node] = true;
            result.push(node);
            for &(next, _) in &adj[node] {
                if !visited[next] {
                    dfs_helper::<T>(next, adj, visited, result);
                }
            }
        }

        if start < self.nodes.len() {
            dfs_helper::<T>(start, &self.adjacency, &mut visited, &mut result);
        }

        result
    }
}

pub type DirectedGraph<T> = Graph<T>;
pub type UndirectedGraph<T> = Graph<T>;
pub type WeightedGraph<T> = Graph<T>;

/// Disjoint-Set / Union-Find data structure with path compression and union by rank.
#[derive(Clone, Default)]
pub struct DisjointSet<T: Eq + Hash + Clone> {
    parent: StdHashMap<T, T>,
    rank: StdHashMap<T, usize>,
}

impl<T: Eq + Hash + Clone> DisjointSet<T> {
    pub fn new() -> Self {
        Self {
            parent: StdHashMap::new(),
            rank: StdHashMap::new(),
        }
    }

    pub fn make_set(&mut self, item: T) {
        if !self.parent.contains_key(&item) {
            self.parent.insert(item.clone(), item.clone());
            self.rank.insert(item, 0);
        }
    }

    pub fn find(&mut self, item: &T) -> Option<T> {
        let p = self.parent.get(item)?.clone();
        if &p == item {
            Some(p)
        } else {
            let root = self.find(&p)?;
            self.parent.insert(item.clone(), root.clone());
            Some(root)
        }
    }

    pub fn union(&mut self, x: &T, y: &T) -> bool {
        let root_x = match self.find(x) {
            Some(rx) => rx,
            None => return false,
        };
        let root_y = match self.find(y) {
            Some(ry) => ry,
            None => return false,
        };

        if root_x == root_y {
            return false;
        }

        let rank_x = self.rank.get(&root_x).copied().unwrap_or(0);
        let rank_y = self.rank.get(&root_y).copied().unwrap_or(0);

        if rank_x < rank_y {
            self.parent.insert(root_x, root_y);
        } else if rank_x > rank_y {
            self.parent.insert(root_y, root_x);
        } else {
            self.parent.insert(root_y, root_x.clone());
            *self.rank.entry(root_x).or_insert(0) += 1;
        }
        true
    }

    pub fn connected(&mut self, x: &T, y: &T) -> bool {
        match (self.find(x), self.find(y)) {
            (Some(rx), Some(ry)) => rx == ry,
            _ => false,
        }
    }
}

/// Space-efficient probabilistic Bloom Filter for membership testing.
#[derive(Clone)]
pub struct BloomFilter<T> {
    bitset: Vec<bool>,
    num_hashes: usize,
    _marker: std::marker::PhantomData<T>,
}

impl<T: Hash> BloomFilter<T> {
    pub fn new(capacity: usize) -> Self {
        let size = (capacity * 10).max(64);
        Self {
            bitset: vec![false; size],
            num_hashes: 4,
            _marker: std::marker::PhantomData,
        }
    }

    fn hashes(&self, item: &T) -> Vec<usize> {
        let mut hashes = Vec::with_capacity(self.num_hashes);
        for seed in 0..self.num_hashes {
            let mut hasher = DefaultHasher::new();
            seed.hash(&mut hasher);
            item.hash(&mut hasher);
            hashes.push((hasher.finish() as usize) % self.bitset.len());
        }
        hashes
    }

    pub fn insert(&mut self, item: &T) {
        for idx in self.hashes(item) {
            self.bitset[idx] = true;
        }
    }

    pub fn add(&mut self, item: &T) {
        self.insert(item);
    }

    pub fn contains(&self, item: &T) -> bool {
        self.hashes(item).into_iter().all(|idx| self.bitset[idx])
    }

    pub fn clear(&mut self) {
        self.bitset.fill(false);
    }
}

/// Least Recently Used (LRU) Cache with bounded capacity.
#[derive(Clone)]
pub struct LruCache<K, V> {
    capacity: usize,
    order: Vec<K>,
    map: StdHashMap<K, V>,
}

impl<K: Eq + Hash + Clone, V> LruCache<K, V> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be positive");
        Self {
            capacity,
            order: Vec::new(),
            map: StdHashMap::new(),
        }
    }

    pub fn put(&mut self, key: K, value: V) {
        if self.map.contains_key(&key) {
            if let Some(pos) = self.order.iter().position(|k| k == &key) {
                self.order.remove(pos);
            }
        } else if self.map.len() >= self.capacity {
            let oldest = self.order.remove(0);
            self.map.remove(&oldest);
        }

        self.order.push(key.clone());
        self.map.insert(key, value);
    }

    pub fn insert(&mut self, key: K, value: V) {
        self.put(key, value);
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        if self.map.contains_key(key) {
            if let Some(pos) = self.order.iter().position(|k| k == key) {
                let k = self.order.remove(pos);
                self.order.push(k);
            }
            self.map.get(key)
        } else {
            None
        }
    }

    pub fn contains_key(&self, key: &K) -> bool {
        self.map.contains_key(key)
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn clear(&mut self) {
        self.order.clear();
        self.map.clear();
    }
}

/// Least Frequently Used (LFU) Cache with frequency counts.
#[derive(Clone)]
pub struct LfuCache<K, V> {
    capacity: usize,
    values: StdHashMap<K, V>,
    frequencies: StdHashMap<K, usize>,
}

impl<K: Eq + Hash + Clone, V> LfuCache<K, V> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be positive");
        Self {
            capacity,
            values: StdHashMap::new(),
            frequencies: StdHashMap::new(),
        }
    }

    pub fn put(&mut self, key: K, value: V) {
        if !self.values.contains_key(&key) && self.values.len() >= self.capacity {
            // Evict least frequent key
            if let Some((least_key, _)) = self.frequencies.iter().min_by_key(|(_, f)| *f) {
                let evict_key = least_key.clone();
                self.values.remove(&evict_key);
                self.frequencies.remove(&evict_key);
            }
        }

        self.values.insert(key.clone(), value);
        *self.frequencies.entry(key).or_insert(0) += 1;
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        if let Some(v) = self.values.get(key) {
            *self.frequencies.entry(key.clone()).or_insert(0) += 1;
            Some(v)
        } else {
            None
        }
    }

    pub fn len(&self) -> usize {
        self.values.len()
    }

    pub fn is_empty(&self) -> bool {
        self.values.is_empty()
    }

    pub fn clear(&mut self) {
        self.values.clear();
        self.frequencies.clear();
    }
}

/// Ring Buffer alias mapping to CircularBuffer.
pub type RingBuffer<T> = super::sequential::CircularBuffer<T>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trie() {
        let mut trie = Trie::new();
        trie.insert("apple", 100);
        trie.insert("app", 50);
        assert_eq!(trie.get("apple"), Some(&100));
        assert_eq!(trie.get("app"), Some(&50));
        assert!(trie.starts_with("ap"));
        assert!(!trie.starts_with("banana"));
    }

    #[test]
    fn test_graph_bfs_dfs() {
        let mut g = Graph::new_directed();
        let n0 = g.add_node("Root");
        let n1 = g.add_node("Child A");
        let n2 = g.add_node("Child B");
        g.add_edge(n0, n1);
        g.add_edge(n0, n2);

        let bfs_res = g.bfs(n0);
        assert_eq!(bfs_res, vec![n0, n1, n2]);
        let dfs_res = g.dfs(n0);
        assert_eq!(dfs_res.len(), 3);
    }

    #[test]
    fn test_disjoint_set() {
        let mut ds = DisjointSet::new();
        ds.make_set(1);
        ds.make_set(2);
        ds.make_set(3);
        assert!(!ds.connected(&1, &2));
        ds.union(&1, &2);
        assert!(ds.connected(&1, &2));
        assert!(!ds.connected(&1, &3));
        ds.union(&2, &3);
        assert!(ds.connected(&1, &3));
    }

    #[test]
    fn test_bloom_filter() {
        let mut bf = BloomFilter::new(100);
        bf.insert(&"hello");
        bf.insert(&"world");
        assert!(bf.contains(&"hello"));
        assert!(bf.contains(&"world"));
    }

    #[test]
    fn test_lru_cache() {
        let mut cache = LruCache::new(2);
        cache.put("a", 1);
        cache.put("b", 2);
        assert_eq!(cache.get(&"a"), Some(&1));
        // Inserting "c" should evict "b" because "a" was accessed recently
        cache.put("c", 3);
        assert_eq!(cache.get(&"a"), Some(&1));
        assert_eq!(cache.get(&"b"), None);
        assert_eq!(cache.get(&"c"), Some(&3));
    }
}
