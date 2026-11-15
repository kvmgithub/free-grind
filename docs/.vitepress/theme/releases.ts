// Releases of the app, from its GitLab project (gitlab.com/hookrapp/free-grind).
export const REPO_URL = "https://gitlab.com/hookrapp/free-grind";
export const RELEASES_URL = `${REPO_URL}/-/releases`;
const RELEASES_API = "https://gitlab.com/api/v4/projects/hookrapp%2Ffree-grind/releases?per_page=10";

export interface Release {
	name: string;
	tagName: string;
	htmlUrl: string;
	publishedAt: string;
	assets: { name: string; url: string }[];
}

interface GitLabRelease {
	name: string | null;
	tag_name: string;
	released_at: string;
	upcoming_release?: boolean;
	_links?: { self?: string };
	assets?: { links?: { name: string; url: string; direct_asset_url?: string }[] };
}

let latest: Promise<Release | null> | undefined;

/**
 * Newest published release, pre-releases (every 1.0 beta) included. Shared
 * by all buttons on a page; null when GitLab can't be reached.
 */
export function latestRelease(): Promise<Release | null> {
	latest ??= fetch(RELEASES_API)
		.then((response) => (response.ok ? response.json() : []))
		.then((releases: GitLabRelease[]) => {
			const release = releases.find((r) => !r.upcoming_release && (r.assets?.links?.length ?? 0) > 0);
			if (!release) return null;
			return {
				name: release.name ?? release.tag_name,
				tagName: release.tag_name,
				htmlUrl: release._links?.self ?? RELEASES_URL,
				publishedAt: release.released_at,
				assets: (release.assets?.links ?? []).map((a) => ({ name: a.name, url: a.url })),
			};
		})
		.catch(() => null);
	return latest;
}
