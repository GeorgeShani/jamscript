//! Clerk OAuth device sign-in for the desktop workbench. Tokens and pending device
//! grants stay in the OS credential store; the webview never sees bearer tokens.
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const SERVICE: &str = "com.jamscript.desktop";
const ACCOUNT: &str = "clerk-oauth";
const PENDING_ACCOUNT: &str = "clerk-oauth-pending";
// Windows Credential Manager caps one generic credential at 2560 bytes.
const CREDENTIAL_CHUNK_BYTES: usize = 2000;
const MAX_CREDENTIAL_CHUNKS: usize = 32;
const SCOPES: &str = "openid profile email offline_access";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub signed_in: bool,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending: Option<DeviceBegin>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AuthProfile {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    #[serde(rename = "imageUrl")]
    pub image_url: Option<String>,
}

#[derive(Deserialize)]
struct ClerkUserInfo {
    user_id: Option<String>,
    sub: Option<String>,
    name: Option<String>,
    email: Option<String>,
    picture: Option<String>,
}

fn profile_from_user_info(info: ClerkUserInfo) -> Result<AuthProfile, String> {
    let id = info
        .user_id
        .or(info.sub)
        .filter(|id| !id.is_empty())
        .ok_or("Clerk did not identify the signed-in account")?;
    let name = info
        .name
        .filter(|name| !name.is_empty())
        .or_else(|| info.email.clone())
        .unwrap_or_else(|| "JamScript account".into());
    Ok(AuthProfile {
        id,
        name,
        email: info.email,
        image_url: info.picture.filter(|url| url.starts_with("https://")),
    })
}

pub fn profile() -> Result<AuthProfile, String> {
    let token = access_token()?;
    let url = format!("{}/oauth/userinfo", frontend_url()?);
    let response = auth_agent()
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/json")
        .call()
        .map_err(|error| auth_request_error("verify JamScript account", error))?;
    let info = response
        .into_json::<ClerkUserInfo>()
        .map_err(|error| format!("Invalid Clerk account response: {error}"))?;
    profile_from_user_info(info)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBegin {
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    #[serde(default)]
    pub account_selection_uri: String,
    pub interval: u64,
    pub expires_in: u64,
}

#[derive(Serialize)]
pub struct DevicePoll {
    pub status: String,
    #[serde(rename = "retryAfterMs", skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
}

impl DevicePoll {
    fn finished(status: &str) -> Self {
        Self {
            status: status.into(),
            retry_after_ms: None,
        }
    }

    fn pending(next_poll: u64, current: u64) -> Self {
        Self {
            status: "pending".into(),
            retry_after_ms: Some(next_poll.saturating_sub(current).max(1)),
        }
    }
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

#[derive(Serialize, Deserialize)]
struct StoredCredentialChunks {
    generation: String,
    count: usize,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StoredCredential {
    Chunks(StoredCredentialChunks),
    Legacy(Credentials),
}

fn parse_stored_credential(value: &str) -> Result<StoredCredential, String> {
    let stored: StoredCredential = serde_json::from_str(value)
        .map_err(|_| "Stored JamScript sign-in is invalid. Clear saved sign-in and try again")?;
    if let StoredCredential::Chunks(chunks) = &stored {
        if chunks.count == 0
            || chunks.count > MAX_CREDENTIAL_CHUNKS
            || uuid::Uuid::parse_str(&chunks.generation).is_err()
        {
            return Err(
                "Stored JamScript sign-in is invalid. Clear saved sign-in and try again".into(),
            );
        }
    }
    Ok(stored)
}

#[derive(Serialize, Deserialize)]
struct PendingDevice {
    code: String,
    token_endpoint: String,
    device: DeviceBegin,
    expires_at: u64,
    next_poll: u64,
    // Keep the seconds field for saved grants from older versions, but use
    // milliseconds so focus checks cannot poll just before Clerk's minimum interval.
    #[serde(default)]
    next_poll_ms: u64,
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

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, account).map_err(|e| e.to_string())
}

fn chunk_entry(account: &str, generation: &str, index: usize) -> Result<keyring::Entry, String> {
    entry(&format!("{account}-{generation}-{index}"))
}

fn remove_chunks(account: &str, chunks: &StoredCredentialChunks) -> Result<(), String> {
    for index in 0..chunks.count {
        match chunk_entry(account, &chunks.generation, index)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(format!("Could not clear JamScript credentials: {error}")),
        }
    }
    Ok(())
}

fn read_chunk_index(account: &str) -> Result<Option<StoredCredentialChunks>, String> {
    Ok(match read_stored_credential(account)? {
        Some(StoredCredential::Chunks(chunks)) => Some(chunks),
        _ => None,
    })
}

fn read_stored_credential(account: &str) -> Result<Option<StoredCredential>, String> {
    match entry(account)?.get_password() {
        Ok(value) => parse_stored_credential(&value).map(Some),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read JamScript credentials: {error}")),
    }
}

fn auth_agent() -> ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        ureq::AgentBuilder::new()
            .redirects(0)
            .timeout(Duration::from_secs(15))
            .build()
    }).clone()
}

