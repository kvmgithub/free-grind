// Repository and website of the app flavor (flavors/<flavor>/flavor.json).
export const REPO_URL = __REPO_URL__;
export const WEBSITE_URL = __WEBSITE_URL__;
/** GitHub REST API base for the repository (releases, compare). */
export const REPO_API_URL = `https://api.github.com/repos/${__GITHUB_REPO__}`;
/** Where people download releases: the flavor's own page, or the repository's GitHub releases. */
export const RELEASES_URL = __RELEASES_PAGE_URL__ || `${REPO_URL}/releases`;
/**
 * Newest releases first, in the GitHub releases API's format: the flavor's own
 * feed (manifest updates.feedUrl, written by its release CI), or GitHub's.
 */
export const RELEASES_FEED_URL = __RELEASES_FEED_URL__ || `${REPO_API_URL}/releases?per_page=30`;
export const DISCORD_URL = "https://discord.gg/cJqTaWPMFF";
export const TELEGRAM_URL = "https://t.me/freegrind";
