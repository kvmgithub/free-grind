package dev.estopia.free_grind

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/** Rust-side handle on ReverseImageSearchActivity (see reverse_image_search/android.rs). */
@TauriPlugin
class ReverseImageSearchPlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun dismiss(invoke: Invoke) {
    ReverseImageSearchActivity.dismiss()
    invoke.resolve(JSObject())
  }
}
