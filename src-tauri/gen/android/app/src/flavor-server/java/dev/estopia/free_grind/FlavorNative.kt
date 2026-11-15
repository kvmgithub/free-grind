package dev.estopia.free_grind

import android.content.Context
import android.content.Intent

/**
 * The server flavor's native parts: none. No spoofed identity, no Grindr
 * Firebase project (push comes from the Free Grind server's own project, see
 * PushFirebase.selfHostedToken), no reCAPTCHA minting. Same API as the grindr
 * flavor's FlavorNative (src/flavor-grindr).
 */
object FlavorNative {
    @Suppress("UNUSED_PARAMETER")
    fun packageNameFor(processName: String?): String? = null

    @Suppress("UNUSED_PARAMETER")
    fun initializeDefaultFirebase(context: Context): Boolean = false

    @Suppress("UNUSED_PARAMETER")
    fun recaptchaIntent(context: Context, action: String): Intent? = null

    @Suppress("UNUSED_PARAMETER")
    fun recaptchaResult(data: Intent?): Triple<String?, String?, String?> = Triple(null, null, null)
}
