use tauri::plugin::PluginHandle;
use tauri::{AppHandle, Manager, Wry};

pub struct AndroidReverseImageSearch {
    pub handle: PluginHandle<Wry>,
}

/// Closing the webview window does not finish the Activity hosting it.
pub async fn dismiss(app: &AppHandle) {
    let handle = app.state::<AndroidReverseImageSearch>().handle.clone();
    if let Err(e) = handle
        .run_mobile_plugin_async::<serde_json::Value>("dismiss", ())
        .await
    {
        eprintln!("[reverse-image-search] plugin command dismiss failed: {e}");
    }
}
