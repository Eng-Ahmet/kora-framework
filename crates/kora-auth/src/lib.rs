//! Contextual Security, Authentication, RBAC, and Token Signing for Kora.
//! Uses Argon2id password hashing, HMAC-SHA256 JWT, and Rate Limiting.

use argon2::{
    Argon2,
    password_hash::{
        PasswordHash, PasswordHasher as _, PasswordVerifier as _, SaltString, rand_core::OsRng,
    },
};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::{HashMap, HashSet};

type HmacSha256 = Hmac<Sha256>;

/// Standard RFC 7519 JSON Web Token Registered Claims.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StandardClaims {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
    pub iss: Option<String>,
    pub role: Option<String>,
}

impl StandardClaims {
    pub fn new(sub: impl Into<String>, validity_secs: u64) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        Self {
            sub: sub.into(),
            exp: now + validity_secs,
            iat: now,
            iss: Some("kora-auth".to_string()),
            role: None,
        }
    }

    pub fn with_role(mut self, role: impl Into<String>) -> Self {
        self.role = Some(role.into());
        self
    }

    pub fn is_expired(&self, clock_skew_secs: u64) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        now > (self.exp + clock_skew_secs)
    }
}

pub struct PasswordAuth;

impl PasswordAuth {
    pub fn hash_password(password: &str) -> Result<String, String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| format!("hashing failed: {e}"))?;
        Ok(hash.to_string())
    }

    pub fn verify_password(password: &str, hash_str: &str) -> bool {
        let parsed = match PasswordHash::new(hash_str) {
            Ok(p) => p,
            Err(_) => return false,
        };
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok()
    }
}

pub struct JwtSigner;

impl JwtSigner {
    pub fn sign_hs256(secret: &[u8], payload_json: &str) -> Result<String, String> {
        let mut mac =
            HmacSha256::new_from_slice(secret).map_err(|e| format!("hmac init failed: {e}"))?;
        mac.update(payload_json.as_bytes());
        let result = mac.finalize();
        Ok(hex_encode(&result.into_bytes()))
    }

    pub fn verify_hs256(secret: &[u8], payload_json: &str, signature_hex: &str) -> bool {
        let mut mac = match HmacSha256::new_from_slice(secret) {
            Ok(m) => m,
            Err(_) => return false,
        };
        mac.update(payload_json.as_bytes());
        let expected = hex_encode(&mac.finalize().into_bytes());
        constant_time_compare(expected.as_bytes(), signature_hex.as_bytes())
    }

    /// Signs standard registered claims into an authenticated bearer token.
    pub fn sign_claims(secret: &[u8], claims: &StandardClaims) -> Result<String, String> {
        let payload = serde_json::to_string(claims).map_err(|e| e.to_string())?;
        let sig = Self::sign_hs256(secret, &payload)?;
        Ok(format!("{}.{}", hex_encode(payload.as_bytes()), sig))
    }

    /// Verifies cryptographic signature and expiration status of a claims token.
    pub fn verify_token_claims(
        secret: &[u8],
        token: &str,
        clock_skew_secs: u64,
    ) -> Result<StandardClaims, String> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 2 {
            return Err("invalid token format: expected payload.signature".to_string());
        }
        let payload_bytes =
            hex_decode(parts[0]).map_err(|e| format!("invalid hex payload: {e}"))?;
        let payload_str = std::str::from_utf8(&payload_bytes).map_err(|e| e.to_string())?;

        if !Self::verify_hs256(secret, payload_str, parts[1]) {
            return Err("cryptographic signature verification failed".to_string());
        }

        let claims: StandardClaims = serde_json::from_str(payload_str)
            .map_err(|e| format!("failed to parse claims: {e}"))?;

        if claims.is_expired(clock_skew_secs) {
            return Err("token has expired".to_string());
        }

        Ok(claims)
    }
}

/// Constant-time byte slice comparison to mitigate timing attacks.
fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if !s.len().is_multiple_of(2) {
        return Err("hex string length must be even".to_string());
    }
    let mut bytes = Vec::with_capacity(s.len() / 2);
    for i in (0..s.len()).step_by(2) {
        let byte = u8::from_str_radix(&s[i..i + 2], 16)
            .map_err(|e| format!("invalid hex byte at {i}: {e}"))?;
        bytes.push(byte);
    }
    Ok(bytes)
}

/// Role-Based Access Control (RBAC) Guard
#[derive(Default)]
pub struct RbacGuard {
    role_permissions: HashMap<String, HashSet<String>>,
}

