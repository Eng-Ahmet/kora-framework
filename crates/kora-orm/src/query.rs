//! Deep Fluent Parameterized Query Builder for Multi-Dialect SQL Engines.

use crate::dialect::SqlDialect;
use serde::{Deserialize, Serialize};
use std::fmt::Write;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SqlValue {
    Int(i64),
    Float(f64),
    String(String),
    Bool(bool),
    Null,
    Array(Vec<SqlValue>),
}

impl From<i64> for SqlValue {
    fn from(v: i64) -> Self {
        Self::Int(v)
    }
}

impl From<i32> for SqlValue {
    fn from(v: i32) -> Self {
        Self::Int(v as i64)
    }
}

impl From<f64> for SqlValue {
    fn from(v: f64) -> Self {
        Self::Float(v)
    }
}

impl From<&str> for SqlValue {
    fn from(v: &str) -> Self {
        Self::String(v.to_string())
    }
}

impl From<String> for SqlValue {
    fn from(v: String) -> Self {
        Self::String(v)
    }
}

impl From<bool> for SqlValue {
    fn from(v: bool) -> Self {
        Self::Bool(v)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterOp {
    Eq,
    Neq,
    Lt,
    Lte,
    Gt,
    Gte,
    Like,
    ILike,
    In,
    NotIn,
    Between,
    IsNull,
    IsNotNull,
}

impl FilterOp {
    pub fn as_sql(&self) -> &'static str {
        match self {
            Self::Eq => "=",
            Self::Neq => "!=",
            Self::Lt => "<",
            Self::Lte => "<=",
            Self::Gt => ">",
            Self::Gte => ">=",
            Self::Like => "LIKE",
            Self::ILike => "ILIKE",
            Self::In => "IN",
            Self::NotIn => "NOT IN",
            Self::Between => "BETWEEN",
            Self::IsNull => "IS NULL",
            Self::IsNotNull => "IS NOT NULL",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone)]
pub struct FilterClause {
    pub column: String,
    pub op: FilterOp,
    pub value: SqlValue,
    pub logical: LogicalOp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinType {
    Inner,
    Left,
    Right,
    Full,
}

impl JoinType {
    pub fn as_sql(&self) -> &'static str {
        match self {
            Self::Inner => "INNER JOIN",
            Self::Left => "LEFT JOIN",
            Self::Right => "RIGHT JOIN",
            Self::Full => "FULL OUTER JOIN",
        }
    }
}

#[derive(Debug, Clone)]
pub struct JoinClause {
    pub join_type: JoinType,
    pub table: String,
    pub left_col: String,
    pub right_col: String,
}

/// 100% Parameterized Query Builder
#[derive(Debug, Clone, Default)]
pub struct QueryBuilder {
    table: String,
    columns: Vec<String>,
    joins: Vec<JoinClause>,
    filters: Vec<FilterClause>,
    group_by: Vec<String>,
    having: Vec<FilterClause>,
    order_by: Vec<(String, bool)>, // (col, is_desc)
    limit: Option<usize>,
    offset: Option<usize>,
}

impl QueryBuilder {
    pub fn table(name: impl Into<String>) -> Self {
        Self {
            table: name.into(),
            columns: vec!["*".into()],
            joins: Vec::new(),
            filters: Vec::new(),
            group_by: Vec::new(),
            having: Vec::new(),
            order_by: Vec::new(),
            limit: None,
            offset: None,
        }
    }

    pub fn select(mut self, cols: &[&str]) -> Self {
        self.columns = cols.iter().map(|&s| s.to_string()).collect();
        self
    }

    pub fn where_eq(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Eq,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_ne(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Neq,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_lt(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Lt,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_gt(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Gt,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_lte(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Lte,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_gte(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Gte,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_like(mut self, col: impl Into<String>, pattern: impl Into<String>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Like,
            value: SqlValue::String(pattern.into()),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_in(mut self, col: impl Into<String>, vals: Vec<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::In,
            value: SqlValue::Array(vals),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_null(mut self, col: impl Into<String>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::IsNull,
            value: SqlValue::Null,
            logical: LogicalOp::And,
        });
        self
    }

    pub fn where_not_null(mut self, col: impl Into<String>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::IsNotNull,
            value: SqlValue::Null,
            logical: LogicalOp::And,
        });
        self
    }

    pub fn or_where_eq(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.filters.push(FilterClause {
            column: col.into(),
            op: FilterOp::Eq,
            value: val.into(),
            logical: LogicalOp::Or,
        });
        self
    }

    pub fn join(
        mut self,
        table: impl Into<String>,
        left_col: impl Into<String>,
        right_col: impl Into<String>,
    ) -> Self {
        self.joins.push(JoinClause {
            join_type: JoinType::Inner,
            table: table.into(),
            left_col: left_col.into(),
            right_col: right_col.into(),
        });
        self
    }

    pub fn left_join(
        mut self,
        table: impl Into<String>,
        left_col: impl Into<String>,
        right_col: impl Into<String>,
    ) -> Self {
        self.joins.push(JoinClause {
            join_type: JoinType::Left,
            table: table.into(),
            left_col: left_col.into(),
            right_col: right_col.into(),
        });
        self
    }

    pub fn group_by(mut self, cols: &[&str]) -> Self {
        self.group_by = cols.iter().map(|&s| s.to_string()).collect();
        self
    }

    pub fn having_gt(mut self, col: impl Into<String>, val: impl Into<SqlValue>) -> Self {
        self.having.push(FilterClause {
            column: col.into(),
            op: FilterOp::Gt,
            value: val.into(),
            logical: LogicalOp::And,
        });
        self
    }

    pub fn order_by_asc(mut self, col: impl Into<String>) -> Self {
        self.order_by.push((col.into(), false));
        self
    }

    pub fn order_by_desc(mut self, col: impl Into<String>) -> Self {
        self.order_by.push((col.into(), true));
        self
    }

    pub fn limit(mut self, n: usize) -> Self {
        self.limit = Some(n);
        self
    }

    pub fn offset(mut self, n: usize) -> Self {
        self.offset = Some(n);
        self
    }

    /// Generates parameterized SELECT SQL query targeting the chosen dialect.
    pub fn to_sql(&self, dialect: SqlDialect) -> (String, Vec<SqlValue>) {
        let cols = self
            .columns
            .iter()
            .map(|c| {
                if c == "*" || c.contains('(') {
                    c.clone()
                } else {
                    dialect.quote_identifier(c)
                }
            })
            .collect::<Vec<_>>()
            .join(", ");

        let table_quoted = dialect.quote_identifier(&self.table);
        let mut sql = format!("SELECT {cols} FROM {table_quoted}");
        let mut binds = Vec::new();
        let mut param_index = 1;

        // Joins
        for j in &self.joins {
            let jt = j.join_type.as_sql();
            let j_table = dialect.quote_identifier(&j.table);
            let _ = write!(
                sql,
                " {} {} ON {} = {}",
                jt, j_table, j.left_col, j.right_col
            );
        }

        // Filters (WHERE)
        if !self.filters.is_empty() {
            sql.push_str(" WHERE ");
            for (idx, f) in self.filters.iter().enumerate() {
                if idx > 0 {
                    match f.logical {
                        LogicalOp::And => sql.push_str(" AND "),
                        LogicalOp::Or => sql.push_str(" OR "),
                    }
                }

                let col = dialect.quote_identifier(&f.column);
                match f.op {
                    FilterOp::IsNull | FilterOp::IsNotNull => {
                        let _ = write!(sql, "{} {}", col, f.op.as_sql());
                    }
                    FilterOp::In | FilterOp::NotIn => {
                        if let SqlValue::Array(items) = &f.value {
                            let placeholders = (0..items.len())
                                .map(|_| {
                                    let p = dialect.placeholder(param_index);
                                    param_index += 1;
                                    p
                                })
                                .collect::<Vec<_>>()
                                .join(", ");
                            let _ = write!(sql, "{} {} ({})", col, f.op.as_sql(), placeholders);
                            binds.extend(items.clone());
                        }
                    }
                    _ => {
                        let p = dialect.placeholder(param_index);
                        param_index += 1;
                        let _ = write!(sql, "{} {} {}", col, f.op.as_sql(), p);
                        binds.push(f.value.clone());
                    }
                }
            }
        }

        // Group By
        if !self.group_by.is_empty() {
            let gb = self
                .group_by
                .iter()
                .map(|c| dialect.quote_identifier(c))
                .collect::<Vec<_>>()
                .join(", ");
            let _ = write!(sql, " GROUP BY {gb}");
        }

        // Having
        if !self.having.is_empty() {
            sql.push_str(" HAVING ");
            for (idx, h) in self.having.iter().enumerate() {
                if idx > 0 {
                    sql.push_str(" AND ");
                }
                let p = dialect.placeholder(param_index);
                param_index += 1;
                let _ = write!(sql, "{} {} {}", h.column, h.op.as_sql(), p);
                binds.push(h.value.clone());
            }
        }

        // Order By
        if !self.order_by.is_empty() {
            let ob = self
                .order_by
                .iter()
                .map(|(c, desc)| {
                    format!(
                        "{} {}",
                        dialect.quote_identifier(c),
                        if *desc { "DESC" } else { "ASC" }
                    )
                })
                .collect::<Vec<_>>()
                .join(", ");
            let _ = write!(sql, " ORDER BY {ob}");
        }

        // Limit & Offset
        match dialect {
            SqlDialect::MySql => {
                if let Some(l) = self.limit {
                    if let Some(o) = self.offset {
                        let _ = write!(sql, " LIMIT {o}, {l}");
                    } else {
                        let _ = write!(sql, " LIMIT {l}");
                    }
                }
            }
            SqlDialect::Postgres | SqlDialect::Sqlite => {
                if let Some(l) = self.limit {
                    let _ = write!(sql, " LIMIT {l}");
                }
                if let Some(o) = self.offset {
                    let _ = write!(sql, " OFFSET {o}");
                }
            }
        }

        (sql, binds)
    }

    /// Emits parameterized INSERT INTO statement.
    pub fn to_insert_sql(
        table: &str,
        values: &[(&str, SqlValue)],
        dialect: SqlDialect,
    ) -> (String, Vec<SqlValue>) {
        let t_quoted = dialect.quote_identifier(table);
        let cols = values
            .iter()
            .map(|(c, _)| dialect.quote_identifier(c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholders = (1..=values.len())
            .map(|idx| dialect.placeholder(idx))
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!("INSERT INTO {t_quoted} ({cols}) VALUES ({placeholders})");
        let binds = values.iter().map(|(_, v)| v.clone()).collect();
        (sql, binds)
    }

    /// Emits parameterized UPDATE statement.
    pub fn to_update_sql(
        table: &str,
        values: &[(&str, SqlValue)],
        where_col: &str,
        where_val: SqlValue,
        dialect: SqlDialect,
    ) -> (String, Vec<SqlValue>) {
        let t_quoted = dialect.quote_identifier(table);
        let mut binds = Vec::new();
        let mut assignments = Vec::new();
        let mut idx = 1;

        for (col, val) in values {
            assignments.push(format!(
                "{} = {}",
                dialect.quote_identifier(col),
                dialect.placeholder(idx)
            ));
            binds.push(val.clone());
            idx += 1;
        }

        let where_clause = format!(
            "{} = {}",
            dialect.quote_identifier(where_col),
            dialect.placeholder(idx)
        );
        binds.push(where_val);

        let sql = format!(
            "UPDATE {} SET {} WHERE {}",
            t_quoted,
            assignments.join(", "),
            where_clause
        );
        (sql, binds)
    }

    /// Emits parameterized DELETE statement.
    pub fn to_delete_sql(
        table: &str,
        where_col: &str,
        where_val: SqlValue,
        dialect: SqlDialect,
    ) -> (String, Vec<SqlValue>) {
        let t_quoted = dialect.quote_identifier(table);
        let p = dialect.placeholder(1);
        let sql = format!(
            "DELETE FROM {} WHERE {} = {}",
            t_quoted,
            dialect.quote_identifier(where_col),
            p
        );
        (sql, vec![where_val])
    }
}
