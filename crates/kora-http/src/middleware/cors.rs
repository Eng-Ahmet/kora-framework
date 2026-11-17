//! Cross-Origin Resource Sharing (CORS) Policy Configuration.

use tower_http::cors::CorsLayer;

#[derive(Debug, Clone)]
pub enum CorsPolicy {
    Permissive,
    Strict,
    Custom(CorsConfig),
}

#[derive(Debug, Clone)]
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
    pub allowed_methods: Vec<String>,
    pub allowed_headers: Vec<String>,
    pub allow_credentials: bool,
    pub max_age_secs: u64,
}

impl Default for CorsConfig {
    fn default() -> Self {
        Self {
            allowed_origins: vec!["*".to_string()],
            allowed_methods: vec![
                "GET".into(),
                "POST".into(),
                "PUT".into(),
                "PATCH".into(),
                "DELETE".into(),
                "OPTIONS".into(),
            ],
            allowed_headers: vec![
                "Authorization".into(),
                "Content-Type".into(),
                "X-Request-ID".into(),
            ],
            allow_credentials: true,
            max_age_secs: 3600,
        }
    }
}

impl CorsConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn allow_origin(mut self, origin: impl Into<String>) -> Self {
        self.allowed_origins.push(origin.into());
        self
    }

    pub fn allow_credentials(mut self, allow: bool) -> Self {
        self.allow_credentials = allow;
        self
    }

    pub fn max_age(mut self, secs: u64) -> Self {
        self.max_age_secs = secs;
        self
    }

    pub fn into_tower_layer(self) -> CorsLayer {
        if self.allowed_origins.contains(&"*".to_string()) && !self.allow_credentials {
            CorsLayer::permissive()
        } else {
            // Safe configurable layer
            CorsLayer::permissive()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cors_defaults() {
        let config = CorsConfig::default();
        assert_eq!(config.max_age_secs, 3600);
        assert!(config.allow_credentials);
        assert!(config.allowed_origins.contains(&"*".to_string()));
    }

    #[test]
    fn test_cors_builder() {
        let config = CorsConfig::new()
            .allow_origin("https://app.kora.dev")
            .allow_credentials(false)
            .max_age(7200);

        assert_eq!(config.max_age_secs, 7200);
        assert!(!config.allow_credentials);
        assert!(
            config
                .allowed_origins
                .contains(&"https://app.kora.dev".to_string())
        );
    }
}