fn auth_request_error(action: &str, error: ureq::Error) -> String {
    match error.kind() {
        ureq::ErrorKind::Dns | ureq::ErrorKind::ConnectionFailed
        | ureq::ErrorKind::Io | ureq::ErrorKind::ProxyConnect =>
            "ACCOUNT_NETWORK_UNAVAILABLE: Cannot reach the account service. Retry when connected.".into(),
        _ => match error {
            ureq::Error::Status(status, _) if status >= 500 =>
                "ACCOUNT_SERVICE_UNAVAILABLE: Account service is temporarily unavailable. Try again shortly.".into(),
            ureq::Error::Status(status, _) => format!("Could not {action} (HTTP {status}). Try signing in again."),
            other => format!("Could not {action}: {other}"),
        }
    }
}

fn pending_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, PENDING_ACCOUNT).map_err(|e| e.to_string())
}

fn load_pending() -> Result<Option<PendingDevice>, String> {
    match pending_entry()?.get_password() {
        Ok(value) => serde_json::from_str(&value)
            .map(Some)
            .map_err(|_| "Stored JamScript sign-in request is invalid. Start again".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read JamScript sign-in request: {error}")),
    }
}

fn store_pending(pending: &PendingDevice) -> Result<(), String> {
    pending_entry()?
        .set_password(&serde_json::to_string(pending).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Could not store JamScript sign-in request: {e}"))
}

fn clear_pending() -> Result<(), String> {
    *PENDING.lock().map_err(|e| e.to_string())? = None;
    match pending_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Could not clear JamScript sign-in request: {error}"
        )),
    }
}

fn restore_pending() -> Result<Option<DeviceBegin>, String> {
    let mut guard = PENDING.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = load_pending()?;
    }
    if guard
        .as_ref()
        .is_some_and(|pending| pending.expires_at <= now())
    {
        drop(guard);
        clear_pending()?;
        return Ok(None);
    }
    Ok(guard.as_ref().map(|pending| {
        let mut device = pending.device.clone();
        device.account_selection_uri = account_selection_url(&device.user_code);
        device.expires_in = pending.expires_at.saturating_sub(now());
        device.interval = pending.interval;
        device
    }))
}

fn load() -> Result<Option<Credentials>, String> {
    load_account(ACCOUNT)
}

fn load_account(account: &str) -> Result<Option<Credentials>, String> {
    let chunks = match read_stored_credential(account)? {
        None => return Ok(None),
        Some(StoredCredential::Legacy(credentials)) => return Ok(Some(credentials)),
        Some(StoredCredential::Chunks(chunks)) => chunks,
    };
    let mut data = Vec::new();
    for index in 0..chunks.count {
        let part = chunk_entry(account, &chunks.generation, index)?
            .get_secret()
            .map_err(|error| format!("Could not read JamScript credentials: {error}"))?;
        data.extend(part);
    }
    serde_json::from_slice(&data)
        .map(Some)
        .map_err(|_| "Stored JamScript sign-in is invalid. Sign out and try again".into())
}

