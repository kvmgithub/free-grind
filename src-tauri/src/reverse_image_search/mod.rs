//! Reverse image search in an in-app window, for engines that only take an
//! upload (PimEyes has no search-by-URL link). The frontend hands over the
//! photo's bytes; an init script turns them into a `File` and feeds it to the
//! page's upload input, the way the sign-in windows (`facebook_oauth`,
//! `google_oauth`) drive their pages.
//!
//! On Android the window lives in its own Activity
//! (`ReverseImageSearchActivity`, isolated WebView profile); on iOS it is a
//! full-screen WKWebView over the app, closed through an injected button.

#[cfg(target_os = "android")]
mod android;

use serde::Deserialize;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use crate::error::AppError;

const WINDOW_LABEL: &str = "reverse-image-search";

#[cfg(desktop)]
const WINDOW_INNER_SIZE: (f64, f64) = (1000.0, 760.0);
#[cfg(target_os = "android")]
const WINDOW_INNER_SIZE: (f64, f64) = (500.0, 720.0);

/// Path the close button navigates to (mobile only); never actually loads.
const CLOSE_PATH: &str = "/__free_grind_close__";

/// A profile photo is a few hundred KB; anything far beyond is not one.
const MAX_IMAGE_BYTES: usize = 15 * 1024 * 1024;

const UPLOAD_INIT: &str = include_str!("upload_init.js");

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UploadEngine {
    Pimeyes,
}

impl UploadEngine {
    fn start_url(self) -> &'static str {
        match self {
            Self::Pimeyes => "https://pimeyes.com/en",
        }
    }

    fn host(self) -> &'static str {
        match self {
            Self::Pimeyes => "pimeyes.com",
        }
    }

    fn title(self) -> &'static str {
        match self {
            Self::Pimeyes => "PimEyes",
        }
    }
}

fn init_script(engine: UploadEngine, image_base64: &str, mime_type: &str, nonce: &str) -> String {
    let config = serde_json::json!({
        "image": image_base64,
        "mimeType": mime_type,
        "fileName": format!("photo.{}", extension_for(mime_type)),
        "host": engine.host(),
        "nonce": nonce,
        "closeButton": cfg!(mobile),
        "closeUrl": format!("https://{}{}", engine.host(), CLOSE_PATH),
    });
    format!("({UPLOAD_INIT})({config});")
}

fn extension_for(mime_type: &str) -> &'static str {
    match mime_type {
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "jpg",
    }
}

fn is_image_mime(mime_type: &str) -> bool {
    mime_type.starts_with("image/") && !mime_type.contains(['"', '\\', '\n'])
}

/// Only web pages; `file:`/`javascript:` and app schemes never load here.
fn is_allowed_target(url: &Url) -> bool {
    matches!(url.scheme(), "https" | "http" | "about" | "blob" | "data")
}

fn is_close_url(url: &Url, engine: UploadEngine) -> bool {
    url.host_str() == Some(engine.host()) && url.path() == CLOSE_PATH
}

/// Opens `engine` in its own window and uploads the given photo there.
#[tauri::command]
pub async fn open_upload_image_search(
    app: AppHandle,
    engine: UploadEngine,
    image_base64: String,
    mime_type: String,
) -> Result<(), AppError> {
    use base64::Engine as _;

    let mime_type = mime_type.split(';').next().unwrap_or_default().trim().to_owned();
    if !is_image_mime(&mime_type) {
        return Err(AppError::Http(format!("not an image: {mime_type}")));
    }
    let decoded_len = base64::engine::general_purpose::STANDARD
        .decode(image_base64.as_bytes())
        .map_err(|e| AppError::Http(format!("invalid image data: {e}")))?
        .len();
    if decoded_len == 0 || decoded_len > MAX_IMAGE_BYTES {
        return Err(AppError::Http(format!("unexpected image size: {decoded_len} bytes")));
    }

    dismiss_window(&app).await;

    let url = Url::parse(engine.start_url())
        .map_err(|e| AppError::Http(format!("invalid search URL: {e}")))?;
    let nonce = crate::api::oauth::new_nonce();
    let app_for_nav = app.clone();

    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(&app, WINDOW_LABEL, WebviewUrl::External(url))
        .title(engine.title())
        .initialization_script(init_script(engine, &image_base64, &mime_type, &nonce))
        .incognito(true)
        .general_autofill_enabled(false)
        .on_navigation(move |url| {
            if is_close_url(url, engine) {
                let app = app_for_nav.clone();
                tauri::async_runtime::spawn(async move { dismiss_window(&app).await });
                return false;
            }
            is_allowed_target(url)
        });

    #[cfg(not(target_os = "ios"))]
    {
        let (width, height) = WINDOW_INNER_SIZE;
        builder = builder.inner_size(width, height);
    }

    // See facebook_oauth/web.rs: tao matches the parent by the launching
    // Activity's name, which may be a disguise alias.
    #[cfg(target_os = "android")]
    {
        builder = builder.activity_name("ReverseImageSearchActivity");
        if let Some(parent) = app
            .get_webview_window("main")
            .and_then(|main| main.activity_name().ok())
        {
            builder = builder.created_by_activity_name(parent);
        }
    }

    // Swept at next launch together with the sign-in profiles.
    #[cfg(target_os = "windows")]
    {
        builder = builder.data_directory(crate::api::oauth::data_dir(&app, &nonce)?);
    }

    builder
        .build()
        .map_err(|e| AppError::Http(format!("failed to open image search window: {e}")))?;
    Ok(())
}

async fn dismiss_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.clear_all_browsing_data();
        let _ = window.close();
    }
    #[cfg(target_os = "android")]
    android::dismiss(app).await;
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("reverse-image-search")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin(
                    "dev.estopia.free_grind",
                    "ReverseImageSearchPlugin",
                )?;
                _app.manage(android::AndroidReverseImageSearch { handle });
            }
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_web_pages_load() {
        for url in ["https://pimeyes.com/en", "about:blank", "blob:https://pimeyes.com/x"] {
            assert!(is_allowed_target(&Url::parse(url).unwrap()), "{url}");
        }
        for url in ["file:///etc/passwd", "javascript:alert(1)", "tauri://localhost/"] {
            assert!(!is_allowed_target(&Url::parse(url).unwrap()), "{url}");
        }
    }

    #[test]
    fn close_url_is_engine_host_only() {
        let engine = UploadEngine::Pimeyes;
        assert!(is_close_url(&Url::parse("https://pimeyes.com/__free_grind_close__").unwrap(), engine));
        assert!(!is_close_url(&Url::parse("https://evil.example/__free_grind_close__").unwrap(), engine));
        assert!(!is_close_url(&Url::parse("https://pimeyes.com/en").unwrap(), engine));
    }

    #[test]
    fn init_script_carries_the_photo() {
        let script = init_script(UploadEngine::Pimeyes, "QUJD", "image/png", "n0nce");
        assert!(script.contains("\"image\":\"QUJD\""));
        assert!(script.contains("\"fileName\":\"photo.png\""));
        assert!(UPLOAD_INIT.contains("input[type=file]"));
    }

    #[test]
    fn rejects_non_image_mime_types() {
        assert!(is_image_mime("image/jpeg"));
        assert!(!is_image_mime("text/html"));
        assert!(!is_image_mime("image/\"x"));
    }
}
