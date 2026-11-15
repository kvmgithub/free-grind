//! Stand-in for `fingerprint.rs` in the server flavor: there is no imitated
//! fingerprint to check (the client identifies honestly, grindr's
//! `own-identity`). Same command name, so lib.rs keeps one handler list.

use crate::error::AppError;
use serde_json::Value;

#[tauri::command]
pub async fn check_fingerprint() -> Result<Value, AppError> {
    Err(AppError::Http("not available in this app".to_owned()))
}
