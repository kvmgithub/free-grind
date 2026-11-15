pub mod auth;
pub mod client;
// The Honduras entitlement bypass is a Grindr workaround: the server flavor
// gets same-named commands that refuse, and none of its code.
#[cfg(not(feature = "flavor-server"))]
pub mod entitlements;
#[cfg(feature = "flavor-server")]
#[path = "entitlements_unavailable.rs"]
pub mod entitlements;
pub mod facebook_oauth;
pub mod google_oauth;
pub mod locale;
pub mod oauth;
pub mod rest;
pub mod runtime;
pub mod server;
pub mod session_recovery;
pub mod sms_report;
pub mod websocket;
