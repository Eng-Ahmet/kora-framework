//! Structured JSON and Formatted Access Logger for HTTP Requests.

use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessLogEntry {
    pub timestamp: i64,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub latency_ms: f64,
    pub client_ip: String,
    pub request_id: String,
    pub user_agent: Option<String>,
}

pub struct AccessLogger;

impl AccessLogger {
    pub fn format_text(entry: &AccessLogEntry) -> String {
        format!(
            "[{}] {} {} -> {} (took {:.2}ms) [client: {}] [req_id: {}]",
            entry.timestamp,
            entry.method,
            entry.path,
            entry.status,
            entry.latency_ms,
            entry.client_ip,
            entry.request_id
        )
    }

    pub fn format_json(entry: &AccessLogEntry) -> Result<String, serde_json::Error> {
        serde_json::to_string(entry)
    }

    pub fn create_entry(
        method: &str,
        path: &str,
        status: u16,
        latency: Duration,
        client_ip: &str,
        request_id: &str,
    ) -> AccessLogEntry {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        AccessLogEntry {
            timestamp: ts,
            method: method.to_string(),
            path: path.to_string(),
            status,
            latency_ms: latency.as_secs_f64() * 1000.0,
            client_ip: client_ip.to_string(),
            request_id: request_id.to_string(),
            user_agent: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_access_log_formatting() {
        let entry = AccessLogger::create_entry(
            "POST",
            "/api/v1/orders",
            201,
            Duration::from_millis(42),
            "10.0.0.1",
            "req_abc123",
        );

        let text = AccessLogger::format_text(&entry);
        assert!(text.contains("POST /api/v1/orders -> 201"));
        assert!(text.contains("took 42.00ms"));

        let json = AccessLogger::format_json(&entry).unwrap();
        assert!(json.contains("\"status\":201"));
        assert!(json.contains("\"request_id\":\"req_abc123\""));
    }
}
