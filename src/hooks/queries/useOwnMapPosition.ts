import { useQuery } from "@tanstack/react-query";
import { useApiFunctions } from "../useApiFunctions";
import { IS_GRINDR } from "../../services/serverConfig";
import type { OwnMapPosition } from "../../services/api/ownMapPositionMethods";

export const ownMapPositionKey = ["own-map-position"] as const;

/**
 * Where others see you on the grid map (Free Grind server only). Refetch it
 * (invalidate `ownMapPositionKey`) after the location moved; the server
 * re-derives the public point on every location update.
 */
export function useOwnMapPosition(enabled: boolean) {
	const api = useApiFunctions();
	return useQuery<OwnMapPosition>({
		queryKey: ownMapPositionKey,
		queryFn: () => api.getOwnMapPosition(),
		enabled: enabled && !IS_GRINDR,
		staleTime: 60_000,
		retry: 1,
	});
}