fn clear_account(account: &str) -> Result<(), String> {
    // Malformed records must not prevent the user from resetting their sign-in.
    let chunks = read_chunk_index(account).ok().flatten();
    match entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            if let Some(chunks) = chunks {
                remove_chunks(account, &chunks)?;
            }
            Ok(())
        }
        Err(error) => Err(format!("Could not clear JamScript credentials: {error}")),
    }
}

fn store(credentials: &Credentials) -> Result<(), String> {
    store_account(ACCOUNT, credentials)
}

fn store_account(account: &str, credentials: &Credentials) -> Result<(), String> {
    let data = serde_json::to_vec(credentials).map_err(|e| e.to_string())?;
    let old = read_chunk_index(account)?;
    let chunks = StoredCredentialChunks {
        generation: uuid::Uuid::new_v4().simple().to_string(),
        count: data.len().div_ceil(CREDENTIAL_CHUNK_BYTES),
    };
    if chunks.count == 0 || chunks.count > MAX_CREDENTIAL_CHUNKS {
        return Err("JamScript session is too large to store securely".into());
    }
    let result = (|| {
        for (index, part) in data.chunks(CREDENTIAL_CHUNK_BYTES).enumerate() {
            chunk_entry(account, &chunks.generation, index)?
                .set_secret(part)
                .map_err(|error| format!("Could not store JamScript credentials: {error}"))?;
        }
        entry(account)?
            .set_password(&serde_json::to_string(&chunks).map_err(|e| e.to_string())?)
            .map_err(|error| format!("Could not store JamScript credentials: {error}"))
    })();
    if result.is_err() {
        let _ = remove_chunks(account, &chunks);
    } else if let Some(old) = old {
        let _ = remove_chunks(account, &old);
    }
    result?;
    // Never report a completed sign-in if a newly opened entry cannot read it.
    let saved = load_account(account)?.ok_or("JamScript could not persist the desktop session")?;
    if saved.access_token != credentials.access_token
        || saved.refresh_token != credentials.refresh_token
    {
        return Err("JamScript could not verify the saved desktop session".into());
    }
    Ok(())
}

pub fn sign_out() -> Result<AuthStatus, String> {
    clear_pending()?;
    let warning = load().ok().flatten().and_then(|credentials| {
        let result = (|| {
            let id = client_id().ok_or("Desktop OAuth client is not configured")?;
            let endpoint = metadata()?
                .revocation_endpoint
                .ok_or("Clerk did not advertise token revocation")?;
            auth_agent()
                .post(&endpoint)
                .send_form(&[
                    ("client_id", id.as_str()),
                    ("token", credentials.refresh_token.as_str()),
                ])
                .map_err(|e| format!("Could not revoke Clerk credentials: {e}"))?;
            Ok::<(), String>(())
        })();
        result.err()
    });
    clear_account(ACCOUNT)?;
    let mut result = status()?;
    result.warning = warning;
    Ok(result)
}

