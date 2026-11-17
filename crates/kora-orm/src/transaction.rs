//! Transaction & ACID Unit of Work Management.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IsolationLevel {
    ReadUncommitted,
    ReadCommitted,
    RepeatableRead,
    Serializable,
}

impl IsolationLevel {
    pub fn as_sql(&self) -> &'static str {
        match self {
            Self::ReadUncommitted => "READ UNCOMMITTED",
            Self::ReadCommitted => "READ COMMITTED",
            Self::RepeatableRead => "REPEATABLE READ",
            Self::Serializable => "SERIALIZABLE",
        }
    }
}

#[derive(Debug, Clone)]
pub struct TransactionContext {
    pub isolation: IsolationLevel,
    pub is_active: bool,
    pub savepoints: Vec<String>,
}

impl TransactionContext {
    pub fn new(isolation: IsolationLevel) -> Self {
        Self {
            isolation,
            is_active: true,
            savepoints: Vec::new(),
        }
    }

    pub fn begin_sql(&self) -> String {
        format!(
            "SET TRANSACTION ISOLATION LEVEL {};\nBEGIN;",
            self.isolation.as_sql()
        )
    }

    pub fn commit_sql(&self) -> &'static str {
        "COMMIT;"
    }

    pub fn rollback_sql(&self) -> &'static str {
        "ROLLBACK;"
    }

    pub fn savepoint_sql(&mut self, name: &str) -> String {
        self.savepoints.push(name.to_string());
        format!("SAVEPOINT {name};")
    }

    pub fn rollback_to_savepoint_sql(&self, name: &str) -> String {
        format!("ROLLBACK TO SAVEPOINT {name};")
    }
}
