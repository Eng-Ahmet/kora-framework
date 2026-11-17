//! Sliding Window / Token Bucket In-Memory Rate Limiter.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub max_requests: u32,
    pub window: Duration,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_requests: 100,
            window: Duration::from_secs(60),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RateLimitStatus {
    pub allowed: bool,
    pub remaining: u32,
    pub reset_after: Duration,
}

struct ClientWindow {
    timestamps: Vec<Instant>,
}

#[derive(Clone)]
pub struct RateLimiter {
    config: RateLimitConfig,
    clients: Arc<Mutex<HashMap<String, ClientWindow>>>,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn check(&self, client_key: &str) -> RateLimitStatus {
        let now = Instant::now();
        let mut map = self.clients.lock().unwrap();

        let window = map
            .entry(client_key.to_string())
            .or_insert_with(|| ClientWindow {
                timestamps: Vec::new(),
            });

        // Purge timestamps older than the configured sliding window
        let cutoff = now.checked_sub(self.config.window).unwrap_or(now);
        window.timestamps.retain(|&t| t > cutoff);

        if window.timestamps.len() < self.config.max_requests as usize {
            window.timestamps.push(now);
            let remaining = self.config.max_requests - window.timestamps.len() as u32;
            RateLimitStatus {
                allowed: true,
                remaining,
                reset_after: self.config.window,
            }
        } else {
            let oldest = window.timestamps.first().copied().unwrap_or(now);
            let elapsed_since_oldest = now.duration_since(oldest);
            let reset_after = self
                .config
                .window
                .checked_sub(elapsed_since_oldest)
                .unwrap_or(Duration::from_millis(100));

            RateLimitStatus {
                allowed: false,
                remaining: 0,
                reset_after,
            }
        }
    }

    pub fn purge_stale(&self) {
        let now = Instant::now();
        let cutoff = now.checked_sub(self.config.window).unwrap_or(now);
        let mut map = self.clients.lock().unwrap();
        map.retain(|_, v| {
            v.timestamps.retain(|&t| t > cutoff);
            !v.timestamps.is_empty()
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter_allows_up_to_max() {
        let limiter = RateLimiter::new(RateLimitConfig {
            max_requests: 3,
            window: Duration::from_secs(10),
        });

        let s1 = limiter.check("ip-127.0.0.1");
        assert!(s1.allowed);
        assert_eq!(s1.remaining, 2);

        let s2 = limiter.check("ip-127.0.0.1");
        assert!(s2.allowed);
        assert_eq!(s2.remaining, 1);

        let s3 = limiter.check("ip-127.0.0.1");
        assert!(s3.allowed);
        assert_eq!(s3.remaining, 0);

        // Exceeded: 4th request must be blocked
        let s4 = limiter.check("ip-127.0.0.1");
        assert!(!s4.allowed);
        assert_eq!(s4.remaining, 0);

        // Different IP should still have quota
        let s_other = limiter.check("ip-192.168.1.50");
        assert!(s_other.allowed);
        assert_eq!(s_other.remaining, 2);
    }
}
