//! Clerk OAuth device sign-in for the desktop workbench. Only the refresh/access
//! token pair is persisted, in the OS credential store; the webview never sees it.
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const SERVICE: &str = "com.jamscript.desktop";
const ACCOUNT: &str = "clerk-oauth";
const SCOPES: &str = "openid profile email offline_access";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub signed_in: bool,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBegin {
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    pub interval: u64,
    pub expires_in: u64,
}

#[derive(Serialize)]
pub struct DevicePoll {
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResult {
    pub status: u16,
    pub body: String,
}

#[derive(Serialize, Deserialize)]
struct Credentials {
    access_token: String,
    refresh_token: String,
    expires_at: u64,
}

struct PendingDevice {
    code: String,
    token_endpoint: String,
    verification_uri: String,
    expires_at: Instant,
    next_poll: Instant,
    interval: u64,
}

static PENDING: Mutex<Option<PendingDevice>> = Mutex::new(None);
static REFRESH: Mutex<()> = Mutex::new(());

fn configured(name: &str, built: Option<&'static str>) -> Option<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            built
                .map(str::to_owned)
                .filter(|value| !value.trim().is_empty())
        })
}

fn client_id() -> Option<String> {
    configured(
        "JAMSCRIPT_CLERK_OAUTH_CLIENT_ID",
        option_env!("JAMSCRIPT_CLERK_OAUTH_CLIENT_ID"),
    )
}

fn frontend_url() -> Result<String, String> {
    let url = configured(
        "JAMSCRIPT_CLERK_FRONTEND_API_URL",
        option_env!("JAMSCRIPT_CLERK_FRONTEND_API_URL"),
    )
    .ok_or("Set JAMSCRIPT_CLERK_FRONTEND_API_URL for desktop sign-in")?;
    if !url.starts_with("https://") || url.contains(['?', '#']) {
        return Err("Clerk frontend API must be an HTTPS origin".into());
    }
    Ok(url.trim_end_matches('/').to_owned())
}

fn api_origin() -> Result<String, String> {
    let origin = configured(
        "JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN",
        option_env!("JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN"),
    )
    .ok_or("Set JAMSCRIPT_DESKTOP_PUBLIC_API_ORIGIN for collaboration")?;
    let local = origin.starts_with("http://127.0.0.1:") || origin.starts_with("http://localhost:");
    if !(origin.starts_with("https://") || local) || origin.contains(['?', '#']) {
        return Err("Collaboration API must use HTTPS (or local development loopback)".into());
    }
    Ok(origin.trim_end_matches('/').to_owned())
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

fn load() -> Result<Option<Credentials>, String> {
    match entry()?.get_password() {
        Ok(value) => serde_json::from_str(&value)
            .map(Some)
            .map_err(|_| "Stored JamScript sign-in is invalid. Sign out and try again".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read JamScript credentials: {error}")),
    }
}

fn store(credentials: &Credentials) -> Result<(), String> {
    entry()?
        .set_password(&serde_json::to_string(credentials).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Could not store JamScript credentials: {e}"))
}

pub fn sign_out() -> Result<AuthStatus, String> {
    *PENDING.lock().map_err(|e| e.to_string())? = None;
    let warning = load()?.and_then(|credentials| {
        let result = (|| {
            let id = client_id().ok_or("Desktop OAuth client is not configured")?;
            let endpoint = metadata()?
                .revocation_endpoint
                .ok_or("Clerk did not advertise token revocation")?;
            ureq::post(&endpoint)
                .send_form(&[
                    ("client_id", id.as_str()),
                    ("token", credentials.refresh_token.as_str()),
                ])
                .map_err(|e| format!("Could not revoke Clerk credentials: {e}"))?;
            Ok::<(), String>(())
        })();
        result.err()
    });
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            let mut result = status()?;
            result.warning = warning;
            Ok(result)
        }
        Err(error) => Err(format!("Could not clear JamScript credentials: {error}")),
    }
}

pub fn status() -> Result<AuthStatus, String> {
    Ok(AuthStatus {
        signed_in: load()?.is_some(),
        available: client_id().is_some() && frontend_url().is_ok() && api_origin().is_ok(),
        warning: None,
    })
}

#[derive(Deserialize)]
struct Metadata {
    device_authorization_endpoint: Option<String>,
    token_endpoint: String,
    revocation_endpoint: Option<String>,
}

#[derive(Deserialize)]
struct DeviceResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: u64,
}

