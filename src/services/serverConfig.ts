import { invoke } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { isTauriRuntime } from "./tauriWebSocket";

/**
 * Whether this app talks to Grindr's servers (the grindr flavor) or to the
 * Free Grind server (the server flavor). Fixed at build time (FG_FLAVOR, see
 * scripts/flavor.mjs) and a literal in the bundle, so the other flavor's
 * branches are dropped. Product features are switched by the server's feature
 * flags (useFeatureFlag), not by this; it's only for real transport
 * differences (media hosts, captcha, push, endpoints Grindr doesn't have).
 */
export const IS_GRINDR = __FLAVOR__ === "grindr";

/** The backend's addresses, from Rust (src-tauri/src/api/server.rs). */
export type ServerInfo = {
	apiBase: string;
	mediaBase: string | null;
	/** Firebase client config of the Free Grind server (build-time FG_FCM_*); server flavor only. */
	fcm: FcmClientConfig | null;
};

export type FcmClientConfig = { projectId: string; applicationId: string; apiKey: string; senderId: string };

const INITIAL: ServerInfo = { apiBase: IS_GRINDR ? "https://grindr.mobi" : "", mediaBase: null, fcm: null };

let current: ServerInfo = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: ServerInfo) {
	current = next;
	for (const l of listeners) l();
}

export async function loadServerConfig(): Promise<ServerInfo> {
	if (!isTauriRuntime()) return current;
	const info = await invoke<ServerInfo>("get_server_config");
	loaded = true;
	emit(info);
	return info;
}

export function getServerInfo(): ServerInfo {
	if (!loaded) void loadServerConfig().catch(() => undefined);
	return current;
}

export function useServerInfo(): ServerInfo {
	return useSyncExternalStore(
		(cb) => {
			listeners.add(cb);
			if (!loaded) void loadServerConfig().catch(() => undefined);
			return () => listeners.delete(cb);
		},
		() => current,
		() => current,
	);
}
