//! GitHub HTTPS credentials for desktop Git: device authorization and OS keyring storage.
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const KEYRING_SERVICE: &str = "com.jamscript.desktop";
const KEYRING_ACCOUNT: &str = "github-https";
const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const DEFAULT_SCOPE: &str = "repo";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAuthStatus {
    pub signed_in: bool,
    pub device_flow_available: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBegin {
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u64,
    pub expires_in: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevicePoll {
    pub status: String,
}

struct PendingDevice {
    device_code: String,
    interval: u64,
    expires_at: Instant,
    next_poll: Instant,
}

static PENDING: Mutex<Option<PendingDevice>> = Mutex::new(None);

fn client_id() -> Option<String> {
    std::env::var("JAMSCRIPT_GITHUB_CLIENT_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            option_env!("JAMSCRIPT_GITHUB_CLIENT_ID")
                .map(str::to_string)
                .filter(|value| !value.trim().is_empty())
        })
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

pub fn load_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) if !token.trim().is_empty() => Ok(Some(token)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read stored GitHub credentials: {error}")),
    }
}

pub fn store_token(token: &str) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() || token.len() > 255 || token.contains(['\n', '\r', ' ']) {
        return Err("Paste a single GitHub token without spaces".into());
    }
    if !(token.starts_with("ghp_")
        || token.starts_with("github_pat_")
        || token.starts_with("gho_")
        || token.starts_with("ghu_"))
    {
        return Err("That does not look like a GitHub token".into());
    }
    entry()?
        .set_password(token)
        .map_err(|e| format!("Could not store GitHub credentials: {e}"))
}

pub fn clear_token() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not clear GitHub credentials: {error}")),
    }
}

pub fn auth_status() -> Result<GitHubAuthStatus, String> {
    Ok(GitHubAuthStatus {
        signed_in: load_token()?.is_some(),
        device_flow_available: client_id().is_some(),
    })
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

pub fn begin_device_flow() -> Result<DeviceBegin, String> {
    let Some(client_id) = client_id() else {
        return Err(
            "Device sign-in needs JAMSCRIPT_GITHUB_CLIENT_ID. Paste a fine-grained token instead, or set that client id for your GitHub OAuth App with Device Flow enabled."
                .into(),
        );
    };
    let body = ureq::post(DEVICE_CODE_URL)
        .set("Accept", "application/json")
        .send_form(&[("client_id", client_id.as_str()), ("scope", DEFAULT_SCOPE)])
        .map_err(|e| format!("Could not start GitHub sign-in: {e}"))?
        .into_json::<DeviceCodeResponse>()
        .map_err(|e| format!("GitHub returned an unexpected device response: {e}"))?;
    let interval = body.interval.max(5);
    *PENDING.lock().map_err(|e| e.to_string())? = Some(PendingDevice {
        device_code: body.device_code,
        interval,
        expires_at: Instant::now() + Duration::from_secs(body.expires_in.max(60)),
        next_poll: Instant::now(),
    });
    let _ = open::that(&body.verification_uri);
    Ok(DeviceBegin {
        user_code: body.user_code,
        verification_uri: body.verification_uri,
        interval,
        expires_in: body.expires_in,
    })
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    interval: Option<u64>,
}

pub fn poll_device_flow() -> Result<DevicePoll, String> {
    let Some(client_id) = client_id() else {
        return Err("Device sign-in is not configured".into());
    };
    let mut pending_guard = PENDING.lock().map_err(|e| e.to_string())?;
    let Some(pending) = pending_guard.as_mut() else {
        return Err("Start GitHub sign-in before polling".into());
    };
    if Instant::now() >= pending.expires_at {
        *pending_guard = None;
        return Ok(DevicePoll {
            status: "expired".into(),
        });
    }
    if Instant::now() < pending.next_poll {
        return Ok(DevicePoll {
            status: "pending".into(),
        });
    }
    let device_code = pending.device_code.clone();
    let interval = pending.interval;
    drop(pending_guard);

    let response = ureq::post(ACCESS_TOKEN_URL)
        .set("Accept", "application/json")
        .send_form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
        ])
        .map_err(|e| format!("Could not check GitHub sign-in: {e}"))?
        .into_json::<TokenResponse>()
        .map_err(|e| format!("GitHub returned an unexpected token response: {e}"))?;

    if let Some(token) = response.access_token.filter(|value| !value.is_empty()) {
        store_token(&token)?;
        *PENDING.lock().map_err(|e| e.to_string())? = None;
        return Ok(DevicePoll {
            status: "complete".into(),
        });
    }
    match response.error.as_deref() {
        Some("authorization_pending") | None => {
            let mut pending_guard = PENDING.lock().map_err(|e| e.to_string())?;
            if let Some(pending) = pending_guard.as_mut() {
                pending.next_poll = Instant::now() + Duration::from_secs(interval);
            }
            Ok(DevicePoll {
                status: "pending".into(),
            })
        }
        Some("slow_down") => {
            let mut pending_guard = PENDING.lock().map_err(|e| e.to_string())?;
            if let Some(pending) = pending_guard.as_mut() {
                let wait = response.interval.unwrap_or(interval + 5).max(interval);
                pending.interval = wait;
                pending.next_poll = Instant::now() + Duration::from_secs(wait);
            }
            Ok(DevicePoll {
                status: "slow_down".into(),
            })
        }
        Some("access_denied") => {
            *PENDING.lock().map_err(|e| e.to_string())? = None;
            Ok(DevicePoll {
                status: "denied".into(),
            })
        }
        Some("expired_token") => {
            *PENDING.lock().map_err(|e| e.to_string())? = None;
            Ok(DevicePoll {
                status: "expired".into(),
            })
        }
        Some(other) => Err(format!("GitHub refused sign-in ({other})")),
    }
}

pub fn map_remote_error(error: &str) -> String {
    let lower = error.to_ascii_lowercase();
    if lower.contains("no tls stream available") {
        return "This desktop build is missing Git HTTPS support. Update or rebuild JamScript, then retry Push.".into();
    }
    if lower.contains("401")
        || lower.contains("403")
        || lower.contains("authentication")
        || lower.contains("auth fail")
        || lower.contains("credentials")
    {
        return "GitHub refused this token. Sign in again or paste a fine-grained token with Contents: Read and write for this repository.".into();
    }
    if lower.contains("could not resolve")
        || lower.contains("failed to connect")
        || lower.contains("timed out")
        || lower.contains("network")
    {
        return "Can't reach GitHub from here. Commit still works; push when you're back online.".into();
    }
    if lower.contains("non-fast-forward") || lower.contains("updates were rejected") {
        return "GitHub has newer commits. Pull first.".into();
    }
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_auth_and_network_failures_to_plain_language() {
        assert!(map_remote_error("unexpected http 401 from github").contains("refused this token"));
        assert!(map_remote_error("Failed to connect to github.com").contains("Can't reach GitHub"));
        assert!(map_remote_error("non-fast-forward").contains("Pull first"));
        assert!(map_remote_error("Push failed: there is no TLS stream available; class=Ssl (16)").contains("missing Git HTTPS support"));
    }

    #[test]
    fn rejects_obviously_invalid_tokens() {
        assert!(store_token("").is_err());
        assert!(store_token("not-a-token").is_err());
        assert!(store_token("ghp_ has spaces").is_err());
    }
}