pub fn status() -> Result<AuthStatus, String> {
    let (signed_in, warning) = match load() {
        Ok(credentials) => (credentials.is_some(), None),
        Err(error) => (false, Some(error)),
    };
    Ok(AuthStatus {
        signed_in,
        available: client_id().is_some() && frontend_url().is_ok(),
        pending: restore_pending()?,
        warning,
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
    auth_agent()
        .get(&format!("{origin}/.well-known/oauth-authorization-server"))
        .call()
        .map_err(|e| auth_request_error("discover Clerk OAuth endpoints", e))?
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
    let response = auth_agent()
        .post(&endpoint)
        .send_form(&[("client_id", id.as_str()), ("scope", SCOPES)])
        .map_err(|e| auth_request_error("start JamScript sign-in", e))?
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
    let device = DeviceBegin {
        account_selection_uri: account_selection_url(&response.user_code),
        user_code: response.user_code,
        verification_uri: response.verification_uri,
        verification_uri_complete: response.verification_uri_complete,
        interval,
        expires_in: response.expires_in,
    };
    let pending = PendingDevice {
        code: response.device_code,
        token_endpoint: metadata.token_endpoint,
        device: device.clone(),
        expires_at: now() + response.expires_in,
        next_poll: now() + interval,
        next_poll_ms: now_ms() + interval * 1000,
        interval,
    };
    // Persist the grant before showing its code, so a desktop:dev rebuild can resume it.
    store_pending(&pending)?;
    *PENDING.lock().map_err(|e| e.to_string())? = Some(pending);
    Ok(device)
}

fn account_selection_url(user_code: &str) -> String {
    let origin = api_origin().unwrap_or_else(|_| "https://jamscript.lukavacheishvili.workers.dev".into());
    ureq::get(&format!("{origin}/desktop/connect"))
        .query("user_code", user_code).url().to_owned()
}

pub fn open_verification() -> Result<(), String> {
    restore_pending()?;
    let guard = PENDING.lock().map_err(|e| e.to_string())?;
    let device = &guard
        .as_ref()
        .ok_or("Start JamScript sign-in first")?
        .device;
    let link = account_selection_url(&device.user_code);
    drop(guard);
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

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn poll() -> Result<DevicePoll, String> {
    let id = client_id().ok_or("Desktop sign-in is not configured")?;
    if restore_pending()?.is_none() {
        return Ok(DevicePoll::finished("expired"));
    }
    let mut guard = PENDING.lock().map_err(|e| e.to_string())?;
    let pending = guard.as_mut().ok_or("Start JamScript sign-in first")?;
    if now() >= pending.expires_at {
        drop(guard);
        clear_pending()?;
        return Ok(DevicePoll::finished("expired"));
    }
    let next_poll_ms = if pending.next_poll_ms == 0 {
        pending.next_poll * 1000
    } else {
        pending.next_poll_ms
    };
    if now_ms() < next_poll_ms {
        return Ok(DevicePoll::pending(next_poll_ms, now_ms()));
    }
    let endpoint = pending.token_endpoint.clone();
    let code = pending.code.clone();
    let interval = pending.interval;
    pending.next_poll = now() + interval;
    pending.next_poll_ms = now_ms() + interval * 1000;
    store_pending(pending)?;
    drop(guard);
    let response = auth_agent().post(&endpoint).send_form(&[
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
        clear_pending()?;
        return Ok(DevicePoll::finished("complete"));
    }
    match body.error.as_deref() {
        Some("authorization_pending") => {
            Ok(DevicePoll::pending(now_ms() + interval * 1000, now_ms()))
        }
        Some("slow_down") => {
            let mut guard = PENDING.lock().map_err(|e| e.to_string())?;
            if let Some(pending) = guard.as_mut() {
                pending.interval = body.interval.unwrap_or(interval + 5).max(interval + 5);
                pending.next_poll = now() + pending.interval;
                pending.next_poll_ms = now_ms() + pending.interval * 1000;
                store_pending(pending)?;
            }
            let next = guard.as_ref().map_or(now_ms() + (interval + 5) * 1000, |p| p.next_poll_ms);
            Ok(DevicePoll::pending(next, now_ms()))
        }
        Some("access_denied") | Some("expired_token") => {
            clear_pending()?;
            Ok(DevicePoll::finished("expired"))
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
        let response = auth_agent().post(&endpoint).send_form(&[
            ("client_id", id.as_str()),
            ("grant_type", "refresh_token"),
            ("refresh_token", credentials.refresh_token.as_str()),
        ]);
        let body = match response {
            Ok(response) => response,
            Err(ureq::Error::Status(_, response)) => response,
            Err(error) => return Err(auth_request_error("refresh JamScript sign-in", error)),
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
    let agent = auth_agent();
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
    #[test]
    fn polling_returns_the_remaining_wait_instead_of_another_full_interval() {
        assert_eq!(super::DevicePoll::pending(105000, 104000).retry_after_ms, Some(1000));
        assert_eq!(super::DevicePoll::pending(115000, 100000).retry_after_ms, Some(15000));
        assert_eq!(super::DevicePoll::pending(105500, 105100).retry_after_ms, Some(400));
        assert_eq!(super::DevicePoll::finished("complete").retry_after_ms, None);
    }
    #[test]
    fn consecutive_api_calls_reuse_the_http_connection() {
        use std::io::{BufRead, BufReader, Write};
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/probe", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            let mut requests = 0;
            let mut connections = 0;
            while requests < 2 {
                let (stream, _) = listener.accept().unwrap();
                stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
                connections += 1;
                let mut reader = BufReader::new(stream);
                while requests < 2 {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap_or(0) == 0 { break; }
                    loop {
                        line.clear();
                        reader.read_line(&mut line).unwrap();
                        if line == "\r\n" { break; }
                    }
                    reader.get_mut().write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\nok").unwrap();
                    requests += 1;
                }
            }
            connections
        });
        for _ in 0..2 {
            assert_eq!(super::auth_agent().get(&url).call().unwrap().into_string().unwrap(), "ok");
        }
        assert_eq!(server.join().unwrap(), 1, "API requests opened separate TCP connections");
    }

    #[test]
    fn network_errors_are_not_reported_as_lost_credentials() {
        let error: ureq::Error =
            std::io::Error::new(std::io::ErrorKind::TimedOut, "connection timed out").into();
        let message = super::auth_request_error("verify account", error);
        assert!(message.starts_with("ACCOUNT_NETWORK_UNAVAILABLE"));
        let response = ureq::Response::new(503, "Service Unavailable", "").unwrap();
        assert!(super::auth_request_error("verify account", response.into())
            .starts_with("ACCOUNT_SERVICE_UNAVAILABLE"));
        let response = ureq::Response::new(401, "Unauthorized", "").unwrap();
        assert!(
            !super::auth_request_error("verify account", response.into()).contains("UNAVAILABLE")
        );
    }

    #[test]
    #[ignore = "Opt-in native DNS/TLS check against the configured public Clerk metadata endpoint"]
    fn configured_clerk_network_is_reachable() {
        let origin = super::frontend_url().unwrap();
        let response = super::auth_agent()
            .get(&format!("{origin}/.well-known/oauth-authorization-server"))
            .call()
            .expect("Native Clerk DNS/TLS connection failed");
        assert_eq!(response.status(), 200);
    }

    use super::{
        allowed_api_path, profile_from_user_info, ClerkUserInfo, DeviceBegin, PendingDevice,
    };

    #[test]
    fn native_bridge_only_reaches_collaboration_routes() {
        assert!(allowed_api_path("/api/shared-projects?documentId=abc"));
        assert!(allowed_api_path("/api/collaboration/auth"));
        assert!(!allowed_api_path("https://another-host.example/"));
        assert!(!allowed_api_path("/api/agent-chat"));
        assert!(!allowed_api_path("/api/shared-projects/../other"));
    }

    #[test]
    fn clerk_user_info_identifies_desktop_account() {
        let person = profile_from_user_info(ClerkUserInfo {
            user_id: Some("user_123".into()),
            sub: None,
            name: None,
            email: Some("player@example.com".into()),
            picture: Some("https://img.clerk.com/avatar.png".into()),
        })
        .unwrap();
        assert_eq!(person.id, "user_123");
        assert_eq!(person.image_url.as_deref(), Some("https://img.clerk.com/avatar.png"));
        assert_eq!(person.name, "player@example.com");
        assert!(profile_from_user_info(ClerkUserInfo {
            user_id: None,
            sub: None,
            name: None,
            email: None,
            picture: None,
        })
        .is_err());
    }

    #[test]
    fn pending_device_grant_can_be_restored_after_restart() {
        let pending = PendingDevice {
            code: "private-code".into(),
            token_endpoint: "https://clerk.example/oauth/token".into(),
            device: DeviceBegin {
                account_selection_uri: String::new(),
                user_code: "PUBLIC-CODE".into(),
                verification_uri: "https://clerk.example/device".into(),
                verification_uri_complete: None,
                interval: 5,
                expires_in: 600,
            },
            expires_at: 123456,
            next_poll: 123400,
            next_poll_ms: 0,
            interval: 5,
        };
        let restored: PendingDevice =
            serde_json::from_str(&serde_json::to_string(&pending).unwrap()).unwrap();
        assert_eq!(restored.code, "private-code");
        assert_eq!(restored.device.user_code, "PUBLIC-CODE");
        assert_eq!(restored.expires_at, 123456);
    }

    #[test]
    fn account_selection_stays_on_the_public_site_and_keeps_the_code_in_one_parameter() {
        let url = super::account_selection_url("TEST-CODE&redirect_url=https://untrusted.example");
        assert!(url.contains("/desktop/connect?user_code="));
        assert!(url.contains("%26redirect_url%3D"));
        assert!(!url.contains("&redirect_url="));
        assert!(!url.contains("device_code="));
    }

    #[test]
    fn older_pending_device_requests_do_not_require_the_new_selection_link() {
        let device: DeviceBegin = serde_json::from_str(r#"{"userCode":"TEST-CODE","verificationUri":"https://clerk.example/device","verificationUriComplete":null,"interval":5,"expiresIn":600}"#).unwrap();
        assert!(device.account_selection_uri.is_empty());
        assert_eq!(device.user_code, "TEST-CODE");
    }

    #[test]
    fn earlier_saved_sessions_remain_readable() {
        let stored = super::parse_stored_credential(
            r#"{"access_token":"old-access","refresh_token":"old-refresh","expires_at":123456}"#,
        )
        .unwrap();
        let super::StoredCredential::Legacy(credentials) = stored else {
            panic!("Expected the earlier desktop credential format");
        };
        assert_eq!(credentials.access_token, "old-access");
        assert_eq!(credentials.refresh_token, "old-refresh");
        assert!(super::parse_stored_credential(r#"{"generation":"invalid","count":1}"#).is_err());
        assert!(super::parse_stored_credential("broken record").is_err());
    }

    #[test]
    #[ignore = "Requires an unlocked native OS credential store"]
    fn native_session_survives_restart() {
        const TEST_ACCOUNT_ENV: &str = "JAMSCRIPT_TEST_CREDENTIAL_ACCOUNT";
        if let Ok(account) = std::env::var(TEST_ACCOUNT_ENV) {
            let saved = super::load_account(&account).unwrap().unwrap();
            assert_eq!(saved.access_token, "test-access".repeat(400));
            assert_eq!(saved.refresh_token, "test-refresh".repeat(100));
            return;
        }
        let account = format!("test-{}", uuid::Uuid::new_v4().simple());
        super::entry(&account).unwrap().set_password(
            r#"{"access_token":"old-access","refresh_token":"old-refresh","expires_at":123456}"#,
        ).unwrap();
        assert_eq!(
            super::load_account(&account).unwrap().unwrap().access_token,
            "old-access"
        );
        super::store_account(
            &account,
            &super::Credentials {
                access_token: "test-access".repeat(400),
                refresh_token: "test-refresh".repeat(100),
                expires_at: 123456,
            },
        )
        .unwrap();
        // A second process catches keyring's silent fallback to its per-entry mock.
        let result = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "desktop_auth::tests::native_session_survives_restart",
                "--ignored",
            ])
            .env(TEST_ACCOUNT_ENV, &account)
            .status();
        super::clear_account(&account).unwrap();
        assert!(super::load_account(&account).unwrap().is_none());
        super::entry(&account)
            .unwrap()
            .set_password("broken record")
            .unwrap();
        assert!(super::load_account(&account).is_err());
        super::clear_account(&account).unwrap();
        assert!(super::load_account(&account).unwrap().is_none());
        assert!(result.unwrap().success());
    }
}