fn metadata() -> Result<Metadata, String> {
    let origin = frontend_url()?;
    ureq::get(&format!("{origin}/.well-known/oauth-authorization-server"))
        .call()
        .map_err(|e| format!("Could not discover Clerk OAuth endpoints: {e}"))?
        .into_json::<Metadata>()
        .map_err(|e| format!("Invalid Clerk OAuth metadata: {e}"))
        .and_then(|metadata| {
            // Keep credential-bearing calls on the configured Clerk origin.
            if !metadata.token_endpoint.starts_with(&format!("{origin}/"))
                || metadata
                    .device_authorization_endpoint
                    .as_deref()
                    .is_some_and(|url| !url.starts_with(&format!("{origin}/")))
                || metadata
                    .revocation_endpoint
                    .as_deref()
                    .is_some_and(|url| !url.starts_with(&format!("{origin}/")))
            {
                Err("Clerk OAuth endpoints do not match the configured origin".into())
            } else {
                Ok(metadata)
            }
        })
}

pub fn begin() -> Result<DeviceBegin, String> {
    let id = client_id().ok_or("Set JAMSCRIPT_CLERK_OAUTH_CLIENT_ID for desktop sign-in")?;
    let metadata = metadata()?;
    let endpoint = metadata.device_authorization_endpoint.ok_or(
        "Clerk device authorization is unavailable. Enable it for the public OAuth application",
    )?;
    let response = ureq::post(&endpoint)
        .send_form(&[("client_id", id.as_str()), ("scope", SCOPES)])
        .map_err(|e| format!("Could not start JamScript sign-in: {e}"))?
        .into_json::<DeviceResponse>()
        .map_err(|e| format!("Invalid Clerk device response: {e}"))?;
    let interval = response.interval.max(1);
    if !response.verification_uri.starts_with("https://")
        || response
            .verification_uri_complete
            .as_deref()
            .is_some_and(|url| !url.starts_with("https://"))
    {
        return Err("Clerk returned an unsafe verification link".into());
    }
    let link = response
        .verification_uri_complete
        .as_deref()
        .unwrap_or(&response.verification_uri)
        .to_owned();
    *PENDING.lock().map_err(|e| e.to_string())? = Some(PendingDevice {
        code: response.device_code,
        token_endpoint: metadata.token_endpoint,
        verification_uri: link.clone(),
        expires_at: Instant::now() + Duration::from_secs(response.expires_in),
        next_poll: Instant::now() + Duration::from_secs(interval),
        interval,
    });
    let _ = open::that(&link);
    Ok(DeviceBegin {
        user_code: response.user_code,
        verification_uri: response.verification_uri,
        verification_uri_complete: response.verification_uri_complete,
        interval,
        expires_in: response.expires_in,
    })
}

