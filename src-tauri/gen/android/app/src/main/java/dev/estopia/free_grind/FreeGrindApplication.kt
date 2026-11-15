package dev.estopia.free_grind

import android.app.Application
import android.os.Build
import java.io.File

class FreeGrindApplication : Application() {
    // A flavor may give one of its processes another package name (the
    // grindr flavor's ":recaptcha" process, see FlavorNative). Every other
    // process keeps ours.
    private val packageNameOverride by lazy { FlavorNative.packageNameFor(currentProcessName()) }

    override fun getPackageName(): String = packageNameOverride ?: super.getPackageName()

    override fun onCreate() {
        super.onCreate()
        // Pushes belong to the main process only, not to a flavor's extra
        // processes or ":google_oauth" (GoogleOAuthActivity).
        if (currentProcessName() != applicationInfo.processName) return
        PushFirebase.initialize(this)
    }

    private fun currentProcessName(): String? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            Application.getProcessName()
        } else {
            try {
                File("/proc/self/cmdline").readText().substringBefore('\u0000').trim()
            } catch (e: Exception) {
                null
            }
        }
}
