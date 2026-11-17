//! Unified Multi-Engine Database Suite & ORM for Kora.
//! Supports Relational SQL (MySQL, PostgreSQL, SQLite), NoSQL DocumentStore, and Redis KeyValue Cache.
//! Zero SQL injection via 100% prepared query builder, schema migrations, transactions & caching.

pub mod dialect;
pub mod kv;
pub mod migration;
pub mod nosql;
pub mod query;
pub mod transaction;

pub use dialect::SqlDialect;
pub use kv::KeyValueStore;
pub use migration::{ColumnDef, ColumnType, TableBlueprint};
pub use nosql::{Collection, Document, DocumentStore};
pub use query::{FilterClause, FilterOp, JoinClause, JoinType, LogicalOp, QueryBuilder, SqlValue};
pub use transaction::{IsolationLevel, TransactionContext};

use sqlx::{Pool, Sqlite, SqlitePool};

/// Unified Database Connection Pool Wrapper
#[derive(Clone)]
pub struct Database {
    sqlite_pool: Option<Pool<Sqlite>>,
    dialect: SqlDialect,
    document_store: DocumentStore,
    cache_store: KeyValueStore,
}

impl Database {
    pub async fn connect_sqlite_memory() -> Result<Self, String> {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .map_err(|e| format!("sqlite connection failed: {e}"))?;
        Ok(Self {
            sqlite_pool: Some(pool),
            dialect: SqlDialect::Sqlite,
            document_store: DocumentStore::new(),
            cache_store: KeyValueStore::new(),
        })
    }

    pub fn new_with_dialect(dialect: SqlDialect) -> Self {
        Self {
            sqlite_pool: None,
            dialect,
            document_store: DocumentStore::new(),
            cache_store: KeyValueStore::new(),
        }
    }

    pub fn dialect(&self) -> SqlDialect {
        self.dialect
    }

    pub fn sqlite(&self) -> Option<&Pool<Sqlite>> {
        self.sqlite_pool.as_ref()
    }

    /// Access NoSQL Document Collections (MongoDB-style).
    pub fn collection(&self, name: impl Into<String>) -> Collection {
        self.document_store.collection(name)
    }

    /// Access Redis-compatible Key-Value Store & Cache.
    pub fn cache(&self) -> KeyValueStore {
        self.cache_store.clone()
    }

    /// Spawn a query builder targeting the configured dialect.
    pub fn query_builder(&self, table: impl Into<String>) -> QueryBuilder {
        QueryBuilder::table(table)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn runs_in_memory_sqlite_query_builder() {
        let db = Database::connect_sqlite_memory()
            .await
            .expect("connect sqlite");
        let pool = db.sqlite().unwrap();

        sqlx::query(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, active BOOLEAN)",
        )
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO users (id, name, email, active) VALUES (1, 'Ahmet', 'ahmet@kora.dev', 1)",
        )
        .execute(pool)
        .await
        .unwrap();

        let (sql, binds) = QueryBuilder::table("users")
            .select(&["id", "name", "email"])
            .where_eq("active", SqlValue::Bool(true))
            .limit(1)
            .to_sql(SqlDialect::Sqlite);