pub fn open_verification() -> Result<(), String> {
    let link = PENDING
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .ok_or("Start JamScript sign-in first")?
        .verification_uri
        .clone();
    open::that(link).map_err(|e| format!("Could not open the system browser: {e}"))
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    error: Option<String>,
    interval: Option<u64>,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn poll() -> Result<DevicePoll, String> {
    let id = client_id().ok_or("Desktop sign-in is not configured")?;
    let mut guard = PENDING.lock().map_err(|e| e.to_string())?;
    let pending = guard.as_mut().ok_or("Start JamScript sign-in first")?;
    if Instant::now() >= pending.expires_at {
        *guard = None;
        return Ok(DevicePoll {
            status: "expired".into(),
        });
    }
    if Instant::now() < pending.next_poll {
        return Ok(DevicePoll {
            status: "pending".into(),
        });
    }
    let endpoint = pending.token_endpoint.clone();
    let code = pending.code.clone();
    let interval = pending.interval;
    pending.next_poll = Instant::now() + Duration::from_secs(interval);
    drop(guard);
    let response = ureq::post(&endpoint).send_form(&[
        ("client_id", id.as_str()),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ("device_code", code.as_str()),
    ]);
    let body = match response {
        Ok(response) => response,
        Err(ureq::Error::Status(_, response)) => response,
        Err(error) => return Err(format!("Could not check JamScript sign-in: {error}")),
    }
    .into_json::<TokenResponse>()
    .map_err(|e| format!("Invalid Clerk token response: {e}"))?;
    if let (Some(access_token), Some(refresh_token)) = (body.access_token, body.refresh_token) {
        store(&Credentials {
            access_token,
            refresh_token,
            expires_at: now() + body.expires_in.unwrap_or(3600),
        })?;
        *PENDING.lock().map_err(|e| e.to_string())? = None;
        return Ok(DevicePoll {
            status: "complete".into(),
        });
    }
    match body.error.as_deref() {
        Some("authorization_pending") => Ok(DevicePoll {
            status: "pending".into(),
        }),
        Some("slow_down") => {
            let mut guard = PENDING.lock().map_err(|e| e.to_string())?;
            if let Some(pending) = guard.as_mut() {
                pending.interval = body.interval.unwrap_or(interval + 5).max(interval + 5);
                pending.next_poll = Instant::now() + Duration::from_secs(pending.interval);
            }
            Ok(DevicePoll {
                status: "pending".into(),
            })
        }
        Some("access_denied") | Some("expired_token") => {
            *PENDING.lock().map_err(|e| e.to_string())? = None;
            Ok(DevicePoll {
                status: "expired".into(),
            })
        }
        Some(error) => Err(format!("Clerk refused sign-in ({error})")),
        None => Err("Clerk did not issue a desktop token".into()),
    }
}

fn access_token() -> Result<String, String> {
    let _guard = REFRESH.lock().map_err(|e| e.to_string())?;
    let mut credentials = load()?.ok_or("Sign in to JamScript to collaborate")?;
    if credentials.expires_at <= now() + 60 {
        let id = client_id().ok_or("Desktop sign-in is not configured")?;
        let endpoint = metadata()?.token_endpoint;
        let response = ureq::post(&endpoint).send_form(&[
            ("client_id", id.as_str()),
            ("grant_type", "refresh_token"),
            ("refresh_token", credentials.refresh_token.as_str()),
        ]);
        let body = match response {
            Ok(response) => response,
            Err(ureq::Error::Status(_, response)) => response,
            Err(error) => return Err(format!("Could not refresh JamScript sign-in: {error}")),
        }
        .into_json::<TokenResponse>()
        .map_err(|e| format!("Invalid Clerk refresh response: {e}"))?;
        credentials.access_token = body.access_token.ok_or_else(|| {
            format!(
                "JamScript sign-in expired ({})",
                body.error.unwrap_or_default()
            )
        })?;
        if let Some(refresh_token) = body.refresh_token {
            credentials.refresh_token = refresh_token;
        }
        credentials.expires_at = now() + body.expires_in.unwrap_or(3600);
        store(&credentials)?;
    }
    Ok(credentials.access_token)
}

fn allowed_api_path(path: &str) -> bool {
    let allowed = path == "/api/shared-projects"
        || path.starts_with("/api/shared-projects?")
        || path == "/api/collaboration/auth"
        || path == "/api/desktop-session";
    allowed && !path.contains('#') && !path.contains("..")
}

pub fn api_request(path: &str, method: &str, body: Option<&str>) -> Result<ApiResult, String> {
    if !allowed_api_path(path) {
        return Err("This desktop API path is not permitted".into());
    }
    if method != "GET" && method != "POST" {
        return Err("This desktop API method is not permitted".into());
    }
    if body.is_some_and(|body| body.len() > 1_000_000) {
        return Err("Collaboration request is too large".into());
    }
    let token = access_token()?;
    let url = format!("{}{}", api_origin()?, path);
    let agent = ureq::AgentBuilder::new().redirects(0).build();
    let request = agent
        .request(method, &url)
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/json");
    let response = if method == "POST" {
        request
            .set("Content-Type", "application/json")
            .send_string(body.unwrap_or("{}"))
    } else {
        request.call()
    };
    let response = match response {
        Ok(response) => response,
        Err(ureq::Error::Status(_, response)) => response,
        Err(error) => return Err(format!("Collaboration service is unavailable: {error}")),
    };
    let status = response.status();
    let body = response.into_string().map_err(|e| e.to_string())?;
    Ok(ApiResult { status, body })
}

#[cfg(test)]
mod tests {
    use super::allowed_api_path;

    #[test]
    fn native_bridge_only_reaches_collaboration_routes() {
        assert!(allowed_api_path("/api/shared-projects?documentId=abc"));
        assert!(allowed_api_path("/api/collaboration/auth"));
        assert!(!allowed_api_path("https://another-host.example/"));
        assert!(!allowed_api_path("/api/agent-chat"));
        assert!(!allowed_api_path("/api/shared-projects/../other"));
    }
}
