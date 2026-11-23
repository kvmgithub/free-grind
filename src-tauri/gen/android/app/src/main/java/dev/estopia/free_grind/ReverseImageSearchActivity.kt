package dev.estopia.free_grind

import android.os.Bundle
import android.os.Process
import android.util.Log
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.lang.ref.WeakReference

private const val ISOLATED_PROFILE = "reverse-image-search"
private const val TAG = "ReverseImageSearch"

private fun isolatedProfileSupported() =
  WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)

/**
 * Hosts the reverse image search window the Rust side opens (see
 * reverse_image_search/mod.rs, `activity_name("ReverseImageSearchActivity")`).
 * The search site runs in its own WebView profile, wiped on every launch, so
 * its cookies never mix with the app's.
 */
class ReverseImageSearchActivity : TauriActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Restored after process death: the Rust side that opened this window is
    // gone. Start over at MainActivity, as FacebookOAuthActivity does.
    if (savedInstanceState != null && !openedInProcess) {
      finish()
      Process.killProcess(Process.myPid())
      return
    }
    openedInProcess = true
    enableEdgeToEdge()
    if (isolatedProfileSupported()) {
      clearIsolatedProfile()
    } else {
      Log.w(TAG, "MULTI_PROFILE unsupported: search shares the app cookie jar")
    }
    super.onCreate(savedInstanceState)
    live = WeakReference(this)
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
      WindowInsetsCompat.CONSUMED
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.settings.setGeolocationEnabled(false)
    if (isolatedProfileSupported()) {
      runCatching {
        WebViewCompat.setProfile(webView, ISOLATED_PROFILE)
      }.onFailure { Log.w(TAG, "search profile isolation failed", it) }
    }
    ViewCompat.requestApplyInsets(webView)
  }

  override fun onDestroy() {
    if (live?.get() === this) {
      live = null
    }
    super.onDestroy()
  }

  companion object {
    @Volatile
    private var live: WeakReference<ReverseImageSearchActivity>? = null

    private var openedInProcess = false

    private fun clearIsolatedProfile() {
      runCatching {
        val profile = ProfileStore.getInstance().getOrCreateProfile(ISOLATED_PROFILE)
        profile.cookieManager.removeAllCookies(null)
        profile.webStorage.deleteAllData()
      }.onFailure { Log.w(TAG, "isolated search profile not cleared", it) }
    }

    fun dismiss() {
      val activity = live?.get() ?: return
      activity.runOnUiThread {
        if (!activity.isFinishing && !activity.isDestroyed) {
          activity.finish()
        }
      }
    }
  }
}
