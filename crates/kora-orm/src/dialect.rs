//! Database Engine Dialect Definitions (MySQL, PostgreSQL, SQLite)
//! with SQL Identifier Injection Defense and Parameterized Placeholders.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SqlDialect {
    MySql,
    Postgres,
    Sqlite,
}

impl SqlDialect {
    /// Sanitize and securely escape table or column identifiers to prevent SQL identifier injection.
    pub fn quote_identifier(&self, ident: &str) -> String {
        // Strip null bytes to prevent truncation attacks
        let clean = ident.replace('\0', "");
        match self {
            Self::MySql => format!("`{}`", clean.replace('`', "``")),
            Self::Postgres => format!("\"{}\"", clean.replace('"', "\"\"")),
            Self::Sqlite => format!("\"{}\"", clean.replace('"', "\"\"")),
        }
    }

    /// Parameter placeholder for prepared statements.
    pub fn placeholder(&self, index: usize) -> String {
        match self {
            Self::MySql => "?".to_string(),
            Self::Postgres => format!("${index}"),
            Self::Sqlite => format!("?{index}"),
        }
    }

    /// Returns human-readable engine name.
    pub fn name(&self) -> &'static str {
        match self {
            Self::MySql => "MySQL",
            Self::Postgres => "PostgreSQL",
            Self::Sqlite => "SQLite",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identifier_escaping_defense() {
        let malicious_ident = "users`; DROP TABLE users; --";
        let quoted_mysql = SqlDialect::MySql.quote_identifier(malicious_ident);
        assert_eq!(quoted_mysql, "`users``; DROP TABLE users; --`");

        let malicious_pg = "users\"; DROP TABLE users; --";
        let quoted_pg = SqlDialect::Postgres.quote_identifier(malicious_pg);
        assert_eq!(quoted_pg, "\"users\"\"; DROP TABLE users; --\"");

        let null_injected = "users\0_admin";
        assert_eq!(
            SqlDialect::Sqlite.quote_identifier(null_injected),
            "\"users_admin\""
        );
    }
}
