//! Request ID Tracking and Distributed Correlation Middleware.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(1000);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestId(pub String);

pub struct RequestIdGenerator;

impl RequestIdGenerator {
    pub fn generate() -> RequestId {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
        RequestId(format!("req_{:x}_{:x}", ts, seq))
    }

    pub fn from_header_or_generate(header_val: Option<&str>) -> RequestId {
        match header_val {
            Some(v) if !v.trim().is_empty() => RequestId(v.trim().to_string()),
            _ => Self::generate(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_id_uniqueness() {
        let id1 = RequestIdGenerator::generate();
        let id2 = RequestIdGenerator::generate();
        assert_ne!(id1, id2);
        assert!(id1.0.starts_with("req_"));
    }

    #[test]
    fn test_request_id_propagation() {
        let incoming = "trace-client-12345";
        let resolved = RequestIdGenerator::from_header_or_generate(Some(incoming));
        assert_eq!(resolved.0, incoming);
    }
}
