//! Request Timeout Middleware Configuration.

use std::time::Duration;

#[derive(Debug, Clone)]
pub struct TimeoutConfig {
    pub duration: Duration,
}

impl Default for TimeoutConfig {
    fn default() -> Self {
        Self {
            duration: Duration::from_secs(30),
        }
    }
}

impl TimeoutConfig {
    pub fn from_secs(secs: u64) -> Self {
        Self {
            duration: Duration::from_secs(secs),
        }
    }

    pub fn from_millis(millis: u64) -> Self {
        Self {
            duration: Duration::from_millis(millis),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeout_config() {
        let t = TimeoutConfig::from_secs(15);
        assert_eq!(t.duration, Duration::from_secs(15));
    }
}
