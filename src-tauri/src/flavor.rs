//! The app flavor's identity, from its manifest (FG_FLAVOR, see
//! scripts/flavor.mjs), compiled in by build.rs.

/// User-visible app name, e.g. "Free Grind".
pub const APP_NAME: &str = env!("FG_APP_NAME");

/// Lowercase slug for the app's own folders and the keyring service, e.g.
/// "free-grind". Differs per flavor, so two flavors never share data.
pub const APP_SLUG: &str = env!("FG_APP_SLUG");

/// `User-Agent` product token of the server flavor's client (manifest
/// `clientProduct`, e.g. `myapp1`); the official `grindr3` when unset.
pub const CLIENT_PRODUCT: &str = env!("FG_CLIENT_PRODUCT");
