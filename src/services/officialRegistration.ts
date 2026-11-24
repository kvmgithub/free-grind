type RegistrationBridge = {
	openOfficialGrindr?: () => boolean;
};

/** Opens Android's launcher activity for the official Grindr app. */
export function openOfficialRegistration(): boolean {
	if (typeof window === "undefined") return false;
	const bridge = (window as Window & { FreeGrindBridge?: RegistrationBridge }).FreeGrindBridge;
	return bridge?.openOfficialGrindr?.() === true;
}
