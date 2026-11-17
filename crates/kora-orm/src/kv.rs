//! In-Memory Key-Value Store & Cache Engine (Redis-Compatible Operations & Protocol).
//! Supports Strings, Hashes, Lists, Sets, Counters, and TTL Eviction.
#![allow(clippy::collapsible_if, clippy::for_kv_map)]

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
enum StorageValue {
    String(String),
    Int(i64),
    Hash(HashMap<String, String>),
    List(VecDeque<String>),
    Set(HashSet<String>),
}

#[derive(Debug, Clone)]
struct Entry {
    value: StorageValue,
    expires_at: Option<Instant>,
}

impl Entry {
    fn is_expired(&self) -> bool {
        if let Some(exp) = self.expires_at {
            Instant::now() >= exp
        } else {
            false
        }
    }
}

/// Thread-Safe In-Memory Key-Value & Redis-Compatible Cache Store
#[derive(Debug, Clone, Default)]
pub struct KeyValueStore {
    data: Arc<RwLock<HashMap<String, Entry>>>,
}

impl KeyValueStore {
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ------------------------------------------------------------------------
    // String Operations
    // ------------------------------------------------------------------------

    pub fn set(&self, key: impl Into<String>, val: impl Into<String>) {
        let mut map = self.data.write().unwrap();
        map.insert(
            key.into(),
            Entry {
                value: StorageValue::String(val.into()),
                expires_at: None,
            },
        );
    }

    pub fn set_ex(&self, key: impl Into<String>, val: impl Into<String>, ttl_secs: u64) {
        let mut map = self.data.write().unwrap();
        map.insert(
            key.into(),
            Entry {
                value: StorageValue::String(val.into()),
                expires_at: Some(Instant::now() + Duration::from_secs(ttl_secs)),
            },
        );
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(key) {
            if entry.is_expired() {
                None
            } else if let StorageValue::String(s) = &entry.value {
                Some(s.clone())
            } else {
                None
            }
        } else {
            None
        }
    }

    pub fn del(&self, key: &str) -> bool {
        self.data.write().unwrap().remove(key).is_some()
    }

    pub fn exists(&self, key: &str) -> bool {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(key) {
            !entry.is_expired()
        } else {
            false
        }
    }

    // ------------------------------------------------------------------------
    // Numeric & Counter Operations (INCR, DECR)
    // ------------------------------------------------------------------------

    pub fn incr(&self, key: impl Into<String>) -> i64 {
        self.incr_by(key, 1)
    }

    pub fn decr(&self, key: impl Into<String>) -> i64 {
        self.incr_by(key, -1)
    }

    pub fn incr_by(&self, key: impl Into<String>, amount: i64) -> i64 {
        let k = key.into();
        let mut map = self.data.write().unwrap();
        let entry = map.entry(k).or_insert(Entry {
            value: StorageValue::Int(0),
            expires_at: None,
        });

        match &mut entry.value {
            StorageValue::Int(i) => {
                *i += amount;
                *i
            }
            StorageValue::String(s) => {
                let mut num = s.parse::<i64>().unwrap_or(0);
                num += amount;
                entry.value = StorageValue::Int(num);
                num
            }
            _ => 0,
        }
    }

    // ------------------------------------------------------------------------
    // Hash Operations (HSET, HGET, HGETALL, HDEL)
    // ------------------------------------------------------------------------

    pub fn hset(
        &self,
        hash_key: impl Into<String>,
        field: impl Into<String>,
        val: impl Into<String>,
    ) {
        let hk = hash_key.into();
        let mut map = self.data.write().unwrap();
        let entry = map.entry(hk).or_insert(Entry {
            value: StorageValue::Hash(HashMap::new()),
            expires_at: None,
        });

        if let StorageValue::Hash(h) = &mut entry.value {
            h.insert(field.into(), val.into());
        }
    }

    pub fn hget(&self, hash_key: &str, field: &str) -> Option<String> {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(hash_key) {
            if !entry.is_expired() {
                if let StorageValue::Hash(h) = &entry.value {
                    return h.get(field).cloned();
                }
            }
        }
        None
    }

