//! Stand-in for `entitlements.rs` (the Honduras entitlement bypass) in the
//! server flavor, which ships without Grindr workarounds. Same command names,
//! so the handler lists in lib.rs stay one list; the frontend of that flavor
//! never calls them (it builds with src/grindr-workarounds/stub.ts).

use crate::error::AppError;

fn unavailable() -> AppError {
    AppError::Http("not available in this app".to_owned())
}

#[tauri::command]
pub async fn enter_honduras() -> Result<(), AppError> {
    Err(unavailable())
}

#[tauri::command]
pub async fn leave_honduras() -> Result<(), AppError> {
    Err(unavailable())
}

#[tauri::command]
pub async fn restore_stranded_location() -> Result<(), AppError> {
    Err(unavailable())
}
