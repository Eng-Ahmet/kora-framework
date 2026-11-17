//! High-Resilience Circuit Breaker Pattern for Upstream and Internal Invocations.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    pub failure_threshold: u32,
    pub recovery_duration: Duration,
    pub half_open_success_threshold: u32,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            recovery_duration: Duration::from_secs(30),
            half_open_success_threshold: 2,
        }
    }
}

struct InnerState {
    state: CircuitState,
    consecutive_failures: u32,
    consecutive_successes: u32,
    opened_at: Option<Instant>,
}

#[derive(Clone)]
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    state: Arc<Mutex<InnerState>>,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            state: Arc::new(Mutex::new(InnerState {
                state: CircuitState::Closed,
                consecutive_failures: 0,
                consecutive_successes: 0,
                opened_at: None,
            })),
        }
    }

    pub fn state(&self) -> CircuitState {
        let mut inner = self.state.lock().unwrap();
        if inner.state == CircuitState::Open
            && inner
                .opened_at
                .is_some_and(|opened_at| opened_at.elapsed() >= self.config.recovery_duration)
        {
            inner.state = CircuitState::HalfOpen;
            inner.consecutive_successes = 0;
        }
        inner.state
    }

    pub fn can_execute(&self) -> bool {
        match self.state() {
            CircuitState::Closed | CircuitState::HalfOpen => true,
            CircuitState::Open => false,
        }
    }

    pub fn record_success(&self) {
        let mut inner = self.state.lock().unwrap();
        match inner.state {
            CircuitState::HalfOpen => {
                inner.consecutive_successes += 1;
                if inner.consecutive_successes >= self.config.half_open_success_threshold {
                    inner.state = CircuitState::Closed;
                    inner.consecutive_failures = 0;
                    inner.consecutive_successes = 0;
                    inner.opened_at = None;
                }
            }
            CircuitState::Closed => {
                inner.consecutive_failures = 0;
            }
            CircuitState::Open => {}
        }
    }

    pub fn record_failure(&self) {
        let mut inner = self.state.lock().unwrap();
        match inner.state {
            CircuitState::Closed => {
                inner.consecutive_failures += 1;
                if inner.consecutive_failures >= self.config.failure_threshold {
                    inner.state = CircuitState::Open;
                    inner.opened_at = Some(Instant::now());
                }
            }
            CircuitState::HalfOpen => {
                // Any failure in HalfOpen immediately trips back to Open
                inner.state = CircuitState::Open;
                inner.opened_at = Some(Instant::now());
                inner.consecutive_successes = 0;
            }
            CircuitState::Open => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_breaker_tripping_and_recovery() {
        let cb = CircuitBreaker::new(CircuitBreakerConfig {
            failure_threshold: 3,
            recovery_duration: Duration::from_millis(50),
            half_open_success_threshold: 1,
        });

        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.can_execute());

        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed);

        // 3rd failure trips the breaker
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(!cb.can_execute());

        // Wait for recovery timeout
        std::thread::sleep(Duration::from_millis(60));
        assert_eq!(cb.state(), CircuitState::HalfOpen);
        assert!(cb.can_execute());

        // Probe succeeds -> Closed
        cb.record_success();
        assert_eq!(cb.state(), CircuitState::Closed);
    }
}
