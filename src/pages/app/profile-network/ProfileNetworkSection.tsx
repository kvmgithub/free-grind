import { ChevronRight, Link2, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/useAuth";
import {
	useMyProfileLinks,
	useProfileLinks,
	useProfileReputation,
	useProfileReputationEnabled,
} from "../../../hooks/queries/useReputationQueries";
import type { ProfileReputation } from "../../../services/api/reputationMethods";
import { ProfileImage } from "../../../components/ui/profile-image";
import { getThumbImageUrl, validateMediaHash } from "../../../utils/media";

export const LINKED_PROFILES_PATH = "/settings/linked-profiles";

const SECTION_LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]";

/** The five-step index as dots, filled up to the level. */
function ReputationLevelDots({ level }: { level: number }) {
	return (
		<span className="flex items-center gap-1" aria-hidden>
			{Array.from({ length: 5 }, (_, i) => (
				<span key={i} className={`h-1.5 w-1.5 rounded-full ${i < level ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
			))}
		</span>
	);
}

/**
 * The reputation index as plain icon rows, in the style of the profile's
 * stats and account info. The "personally known" mark itself is set from the
 * profile's actions menu (useProfileNetworkMenu).
 */
export function ReputationSummary({ reputation }: { reputation: ProfileReputation }) {
	const { t } = useTranslation();
	const score = reputation.score.toLocaleString(undefined, { maximumFractionDigits: 1 });
	const rows: string[] = [];
	if (reputation.knownByCount > 0) {
		rows.push(t("profile_network.known_by", { count: reputation.knownByCount }));
		rows.push(t("profile_network.known_by_vouched", { count: reputation.knownByVouchedCount }));
	} else {
		rows.push(t("profile_network.known_by_none"));
	}

	return (
		<div className="space-y-2.5">
			{reputation.knownByCount > 0 && (
				<div className="flex items-center gap-2.5">
					<ShieldCheck className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
					<p className="text-sm text-[var(--text-muted)]">{t("profile_network.level_line", { level: t(`profile_network.level.${reputation.level}`), score })}</p>
					<ReputationLevelDots level={reputation.level} />
				</div>
			)}
			{rows.map((text) => (
				<div key={text} className="flex items-center gap-2.5">
					<Users className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
					<p className="text-sm text-[var(--text-muted)]">{text}</p>
				</div>
			))}
		</div>
	);
}

/**
 * Below the Spotify songs: the profiles linked to this one (only when there
 * are any) and its reputation index (Free Grind server, flag
 * `profile-reputation`). Link requests and the "personally known" mark live in
 * the profile's actions menu; the own profile points to the management page.
 */
export function ProfileNetworkSection({ profileId, isPreview = false }: { profileId: string; isPreview?: boolean }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { userId } = useAuth();
	const enabled = useProfileReputationEnabled();
	const isOwnProfile = userId != null && String(userId) === String(profileId);
	const active = enabled && !isPreview && !!profileId;
	const { data: reputation } = useProfileReputation(profileId, active);
	const { data: links } = useProfileLinks(profileId, active);
	const { data: myLinks } = useMyProfileLinks(active && isOwnProfile);

	const linkedProfiles = links?.links ?? [];
	const incomingCount = isOwnProfile ? (myLinks?.incoming.length ?? 0) : 0;
	const showLinks = linkedProfiles.length > 0 || incomingCount > 0;
	// Nothing loaded (yet), or a failed request: no empty block that would still take the parent's gap.
	if (!active || (!showLinks && !reputation)) return null;

	// The opening profile stays directly below in history (`stacked`), so closing
	// pops back to it with its own state (returnTo, swipe list) intact. On desktop
	// the linked profile keeps the same background page under the modal.
	const backgroundLocation = (location.state as { backgroundLocation?: unknown } | null)?.backgroundLocation;
	const openProfile = (id: string) => {
		if (String(id) === String(profileId)) return;
		navigate(`/profile/${id}`, {
			state: { returnTo: location.pathname, stacked: true, ...(backgroundLocation ? { backgroundLocation } : {}) },
		});
	};
	const openManagePage = () => navigate(LINKED_PROFILES_PATH, { state: { returnTo: location.pathname, stacked: true } });

	return (
		<>
			{showLinks && (
				<div className="px-3">
					<div className="mb-2 flex min-h-5 items-center justify-between">
						<p className={SECTION_LABEL_CLASS}>{t("profile_network.linked_profiles")}</p>
						{isOwnProfile && (
							<button type="button" onClick={openManagePage} className="-my-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--accent)] transition active:opacity-60">
								{t("profile_network.manage")}
							</button>
						)}
					</div>
					{/* Tiles like the Spotify songs above: photo, name below. */}
					{linkedProfiles.length > 0 && (
						<div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
							{linkedProfiles.map((profile) => {
								const name = profile.displayName?.trim() || t("common.unknown_display_name");
								const avatarUrl = profile.primaryMediaHash && validateMediaHash(profile.primaryMediaHash) ? getThumbImageUrl(profile.primaryMediaHash, "320x320") : null;
								return (
									<button key={profile.profileId} type="button" onClick={() => openProfile(profile.profileId)} className="group min-w-0 text-start">
										{/* Name inside the tile, like the grid: white on a bottom gradient. */}
										<span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-[var(--surface-2)] ring-1 ring-[var(--border)] transition group-hover:ring-[var(--accent)]">
											<ProfileImage src={avatarUrl} alt={t("profile_details.photo_alt", { name })} placeholder="silhouette" />
											<span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
											<span className="absolute inset-x-1.5 bottom-1.5 truncate text-xs font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{name}</span>
										</span>
									</button>
								);
							})}
						</div>
					)}
					{incomingCount > 0 && (
						<button
							type="button"
							onClick={openManagePage}
							className={`flex min-h-12 w-full items-center gap-3 rounded-2xl bg-[var(--surface-2)] px-4 text-start transition hover-fill [--hover-base:var(--surface-2)] ${linkedProfiles.length > 0 ? "mt-3" : ""}`}
						>
							<Link2 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
							<span className="min-w-0 flex-1 text-[15px] text-[var(--text)]">{t("profile_network.open_requests", { count: incomingCount })}</span>
							<span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--accent-contrast)]">{incomingCount}</span>
							<ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] rtl:rotate-180" />
						</button>
					)}
				</div>
			)}

			{reputation && (
				<div className="px-3">
					<p className={`mb-2 ${SECTION_LABEL_CLASS}`}>{t("profile_network.reputation")}</p>
					<ReputationSummary reputation={reputation} />
				</div>
			)}
		</>
	);
}