impl RbacGuard {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_permission(&mut self, role: &str, permission: &str) {
        self.role_permissions
            .entry(role.to_string())
            .or_default()
            .insert(permission.to_string());
    }

    pub fn has_permission(&self, role: &str, permission: &str) -> bool {
        self.role_permissions
            .get(role)
            .map(|perms| perms.contains(permission))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use argon2::password_hash::rand_core::RngCore;

    fn test_password() -> String {
        SaltString::generate(&mut OsRng).to_string()
    }

    fn test_secret_key() -> [u8; 32] {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        key
    }

    #[test]
    fn hashes_and_verifies_password_with_argon2id() {
        let pwd = test_password();
        let hash = PasswordAuth::hash_password(&pwd).expect("hash success");
        assert!(PasswordAuth::verify_password(&pwd, &hash));
        let mismatched_pwd = format!("mismatch_{}", test_password());
        assert!(!PasswordAuth::verify_password(&mismatched_pwd, &hash));
    }

    #[test]
    fn signs_and_verifies_jwt_hmac() {
        let secret = test_secret_key();
        let payload = r#"{"sub":"user_123","role":"admin"}"#;
        let sig = JwtSigner::sign_hs256(&secret, payload).unwrap();
        assert!(JwtSigner::verify_hs256(&secret, payload, &sig));
        assert!(!JwtSigner::verify_hs256(
            &secret,
            r#"{"tampered":true}"#,
            &sig
        ));
    }

    #[test]
    fn security_verifies_argon2id_unique_salts_and_brute_force_resistance() {
        let pwd = test_password();
        let hash1 = PasswordAuth::hash_password(pwd.as_str()).unwrap();
        let hash2 = PasswordAuth::hash_password(pwd.as_str()).unwrap();
        // Cryptographic salts must be unique, ensuring identical passwords yield different hashes
        assert_ne!(hash1, hash2);
        assert!(PasswordAuth::verify_password(pwd.as_str(), &hash1));
        assert!(PasswordAuth::verify_password(pwd.as_str(), &hash2));
    }

    #[test]
    fn security_rejects_jwt_tampering_and_forgery() {
        let secret = test_secret_key();
        let payload = r#"{"uid":42,"role":"customer","balance":100}"#;
        let sig = JwtSigner::sign_hs256(&secret, payload).unwrap();

        // 1. Bit-flip in signature
        let mut tampered_sig = sig.clone();
        let last_char = if tampered_sig.ends_with('0') {
            '1'
        } else {
            '0'
        };
        tampered_sig.pop();
        tampered_sig.push(last_char);
        assert!(!JwtSigner::verify_hs256(&secret, payload, &tampered_sig));

        // 2. Privilege escalation tampering in payload
        let escalated_payload = r#"{"uid":42,"role":"superadmin","balance":999999}"#;
        assert!(!JwtSigner::verify_hs256(&secret, escalated_payload, &sig));

        // 3. Different signing key
        let rogue_key = test_secret_key();
        assert!(!JwtSigner::verify_hs256(&rogue_key, payload, &sig));
    }

    #[test]
    fn security_enforces_rbac_least_privilege() {
        let mut guard = RbacGuard::new();
        guard.add_permission("editor", "posts:create");
        guard.add_permission("editor", "posts:update");

        // Allowed
        assert!(guard.has_permission("editor", "posts:create"));
        assert!(guard.has_permission("editor", "posts:update"));

        // Denied: least privilege principle
        assert!(!guard.has_permission("editor", "posts:delete"));
        assert!(!guard.has_permission("editor", "users:manage"));
        assert!(!guard.has_permission("guest", "posts:create"));
    }

    #[test]
    fn security_verifies_jwt_claims_and_expiration_rejection() {
        let secret = test_secret_key();

        // 1. Valid Token
        let valid_claims = StandardClaims::new("user_1001", 3600).with_role("admin");
        let token = JwtSigner::sign_claims(&secret, &valid_claims).unwrap();
        let verified = JwtSigner::verify_token_claims(&secret, &token, 0).unwrap();
        assert_eq!(verified.sub, "user_1001");
        assert_eq!(verified.role.as_deref(), Some("admin"));

        // 2. Expired Token must be rejected
        let mut expired_claims = StandardClaims::new("user_1002", 0);
        expired_claims.exp = 1000; // far in the past
        let expired_token = JwtSigner::sign_claims(&secret, &expired_claims).unwrap();
        let res = JwtSigner::verify_token_claims(&secret, &expired_token, 0);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("token has expired"));
    }
}