        assert_eq!(
            sql,
            "SELECT \"id\", \"name\", \"email\" FROM \"users\" WHERE \"active\" = ?1 LIMIT 1"
        );
        assert_eq!(binds.len(), 1);
    }

    #[test]
    fn verifies_mysql_and_postgres_dialects_and_joins() {
        let (mysql_sql, mysql_binds) = QueryBuilder::table("orders")
            .select(&["orders.id", "customers.name", "orders.total"])
            .join("customers", "orders.customer_id", "customers.id")
            .where_gt("orders.total", SqlValue::Int(100))
            .order_by_desc("orders.id")
            .limit(10)
            .offset(20)
            .to_sql(SqlDialect::MySql);

        assert_eq!(
            mysql_sql,
            "SELECT `orders.id`, `customers.name`, `orders.total` FROM `orders` INNER JOIN `customers` ON orders.customer_id = customers.id WHERE `orders.total` > ? ORDER BY `orders.id` DESC LIMIT 20, 10"
        );
        assert_eq!(mysql_binds.len(), 1);

        let (pg_sql, pg_binds) = QueryBuilder::table("orders")
            .select(&["id", "total"])
            .where_in(
                "status",
                vec![
                    SqlValue::String("paid".into()),
                    SqlValue::String("shipped".into()),
                ],
            )
            .limit(5)
            .offset(10)
            .to_sql(SqlDialect::Postgres);

        assert_eq!(
            pg_sql,
            "SELECT \"id\", \"total\" FROM \"orders\" WHERE \"status\" IN ($1, $2) LIMIT 5 OFFSET 10"
        );
        assert_eq!(pg_binds.len(), 2);
    }

    #[test]
    fn verifies_nosql_document_store_operations() {
        let db = Database::new_with_dialect(SqlDialect::MySql);
        let col = db.collection("audit_logs");
        col.create_index("event_type", false);

        let mut doc1 = Document::new();
        doc1.insert("event_type", "user_login");
        doc1.insert("user_id", 42);
        doc1.insert(
            "metadata",
            json!({ "ip": "127.0.0.1", "device": "MacBook" }),
        );

        let id = col.insert_one(doc1).expect("insert doc");
        assert!(!id.is_empty());

        let found = col
            .find_one("event_type", &json!("user_login"))
            .expect("found doc");
        assert_eq!(found.get("user_id"), Some(&json!(42)));
        assert_eq!(found.get("metadata.ip"), Some(&json!("127.0.0.1")));

        let updated = col
            .update_one("_id", &json!(id), &[("status", json!("archived"))])
            .unwrap();
        assert!(updated);

        let count = col.count_documents();
        assert_eq!(count, 1);
    }

    #[test]
    fn verifies_redis_key_value_cache_store() {
        let db = Database::new_with_dialect(SqlDialect::Postgres);
        let cache = db.cache();

        cache.set("session_token_123", "user_id_99");
        assert_eq!(
            cache.get("session_token_123"),
            Some("user_id_99".to_string())
        );

        let counter = cache.incr("api_rate_hits");
        assert_eq!(counter, 1);
        let counter2 = cache.incr("api_rate_hits");
        assert_eq!(counter2, 2);

        cache.hset("user:99", "name", "Ahmet");
        cache.hset("user:99", "role", "admin");
        assert_eq!(cache.hget("user:99", "name"), Some("Ahmet".to_string()));
        assert_eq!(cache.hgetall("user:99").len(), 2);

        cache.lpush("tasks", "task_1");
        cache.lpush("tasks", "task_2");
        assert_eq!(cache.llen("tasks"), 2);
        assert_eq!(cache.rpop("tasks"), Some("task_1".to_string()));
    }

    #[test]
    fn verifies_schema_migration_ddl_generation() {
        let mut table = TableBlueprint::new("customers");
        table
            .id("id")
            .string("email", Some(191))
            .integer("credit_balance")
            .boolean("active")
            .json("metadata");

        let mysql_ddl = table.to_create_sql(SqlDialect::MySql);
        assert!(mysql_ddl.contains("`id` BIGINT AUTO_INCREMENT PRIMARY KEY"));
        assert!(mysql_ddl.contains("`email` VARCHAR(191)"));

        let pg_ddl = table.to_create_sql(SqlDialect::Postgres);
        assert!(pg_ddl.contains("\"id\" BIGSERIAL PRIMARY KEY"));
        assert!(pg_ddl.contains("\"metadata\" JSONB"));
    }

    #[test]
    fn security_verifies_sql_injection_immunity_with_malicious_payloads() {
        let malicious_payloads = [
            "' OR '1'='1' --",
            "admin'; DROP TABLE users; --",
            "' UNION SELECT * FROM sqlite_master --",
            "1; UPDATE users SET role='admin' WHERE id=1; --",
            "'); EXEC xp_cmdshell('dir'); --",
        ];

        for payload in malicious_payloads {
            let (sql, binds) = QueryBuilder::table("users")
                .where_eq("name", SqlValue::String(payload.to_string()))
                .to_sql(SqlDialect::MySql);

            assert!(
                sql.contains("WHERE `name` = ?"),
                "Generated SQL must parameterize the value placeholder"
            );
            assert!(
                !sql.contains(payload),
                "Raw malicious payload leaked directly into SQL query string!"
            );
            assert_eq!(binds.len(), 1);
            assert_eq!(binds[0], SqlValue::String(payload.to_string()));
        }
    }
}
