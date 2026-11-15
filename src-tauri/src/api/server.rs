//! The backend this app talks to, fixed by the app flavor at build time: the
//! official Grindr servers (the default) or the Free Grind server (cargo
//! feature `flavor-server`, addresses from FG_API_URL / FG_MEDIA_URL, see
//! grindr's server.rs). Applied to the `grindr` crate's
//! [`grindr::set_server_config`] before the first client is built.
//!
//! Builds from before the flavor split let the user pick the server on the
//! sign-in screen and remembered the choice per saved account. Those records
//! are still read: an account, or a stored active session, that belongs to the
//! other backend is not this app's, and is never sent to this app's server.

use serde::{Deserialize, Serialize};

use super::auth::{clear_slot, get_slot_bytes, set_slot_bytes, AuthStorage, DeviceStorage};
use crate::error::AppError;

#[cfg(feature = "flavor-server")]
const _: () = assert!(
    option_env!("FG_API_URL").is_some() && option_env!("FG_MEDIA_URL").is_some(),
    "the server flavor needs FG_API_URL and FG_MEDIA_URL at build time (server/app-flavor/flavor.json)",
);

/// This app's backend.
pub fn flavor_server() -> grindr::ServerConfig {
    if cfg!(feature = "flavor-server") {
        grindr::ServerConfig::FreeGrind
    } else {
        grindr::ServerConfig::Official
    }
}

const ACTIVE_SERVER_SLOT: &str = "server-config";

fn account_server_slot(profile_id: &str) -> String {
    format!("server-{profile_id}")
}

pub struct ServerStorage;

impl ServerStorage {
    fn decode(bytes: &[u8]) -> Option<grindr::ServerConfig> {
        serde_json::from_slice::<grindr::ServerConfig>(bytes).ok()
    }

    /// The backend a saved account belongs to. Accounts saved before server
    /// selection existed are official ones.
    pub fn load_for_account(profile_id: &str) -> grindr::ServerConfig {
        get_slot_bytes(&account_server_slot(profile_id))
            .ok()
            .flatten()
            .and_then(|b| Self::decode(&b))
            .unwrap_or_default()
    }

    /// Whether a saved account lives on this app's backend.
    pub fn belongs_here(profile_id: &str) -> bool {
        Self::load_for_account(profile_id) == flavor_server()
    }

    pub fn save_for_account(profile_id: &str, config: &grindr::ServerConfig) -> Result<(), AppError> {
        let bytes = serde_json::to_vec(config).map_err(|e| AppError::Auth(e.to_string()))?;
        set_slot_bytes(&account_server_slot(profile_id), &bytes)
    }

    pub fn forget_account(profile_id: &str) {
        let _ = clear_slot(&account_server_slot(profile_id));
    }
}

/// Sets this app's backend before the first client is built (startup).
///
/// A build with the old server picker may have left the other backend active,
/// with its session. That session is dropped here together with the device
/// identity, so neither reaches this server (the two servers must not be able
/// to correlate the device). The account itself stays saved, just hidden from
/// the switcher.
pub fn apply_flavor_server() {
    let server = flavor_server();
    let previous = get_slot_bytes(ACTIVE_SERVER_SLOT)
        .ok()
        .flatten()
        .and_then(|b| ServerStorage::decode(&b))
        .unwrap_or_default();
    if previous != server {
        if AuthStorage::get_session().ok().flatten().is_some() {
            eprintln!("[server] dropping the stored session of the other backend");
            let _ = AuthStorage::clear_session();
        }
        let _ = DeviceStorage::save(&grindr::DeviceInfo::generate());
        if let Ok(bytes) = serde_json::to_vec(&server) {
            let _ = set_slot_bytes(ACTIVE_SERVER_SLOT, &bytes);
        }
    }
    grindr::set_server_config(server);
}

/// Firebase client config of the Free Grind server's own project (push on
/// Android), compiled in like the server addresses: FG_FCM_PROJECT_ID,
/// FG_FCM_APP_ID, FG_FCM_API_KEY, FG_FCM_SENDER_ID. All public values from
/// google-services.json; the server keeps the service account to send.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FcmClientConfig {
    pub project_id: String,
    pub application_id: String,
    pub api_key: String,
    pub sender_id: String,
}

fn build_env(value: Option<&'static str>) -> Option<String> {
    value.map(str::trim).filter(|v| !v.is_empty()).map(str::to_owned)
}

/// `None` unless this is the server flavor and the build set all four
/// FG_FCM_* variables.
pub fn free_grind_fcm() -> Option<FcmClientConfig> {
    if !cfg!(feature = "flavor-server") {
        return None;
    }
    Some(FcmClientConfig {
        project_id: build_env(option_env!("FG_FCM_PROJECT_ID"))?,
        application_id: build_env(option_env!("FG_FCM_APP_ID"))?,
        api_key: build_env(option_env!("FG_FCM_API_KEY"))?,
        sender_id: build_env(option_env!("FG_FCM_SENDER_ID"))?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub api_base: String,
    pub media_base: Option<String>,
    /// Push config of the Free Grind server (server flavor only).
    pub fcm: Option<FcmClientConfig>,
}

#[tauri::command]
pub async fn get_server_config() -> Result<ServerInfo, AppError> {
    let config = grindr::server_config();
    Ok(ServerInfo {
        api_base: config.api_base().to_owned(),
        media_base: config.media_base().map(str::to_owned),
        fcm: free_grind_fcm(),
    })
}
