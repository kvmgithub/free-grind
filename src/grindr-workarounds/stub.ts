/**
 * The workarounds API with no workaround in it: everything behaves like the
 * official app. Builds that must not contain the workarounds (the server
 * flavor) get this file instead of index.ts; vite.config.mjs swaps it in for
 * every import from outside this folder. stub.check.ts keeps the two in sync.
 */
import { createElement, Fragment } from "react";
import type { PaidActionReason, ViewsApi } from "./types";
import type { InterestItem } from "../pages/app/interest/interestUtils";
import { mergeViews, sortByNewest } from "../pages/app/interest/interestUtils";

export type { NamedView, PaidActionReason, ViewsApi } from "./types";

// Parameters the official behaviour doesn't need are left out (a function
// with fewer parameters fits every call site; call sites type-check against
// index.ts).

export function retryPaidAction<T>(...[, action]: [reason: PaidActionReason, action: () => Promise<T>]): Promise<T> {
	return action();
}

export function awaitHomeLocation(): Promise<void> {
	return Promise.resolve();
}

export async function beforeSignOut(): Promise<void> {}

export function useCanBypassExpiringLimit(): boolean {
	return false;
}

export async function prepareViews(): Promise<void> {}

/** The views list to show: the server's own. */
export function enhanceViews(input: { views: InterestItem[] | null; taps: InterestItem[]; api: ViewsApi }): Promise<InterestItem[]> {
	return Promise.resolve(sortByNewest(mergeViews([], input.views ?? []).values()));
}

export async function onViewReceived(): Promise<void> {}

export function onBrowseCards(): void {}

export function useShowLockedPreviewPhotos(): boolean {
	return false;
}

export function ViewsIntro() {
	return null;
}

/** Whether a profile can be blocked: only where the server allows it (unknown counts as blockable). */
export function useCanBlockProfile(): (isBlockable: boolean | null | undefined) => boolean {
	return (isBlockable) => isBlockable !== false;
}

export function setActiveUser(): void {}

export function GrindrWorkaroundOverlays() {
	return createElement(Fragment);
}

export function GrindrWorkaroundBridges() {
	return createElement(Fragment);
}

/** No "Locate": the toggle under Optional Features is hidden and stays off. */
export const LOCATE_PROFILE_AVAILABLE: boolean = false;

export function useLocateProfile() {
	return {
		locatingProfileId: null as string | null,
		handleTriangleProfile: () => {},
		locateLabelFor: () => "",
	};
}

export function LocateProfileHost() {
	return createElement(Fragment);
}
