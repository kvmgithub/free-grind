import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "../services/tauriWebSocket";
import { bytesToBase64 } from "../services/stagedVideoUpload";
import { appLog } from "./logger";

export type ReverseImageSearchEngine = "google" | "yandex" | "pimeyes";

export const REVERSE_IMAGE_SEARCH_ENGINES: ReverseImageSearchEngine[] = ["google", "yandex", "pimeyes"];

/**
 * Engines that only take a file upload (no search-by-URL link): they open in
 * an in-app window that uploads the photo itself (see openUploadImageSearch).
 */
export function reverseSearchNeedsUpload(engine: ReverseImageSearchEngine): boolean {
	return engine === "pimeyes";
}

/**
 * Reverse image search runs on the engine's side, which fetches the picture
 * itself — so only a public http(s) URL works (not blob:, data: or the local
 * fgmedia proxy). Returns null for anything else.
 */
export function getReverseSearchableUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
		if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

/**
 * Engines that can search `imageUrl`: upload engines take any picture we can
 * read (chat and album media are mostly local data: URIs), the others need a
 * public URL they can fetch themselves.
 */
export function getReverseSearchEngines(imageUrl: string | null | undefined): ReverseImageSearchEngine[] {
	if (!imageUrl) return [];
	const isPublic = getReverseSearchableUrl(imageUrl) !== null;
	return REVERSE_IMAGE_SEARCH_ENGINES.filter((engine) => isPublic || reverseSearchNeedsUpload(engine));
}

async function readImageBytes(imageUrl: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
	// Remote pictures go through the HTTP plugin (CORS); data:/blob: URIs are
	// read by the webview itself.
	const response = getReverseSearchableUrl(imageUrl) ? await fetch(imageUrl) : await window.fetch(imageUrl);
	if (!response.ok) throw new Error(`Failed to read photo (${response.status})`);
	const bytes = new Uint8Array(await response.arrayBuffer());
	const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
	return { bytes, mimeType };
}

export function buildReverseImageSearchUrl(engine: ReverseImageSearchEngine, imageUrl: string): string {
	const encoded = encodeURIComponent(imageUrl);
	switch (engine) {
		case "google":
			return `https://lens.google.com/uploadbyurl?url=${encoded}`;
		case "yandex":
			return `https://yandex.com/images/search?rpt=imageview&url=${encoded}`;
		case "pimeyes":
			// Upload only; see reverseSearchNeedsUpload.
			return "https://pimeyes.com/en";
	}
}

/**
 * Opens an upload-only engine in an in-app window (reverse_image_search in
 * Rust) whose init script uploads the photo. Outside Tauri there is no such
 * window, so only the engine's start page opens. Throws if the photo cannot
 * be downloaded or the window does not open.
 */
export async function openUploadImageSearch(engine: ReverseImageSearchEngine, imageUrl: string): Promise<void> {
	if (!isTauriRuntime()) {
		await openReverseImageSearch(engine, imageUrl);
		return;
	}
	const { bytes, mimeType } = await readImageBytes(imageUrl);
	await invoke("open_upload_image_search", { engine, imageBase64: bytesToBase64(bytes), mimeType });
}

/** Opens the engine's results for `imageUrl` in the system browser (fake-profile check). */
export async function openReverseImageSearch(engine: ReverseImageSearchEngine, imageUrl: string): Promise<void> {
	const url = buildReverseImageSearchUrl(engine, imageUrl);
	try {
		await openUrl(url);
	} catch (error) {
		appLog.warn("openUrl failed for reverse image search, falling back to window.open", error);
		window.open(url, "_blank", "noopener,noreferrer");
	}
}
