//! OWASP-Compliant Security Headers Middleware for Kora.

use axum::http::HeaderMap;

#[derive(Debug, Clone)]
pub struct SecurityHeadersConfig {
    pub hsts_enabled: bool,
    pub hsts_max_age_secs: u64,
    pub hsts_include_subdomains: bool,
    pub hsts_preload: bool,
    pub frame_options: String,
    pub content_type_options: String,
    pub xss_protection: String,
    pub referrer_policy: String,
    pub content_security_policy: String,
    pub permissions_policy: String,
}

impl Default for SecurityHeadersConfig {
    fn default() -> Self {
        Self {
            hsts_enabled: true,
            hsts_max_age_secs: 31536000, // 1 year
            hsts_include_subdomains: true,
            hsts_preload: true,
            frame_options: "DENY".into(),
            content_type_options: "nosniff".into(),
            xss_protection: "1; mode=block".into(),
            referrer_policy: "strict-origin-when-cross-origin".into(),
            content_security_policy: "default-src 'self'; frame-ancestors 'none';".into(),
            permissions_policy: "camera=(), microphone=(), geolocation=()".into(),
        }
    }
}

pub struct SecurityHeaders;

impl SecurityHeaders {
    pub fn apply(headers: &mut HeaderMap, config: &SecurityHeadersConfig) {
        if config.hsts_enabled {
            let mut hsts = format!("max-age={}", config.hsts_max_age_secs);
            if config.hsts_include_subdomains {
                hsts.push_str("; includeSubDomains");
            }
            if config.hsts_preload {
                hsts.push_str("; preload");
            }
            if let Ok(val) = hsts.parse() {
                headers.insert("strict-transport-security", val);
            }
        }

        if let Ok(val) = config.frame_options.parse() {
            headers.insert("x-frame-options", val);
        }
        if let Ok(val) = config.content_type_options.parse() {
            headers.insert("x-content-type-options", val);
        }
        if let Ok(val) = config.xss_protection.parse() {
            headers.insert("x-xss-protection", val);
        }
        if let Ok(val) = config.referrer_policy.parse() {
            headers.insert("referrer-policy", val);
        }
        if let Ok(val) = config.content_security_policy.parse() {
            headers.insert("content-security-policy", val);
        }
        if let Ok(val) = config.permissions_policy.parse() {
            headers.insert("permissions-policy", val);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_headers_injection() {
        let mut map = HeaderMap::new();
        let config = SecurityHeadersConfig::default();
        SecurityHeaders::apply(&mut map, &config);

        assert_eq!(map.get("x-frame-options").unwrap(), "DENY");
        assert_eq!(map.get("x-content-type-options").unwrap(), "nosniff");
        assert!(map.get("strict-transport-security").is_some());
    }
}
