//! Who the client says it is (patched in).
//!
//! By default it imitates the official Android app: its version
//! ([`crate::APP_VERSION`]), a real Android device profile and okhttp's
//! fingerprint. With the `own-identity` feature it identifies honestly
//! instead, in the same header format: the embedding app's own product name
//! and version (set with [`set_client_identity`]) and the real platform,
//! device and time zone
//! ([`honest_device`]). Values the platform doesn't expose are sent as
//! obvious placeholders, never invented.

use std::sync::OnceLock;

/// The official app's product token in the `User-Agent`.
pub(crate) const OFFICIAL_PRODUCT: &str = "grindr3";

static CLIENT_IDENTITY: OnceLock<(String, String, String)> = OnceLock::new();

/// What the `own-identity` client puts at the start of its `User-Agent`:
/// `<product>/<version>;<build>;…` (the API's format, e.g. `myapp1/1.2.0;45;…`).
/// Call once at startup, before the first client; later calls are ignored.
/// `product` is lowercase letters and digits (default: the official
/// `grindr3`), `version` dotted numbers (`1.2.0`), `build` digits. Without
/// `own-identity` the client always sends the official app's.
pub fn set_client_identity(product: &str, version: &str, build: &str) {
	let product = if !product.is_empty() && product.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()) {
		product
	} else {
		OFFICIAL_PRODUCT
	};
	let _ = CLIENT_IDENTITY.set((product.to_owned(), version.to_owned(), build.to_owned()));
}

/// Product token, version and build number for the `User-Agent`.
pub(crate) fn client_identity() -> (&'static str, &'static str, &'static str) {
	#[cfg(feature = "own-identity")]
	return CLIENT_IDENTITY
		.get()
		.map(|(p, v, b)| (p.as_str(), v.as_str(), b.as_str()))
		.unwrap_or((OFFICIAL_PRODUCT, "0.0.0", "0"));
	#[cfg(not(feature = "own-identity"))]
	(OFFICIAL_PRODUCT, crate::headers::APP_VERSION, crate::headers::BUILD_NUMBER)
}

/// The `own-identity` device: what this platform really is.
#[cfg(feature = "own-identity")]
pub(crate) fn honest_device() -> crate::DeviceInfo {
	let (os, model, manufacturer) = platform();
	crate::DeviceInfo {
		// The API only knows 1 (iOS) and 2 (Android); everything else sends 2.
		device_type: if cfg!(target_os = "ios") { 1 } else { 2 },
		// Random per installation: identifies this install, nothing else.
		device_id: format!("{:016x}", rand::random::<u64>()),
		os,
		// Not read from the system: sent as "unknown" in the API's format.
		screen_resolution: "00x00".to_owned(),
		total_ram: "0".to_owned(),
		advertising_id: uuid::Uuid::new_v4().to_string(),
		device_model: model,
		manufacturer,
		timezone: iana_time_zone::get_timezone()
			.ok()
			.filter(|tz| !tz.is_empty() && tz.chars().all(|c| c.is_ascii_alphanumeric() || "/_+-".contains(c)))
			.unwrap_or_else(|| "UTC".to_owned()),
		// The app sets the real ones from its locale (GrindrClient::set_locale).
		locale: "en_US".to_owned(),
		accept_language: "en-US".to_owned(),
		build_id: String::new(),
	}
}

/// OS, device model and manufacturer, without `;` (the `User-Agent`'s separator).
#[cfg(feature = "own-identity")]
fn platform() -> (String, String, String) {
	let clean = |s: String| s.replace(';', " ").trim().to_owned();
	#[cfg(target_os = "android")]
	let (os, model, manufacturer) = {
		let prop = |name: &str| {
			std::process::Command::new("getprop")
				.arg(name)
				.output()
				.ok()
				.map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned())
				.filter(|v| !v.is_empty())
		};
		(
			prop("ro.build.version.release").map_or_else(|| "Android".to_owned(), |v| format!("Android {v}")),
			prop("ro.product.model").unwrap_or_else(|| "unknown".to_owned()),
			prop("ro.product.manufacturer").unwrap_or_else(|| "unknown".to_owned()),
		)
	};
	#[cfg(target_os = "ios")]
	let (os, model, manufacturer) = ("iOS".to_owned(), "iPhone".to_owned(), "Apple".to_owned());
	#[cfg(target_os = "macos")]
	let (os, model, manufacturer) = ("macOS".to_owned(), "Mac".to_owned(), "Apple".to_owned());
	#[cfg(target_os = "windows")]
	let (os, model, manufacturer) = ("Windows".to_owned(), "PC".to_owned(), "unknown".to_owned());
	#[cfg(not(any(target_os = "android", target_os = "ios", target_os = "macos", target_os = "windows")))]
	let (os, model, manufacturer) = ("Linux".to_owned(), "PC".to_owned(), "unknown".to_owned());
	(clean(os), clean(model), clean(manufacturer))
}

#[cfg(all(test, feature = "own-identity"))]
mod tests {
	use crate::{build_device_info_header, build_user_agent, DeviceInfo, GrindrHeaders};

	/// The formats a server mirroring the API checks (its clientHeaders.ts).
	fn matches_device_info(value: &str) -> bool {
		let parts: Vec<&str> = value.split(';').collect();
		parts.len() == 6
			&& parts[0].len() == 16 && parts[0].chars().all(|c| c.is_ascii_hexdigit())
			&& parts[1] == "GLOBAL"
			&& (parts[2] == "1" || parts[2] == "2")
			&& !parts[3].is_empty() && parts[3].len() <= 15 && parts[3].chars().all(|c| c.is_ascii_digit())
			&& parts[4].split_once('x').is_some_and(|(h, w)| {
				(2..=5).contains(&h.len()) && (2..=5).contains(&w.len())
					&& h.chars().chain(w.chars()).all(|c| c.is_ascii_digit())
			})
			&& uuid::Uuid::parse_str(parts[5]).is_ok()
	}

	#[test]
	fn the_honest_device_fits_the_api_header_formats() {
		let device = DeviceInfo::generate();
		assert!(matches_device_info(&build_device_info_header(&device)), "{}", build_device_info_header(&device));
		assert!(!device.os.contains(';') && !device.device_model.contains(';') && !device.manufacturer.contains(';'));
		assert!(!device.timezone.is_empty());
		// Nothing borrowed from a real phone it isn't.
		assert_ne!(device.device_model, "Pixel 8");
		assert_eq!(device.screen_resolution, "00x00");
	}

	#[test]
	fn the_user_agent_carries_the_apps_own_product_and_version() {
		super::set_client_identity("myapp1", "1.2.3", "45");
		let ua = build_user_agent(&DeviceInfo::generate(), "Free");
		assert!(ua.starts_with("myapp1/1.2.3;45;Free;"), "{ua}");
		assert!(!ua.contains(crate::headers::APP_VERSION));
	}

	#[test]
	fn plain_requests_send_no_imitated_user_agent() {
		let headers = GrindrHeaders::build_plain(None).unwrap();
		assert!(headers.items.iter().all(|(name, _)| name != "user-agent"));
	}
}
