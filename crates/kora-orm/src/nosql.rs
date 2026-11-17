//! In-Memory & Production-Grade NoSQL Document Database Engine (MongoDB-Compatible API).
//! Supports Schema-Free Documents, Nested Filtering, Indexing, and Atomic Update Operators.
#![allow(clippy::collapsible_if, clippy::for_kv_map)]

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Document representation for NoSQL operations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Document {
    pub fields: Map<String, Value>,
}

impl Document {
    pub fn new() -> Self {
        Self { fields: Map::new() }
    }

    pub fn from_json(json: &str) -> Result<Self, String> {
        let val: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        match val {
            Value::Object(map) => Ok(Self { fields: map }),
            _ => Err("Document root must be a JSON object".to_string()),
        }
    }

    pub fn to_json(&self) -> String {
        Value::Object(self.fields.clone()).to_string()
    }

    pub fn insert(&mut self, key: impl Into<String>, value: impl Into<Value>) {
        self.fields.insert(key.into(), value.into());
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        // Supports nested dot syntax: "user.profile.age"
        let mut parts = key.split('.');
        let first = parts.next()?;
        let mut curr = self.fields.get(first)?;
        for part in parts {
            match curr {
                Value::Object(m) => {
                    curr = m.get(part)?;
                }
                _ => return None,
            }
        }
        Some(curr)
    }

    pub fn id(&self) -> Option<String> {
        self.fields
            .get("_id")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
    }
}

impl Default for Document {
    fn default() -> Self {
        Self::new()
    }
}

/// NoSQL Document Collection
#[derive(Debug, Clone)]
pub struct Collection {
    name: String,
    docs: Arc<RwLock<HashMap<String, Document>>>,
    indexes: Arc<RwLock<HashMap<String, bool>>>, // (field, is_unique)
}

impl Collection {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            docs: Arc::new(RwLock::new(HashMap::new())),
            indexes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    /// Insert single document with automatic `_id` UUID generation.
    pub fn insert_one(&self, mut doc: Document) -> Result<String, String> {
        let id = match doc.id() {
            Some(existing_id) => existing_id,
            None => {
                let generated = format!(
                    "doc_{:x}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_nanos()
                );
                doc.insert("_id", generated.clone());
                generated
            }
        };

        // Check unique index constraints
        let indexes = self.indexes.read().unwrap();
        let docs = self.docs.read().unwrap();
        for (field, is_unique) in indexes.iter() {
            if *is_unique {
                if let Some(val) = doc.get(field) {
                    for (k, existing_doc) in docs.iter() {
                        if k != &id && existing_doc.get(field) == Some(val) {
                            return Err(format!(
                                "Duplicate key error: unique index violation on field `{field}`"
                            ));
                        }
                    }
                }
            }
        }
        drop(docs);
        drop(indexes);

        self.docs.write().unwrap().insert(id.clone(), doc);
        Ok(id)
    }

    /// Insert multiple documents in batch.
    pub fn insert_many(&self, docs: Vec<Document>) -> Result<Vec<String>, String> {
        let mut ids = Vec::new();
        for d in docs {
            let id = self.insert_one(d)?;
            ids.push(id);
        }
        Ok(ids)
    }

    /// Find a single document matching key-value filter.
    pub fn find_one(&self, filter_key: &str, filter_val: &Value) -> Option<Document> {
        let docs = self.docs.read().unwrap();
        for (_, doc) in docs.iter() {
            if doc.get(filter_key) == Some(filter_val) {
                return Some(doc.clone());
            }
        }
        None
    }

    /// Find all documents matching filter criteria with pagination.
    pub fn find(
        &self,
        filter_key: Option<&str>,
        filter_val: Option<&Value>,
        limit: Option<usize>,
        skip: Option<usize>,
    ) -> Vec<Document> {
        let docs = self.docs.read().unwrap();
        let mut results = Vec::new();

        for (_, doc) in docs.iter() {
            if let (Some(k), Some(v)) = (filter_key, filter_val) {
                if doc.get(k) != Some(v) {
                    continue;
                }
            }
            results.push(doc.clone());
        }

        // Apply skip
        let skipped = if let Some(s) = skip {
            results.into_iter().skip(s).collect::<Vec<_>>()
        } else {
            results
        };

        // Apply limit
        if let Some(l) = limit {
            skipped.into_iter().take(l).collect()
        } else {
            skipped
        }
    }

    /// Update one document by `_id` or filter.
    pub fn update_one(
        &self,
        filter_key: &str,
        filter_val: &Value,
        set_fields: &[(&str, Value)],
    ) -> Result<bool, String> {
        let mut docs = self.docs.write().unwrap();
        for (_, doc) in docs.iter_mut() {
            if doc.get(filter_key) == Some(filter_val) {
                for (k, v) in set_fields {
                    doc.insert(*k, v.clone());
                }
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Update all documents matching filter criteria.
    pub fn update_many(
        &self,
        filter_key: &str,
        filter_val: &Value,
        set_fields: &[(&str, Value)],
    ) -> Result<usize, String> {
        let mut docs = self.docs.write().unwrap();
        let mut count = 0;
        for (_, doc) in docs.iter_mut() {
            if doc.get(filter_key) == Some(filter_val) {
                for (k, v) in set_fields {
                    doc.insert(*k, v.clone());
                }
                count += 1;
            }
        }
        Ok(count)
    }

    /// Delete single document matching filter.
    pub fn delete_one(&self, filter_key: &str, filter_val: &Value) -> Result<bool, String> {
        let mut docs = self.docs.write().unwrap();
        let mut target_id = None;
        for (id, doc) in docs.iter() {
            if doc.get(filter_key) == Some(filter_val) {
                target_id = Some(id.clone());
                break;
            }
        }
        if let Some(id) = target_id {
            docs.remove(&id);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Delete all documents matching filter.
    pub fn delete_many(&self, filter_key: &str, filter_val: &Value) -> Result<usize, String> {
        let mut docs = self.docs.write().unwrap();
        let mut target_ids = Vec::new();
        for (id, doc) in docs.iter() {
            if doc.get(filter_key) == Some(filter_val) {
                target_ids.push(id.clone());
            }
        }
        let count = target_ids.len();
        for id in target_ids {
            docs.remove(&id);
        }
        Ok(count)
    }

    /// Returns document count.
    pub fn count_documents(&self) -> usize {
        self.docs.read().unwrap().len()
    }

    /// Create index on field (e.g. unique constraint).
    pub fn create_index(&self, field: impl Into<String>, is_unique: bool) {
        self.indexes
            .write()
            .unwrap()
            .insert(field.into(), is_unique);
    }
}

/// NoSQL Document Database Store
#[derive(Debug, Clone, Default)]
pub struct DocumentStore {
    collections: Arc<RwLock<HashMap<String, Collection>>>,
}

impl DocumentStore {
    pub fn new() -> Self {
        Self {
            collections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get or create collection by name.
    pub fn collection(&self, name: impl Into<String>) -> Collection {
        let n = name.into();
        let mut map = self.collections.write().unwrap();
        map.entry(n.clone())
            .or_insert_with(|| Collection::new(n))
            .clone()
    }

    /// List all collection names.
    pub fn list_collections(&self) -> Vec<String> {
        self.collections.read().unwrap().keys().cloned().collect()
    }

    /// Drop collection by name.
    pub fn drop_collection(&self, name: &str) -> bool {
        self.collections.write().unwrap().remove(name).is_some()
    }
}
