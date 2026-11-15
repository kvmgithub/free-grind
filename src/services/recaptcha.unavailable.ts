/**
 * The reCAPTCHA API without reCAPTCHA: builds other than the grindr flavor
 * get this file instead of recaptcha.ts (vite.config.mjs), so they carry no
 * token minting (it poses as the Grindr app). Nothing on such a server asks
 * for a token; a call that would need one fails as unsupported.
 * recaptcha.unavailable.check.ts keeps both files' APIs in sync.
 */

export type RecaptchaAction = "sign_up" | "login" | "forgot_password" | "report" | "decision_appeal" | "device_key_registration";

export type RecaptchaFailure = "unsupportedPlatform" | "busy" | "cancelled" | "unsupportedAction" | "grindrMissing" | "mintFailed";

export class RecaptchaError extends Error {
	constructor(
		readonly reason: RecaptchaFailure,
		readonly detail?: string,
	) {
		super(detail ? `reCAPTCHA ${reason}: ${detail}` : `reCAPTCHA ${reason}`);
		this.name = "RecaptchaError";
	}
}

export function isRecaptchaAvailable(): boolean {
	return false;
}

export function mintRecaptchaToken(): Promise<string> {
	return Promise.reject(new RecaptchaError("unsupportedPlatform"));
}

export function recaptchaFailureMessage(): string {
	return "Captcha verification isn't available in this app.";
}