    pub fn hgetall(&self, hash_key: &str) -> HashMap<String, String> {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(hash_key) {
            if !entry.is_expired() {
                if let StorageValue::Hash(h) = &entry.value {
                    return h.clone();
                }
            }
        }
        HashMap::new()
    }

    pub fn hdel(&self, hash_key: &str, field: &str) -> bool {
        let mut map = self.data.write().unwrap();
        if let Some(entry) = map.get_mut(hash_key) {
            if let StorageValue::Hash(h) = &mut entry.value {
                return h.remove(field).is_some();
            }
        }
        false
    }

    // ------------------------------------------------------------------------
    // List Operations (LPUSH, RPUSH, LPOP, RPOP, LLEN)
    // ------------------------------------------------------------------------

    pub fn lpush(&self, list_key: impl Into<String>, val: impl Into<String>) -> usize {
        let lk = list_key.into();
        let mut map = self.data.write().unwrap();
        let entry = map.entry(lk).or_insert(Entry {
            value: StorageValue::List(VecDeque::new()),
            expires_at: None,
        });

        if let StorageValue::List(l) = &mut entry.value {
            l.push_front(val.into());
            l.len()
        } else {
            0
        }
    }

    pub fn rpush(&self, list_key: impl Into<String>, val: impl Into<String>) -> usize {
        let lk = list_key.into();
        let mut map = self.data.write().unwrap();
        let entry = map.entry(lk).or_insert(Entry {
            value: StorageValue::List(VecDeque::new()),
            expires_at: None,
        });

        if let StorageValue::List(l) = &mut entry.value {
            l.push_back(val.into());
            l.len()
        } else {
            0
        }
    }

    pub fn lpop(&self, list_key: &str) -> Option<String> {
        let mut map = self.data.write().unwrap();
        if let Some(entry) = map.get_mut(list_key) {
            if let StorageValue::List(l) = &mut entry.value {
                return l.pop_front();
            }
        }
        None
    }

    pub fn rpop(&self, list_key: &str) -> Option<String> {
        let mut map = self.data.write().unwrap();
        if let Some(entry) = map.get_mut(list_key) {
            if let StorageValue::List(l) = &mut entry.value {
                return l.pop_back();
            }
        }
        None
    }

    pub fn llen(&self, list_key: &str) -> usize {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(list_key) {
            if let StorageValue::List(l) = &entry.value {
                return l.len();
            }
        }
        0
    }

    // ------------------------------------------------------------------------
    // Set Operations (SADD, SMEMBERS, SISMEMBER, SREM)
    // ------------------------------------------------------------------------

    pub fn sadd(&self, set_key: impl Into<String>, member: impl Into<String>) -> bool {
        let sk = set_key.into();
        let mut map = self.data.write().unwrap();
        let entry = map.entry(sk).or_insert(Entry {
            value: StorageValue::Set(HashSet::new()),
            expires_at: None,
        });

        if let StorageValue::Set(s) = &mut entry.value {
            s.insert(member.into())
        } else {
            false
        }
    }

    pub fn smembers(&self, set_key: &str) -> HashSet<String> {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(set_key) {
            if let StorageValue::Set(s) = &entry.value {
                return s.clone();
            }
        }
        HashSet::new()
    }

    pub fn sismember(&self, set_key: &str, member: &str) -> bool {
        let map = self.data.read().unwrap();
        if let Some(entry) = map.get(set_key) {
            if let StorageValue::Set(s) = &entry.value {
                return s.contains(member);
            }
        }
        false
    }

    // ------------------------------------------------------------------------
    // TTL & Eviction
    // ------------------------------------------------------------------------

    pub fn expire(&self, key: &str, seconds: u64) -> bool {
        let mut map = self.data.write().unwrap();
        if let Some(entry) = map.get_mut(key) {
            entry.expires_at = Some(Instant::now() + Duration::from_secs(seconds));
            true
        } else {
            false
        }
    }
}
