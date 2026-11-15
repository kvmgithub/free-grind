// Compile-time check only (never imported): recaptcha.unavailable.ts offers
// everything recaptcha.ts does, with compatible types.
import type * as Recaptcha from "./recaptcha";
import * as Unavailable from "./recaptcha.unavailable";

Unavailable satisfies typeof Recaptcha;
