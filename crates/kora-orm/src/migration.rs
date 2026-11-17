//! Schema Migration Engine & DDL Query Generator (MySQL, PostgreSQL, SQLite).

use crate::dialect::SqlDialect;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColumnType {
    Id,
    Integer,
    BigInt,
    String(Option<usize>),
    Text,
    Float,
    Boolean,
    DateTime,
    Json,
}

impl ColumnType {
    pub fn to_sql(&self, dialect: SqlDialect) -> String {
        match (self, dialect) {
            (Self::Id, SqlDialect::MySql) => "BIGINT AUTO_INCREMENT PRIMARY KEY".to_string(),
            (Self::Id, SqlDialect::Postgres) => "BIGSERIAL PRIMARY KEY".to_string(),
            (Self::Id, SqlDialect::Sqlite) => "INTEGER PRIMARY KEY AUTOINCREMENT".to_string(),

            (Self::Integer, _) => "INTEGER".to_string(),
            (Self::BigInt, _) => "BIGINT".to_string(),

            (Self::String(len), SqlDialect::MySql) => {
                format!("VARCHAR({})", len.unwrap_or(255))
            }
            (Self::String(len), SqlDialect::Postgres) => {
                format!("VARCHAR({})", len.unwrap_or(255))
            }
            (Self::String(_), SqlDialect::Sqlite) => "TEXT".to_string(),

            (Self::Text, _) => "TEXT".to_string(),
            (Self::Float, SqlDialect::Postgres) => "DOUBLE PRECISION".to_string(),
            (Self::Float, _) => "DOUBLE".to_string(),
            (Self::Boolean, SqlDialect::Postgres) => "BOOLEAN".to_string(),
            (Self::Boolean, _) => "TINYINT(1)".to_string(),

            (Self::DateTime, SqlDialect::Postgres) => "TIMESTAMPTZ".to_string(),
            (Self::DateTime, _) => "DATETIME".to_string(),

            (Self::Json, SqlDialect::Postgres) => "JSONB".to_string(),
            (Self::Json, _) => "JSON".to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ColumnDef {
    pub name: String,
    pub col_type: ColumnType,
    pub nullable: bool,
    pub is_unique: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TableBlueprint {
    pub name: String,
    pub columns: Vec<ColumnDef>,
    pub if_not_exists: bool,
}

impl TableBlueprint {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            columns: Vec::new(),
            if_not_exists: true,
        }
    }

    pub fn id(&mut self, name: &str) -> &mut Self {
        self.columns.push(ColumnDef {
            name: name.to_string(),
            col_type: ColumnType::Id,
            nullable: false,
            is_unique: true,
            default_value: None,
        });
        self
    }

    pub fn string(&mut self, name: &str, len: Option<usize>) -> &mut Self {
        self.columns.push(ColumnDef {
            name: name.to_string(),
            col_type: ColumnType::String(len),
            nullable: false,
            is_unique: false,
            default_value: None,
        });
        self
    }

    pub fn integer(&mut self, name: &str) -> &mut Self {
        self.columns.push(ColumnDef {
            name: name.to_string(),
            col_type: ColumnType::Integer,
            nullable: false,
            is_unique: false,
            default_value: None,
        });
        self
    }

    pub fn boolean(&mut self, name: &str) -> &mut Self {
        self.columns.push(ColumnDef {
            name: name.to_string(),
            col_type: ColumnType::Boolean,
            nullable: false,
            is_unique: false,
            default_value: None,
        });
        self
    }

    pub fn json(&mut self, name: &str) -> &mut Self {
        self.columns.push(ColumnDef {
            name: name.to_string(),
            col_type: ColumnType::Json,
            nullable: true,
            is_unique: false,
            default_value: None,
        });
        self
    }

    pub fn to_create_sql(&self, dialect: SqlDialect) -> String {
        let t_quoted = dialect.quote_identifier(&self.name);
        let if_ne = if self.if_not_exists {
            "IF NOT EXISTS "
        } else {
            ""
        };
        let mut defs = Vec::new();

        for col in &self.columns {
            let mut s = format!(
                "{} {}",
                dialect.quote_identifier(&col.name),
                col.col_type.to_sql(dialect)
            );
            if !col.nullable && col.col_type != ColumnType::Id {
                s.push_str(" NOT NULL");
            }
            if col.is_unique && col.col_type != ColumnType::Id {
                s.push_str(" UNIQUE");
            }
            if let Some(def) = &col.default_value {
                s.push_str(&format!(" DEFAULT {def}"));
            }
            defs.push(s);
        }

        format!(
            "CREATE TABLE {if_ne}{t_quoted} (\n  {}\n);",
            defs.join(",\n  ")
        )
    }
}
