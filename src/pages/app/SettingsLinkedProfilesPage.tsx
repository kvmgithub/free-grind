import { useState } from "react";
import { Check, Link2, Loader2, Unlink, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { ErrorState } from "../../components/ui/states";
import { useAuth } from "../../contexts/useAuth";
import {
	type ProfileLinkAction,
	useMyProfileLinks,
	useProfileLinkAction,
	useProfileReputation,
	useProfileReputationEnabled,
} from "../../hooks/queries/useReputationQueries";
import type { LinkedProfile } from "../../services/api/reputationMethods";
import { haptic } from "../../utils/haptics";
import { PullToRefreshContainer } from "./components/PullToRefreshContainer";
import { DrawerEmptyState } from "./chat/drawerUi";
import { LinkedProfileRow, linkPillClass } from "./profile-network/LinkedProfileRow";
import { ReputationSummary } from "./profile-network/ProfileNetworkSection";

/**
 * Manages the own linked profiles (Free Grind server, flag `profile-reputation`):
 * open requests to confirm or decline, confirmed links, sent requests.
 * New requests are sent from the other profile ("Link profile").
 */
export function SettingsLinkedProfilesPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { userId } = useAuth();
	const enabled = useProfileReputationEnabled();
	const { data, isLoading, error, refetch } = useMyProfileLinks();
	const { data: reputation } = useProfileReputation(userId != null ? String(userId) : null);
	const linkAction = useProfileLinkAction();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [unlinkTarget, setUnlinkTarget] = useState<LinkedProfile | null>(null);

	if (!enabled) return <Navigate to="/settings" replace />;

	const returnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
	const backTo = typeof returnTo === "string" ? returnTo : "/settings";
	const openProfile = (id: string) => navigate(`/profile/${id}`, { state: { returnTo: location.pathname } });

	const run = (profile: LinkedProfile, action: ProfileLinkAction) => {
		haptic(10);
		setPendingId(profile.profileId);
		linkAction.mutate(
			{ profileId: profile.profileId, action },
			{
				onSuccess: () => {
					if (action === "accept") toast.success(t("profile_network.linked_toast"));
					setUnlinkTarget(null);
				},
				onError: (err) => toast.error(err instanceof Error ? err.message : t("profile_network.errors.link_failed")),
				onSettled: () => setPendingId(null),
			},
		);
	};

	const links = data?.links ?? [];
	const incoming = data?.incoming ?? [];
	const outgoing = data?.outgoing ?? [];
	const isEmpty = !isLoading && !error && links.length + incoming.length + outgoing.length === 0;
	const spinnerOr = (profile: LinkedProfile, icon: React.ReactNode) =>
		pendingId === profile.profileId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon;

	const section = (label: string, count: number, children: React.ReactNode) => (
		<div>
			<div className="mb-2 flex items-center gap-2 px-1">
				<p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
				<span className="rounded-full ink-tint-10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-muted)]">{count}</span>
			</div>
			<div className="native-group">{children}</div>
		</div>
	);

	return (
		<PullToRefreshContainer
			className="app-screen flex flex-col"
			contentClassName="flex flex-1 flex-col"
			onRefresh={() => refetch()}
			isDisabled={isLoading}
			refreshingLabel={t("profile_network.refreshing")}
		>
			<PageHeader backTo={backTo} title={t("profile_network.page_title")} subtitle={t("profile_network.page_subtitle")} />

			<div className={`grid flex-1 gap-6 ${isEmpty ? "content-center" : "content-start"}`}>
				{reputation && (
					<div>
						<p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t("profile_network.your_reputation")}</p>
						<div className="native-group px-4 py-3.5">
							<ReputationSummary reputation={reputation} />
						</div>
					</div>
				)}

				{isLoading ? (
					<div className="flex justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
					</div>
				) : error ? (
					<ErrorState
						title={t("profile_network.errors.load_failed")}
						description={error instanceof Error ? error.message : undefined}
						onRetry={() => void refetch()}
					/>
				) : isEmpty ? (
					<DrawerEmptyState icon={<Link2 />} fanned={false} title={t("profile_network.empty")} hint={t("profile_network.empty_hint")} />
				) : (
					<>
						{incoming.length > 0 &&
							section(
								t("profile_network.requests"),
								incoming.length,
								incoming.map((profile) => (
									<LinkedProfileRow
										key={profile.profileId}
										profile={profile}
										subtitle={t("profile_network.wants_to_link")}
										onOpen={openProfile}
										actions={
											<div className="flex shrink-0 items-center gap-2">
												<button
													type="button"
													disabled={pendingId != null}
													onClick={() => run(profile, "remove")}
													aria-label={t("profile_network.decline")}
													className={`${linkPillClass} ink-tint-10 text-[var(--text)]`}
												>
													<X className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													disabled={pendingId != null}
													onClick={() => run(profile, "accept")}
													className={`${linkPillClass} bg-[var(--accent)] text-[var(--accent-contrast)]`}
												>
													{spinnerOr(profile, <Check className="h-3.5 w-3.5" />)}
													{t("profile_network.accept")}
												</button>
											</div>
										}
									/>
								)),
							)}

						{links.length > 0 &&
							section(
								t("profile_network.linked_count", { count: links.length, max: data?.max ?? 10 }),
								links.length,
								links.map((profile) => (
									<LinkedProfileRow
										key={profile.profileId}
										profile={profile}
										subtitle={profile.since ? t("profile_network.linked_since", { date: new Date(profile.since).toLocaleDateString() }) : undefined}
										onOpen={openProfile}
										actions={
											<button
												type="button"
												disabled={pendingId != null}
												onClick={() => setUnlinkTarget(profile)}
												className={`${linkPillClass} ink-tint-10 text-red-400`}
											>
												{spinnerOr(profile, <Unlink className="h-3.5 w-3.5" />)}
												{t("profile_network.unlink_short")}
											</button>
										}
									/>
								)),
							)}

						{outgoing.length > 0 &&
							section(
								t("profile_network.sent"),
								outgoing.length,
								outgoing.map((profile) => (
									<LinkedProfileRow
										key={profile.profileId}
										profile={profile}
										subtitle={t("profile_network.request_pending")}
										onOpen={openProfile}
										actions={
											<button
												type="button"
												disabled={pendingId != null}
												onClick={() => run(profile, "remove")}
												className={`${linkPillClass} ink-tint-10 text-[var(--text)]`}
											>
												{spinnerOr(profile, null)}
												{t("profile_network.withdraw")}
											</button>
										}
									/>
								)),
							)}

						<p className="px-4 text-xs leading-relaxed text-[var(--text-muted)]">{t("profile_network.how_to_link")}</p>
					</>
				)}
			</div>

			<ConfirmDialog
				isOpen={unlinkTarget != null}
				title={t("profile_network.unlink_confirm_title")}
				message={t("profile_network.unlink_confirm_message", {
					name: unlinkTarget?.displayName?.trim() || t("common.unknown_display_name"),
				})}
				confirmLabel={t("profile_network.unlink")}
				cancelLabel={t("common.cancel")}
				confirmTone="danger"
				isProcessing={pendingId != null}
				onConfirm={() => {
					if (unlinkTarget) run(unlinkTarget, "remove");
				}}
				onCancel={() => setUnlinkTarget(null)}
			/>
		</PullToRefreshContainer>
	);
}
