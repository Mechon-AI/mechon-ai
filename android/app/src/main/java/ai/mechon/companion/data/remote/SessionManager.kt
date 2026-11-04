package ai.mechon.companion.data.remote

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import java.util.UUID

class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("mechon_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_NAME = "device_name"
        private const val KEY_DESKTOP_URL = "desktop_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_DESKTOP_NAME = "desktop_name"
        private const val KEY_DEFAULT_PROVIDER = "default_provider"
        private const val KEY_DEFAULT_MODEL = "default_model"
    }

    init {
        if (!prefs.contains(KEY_DEVICE_ID)) {
            val newId = UUID.randomUUID().toString()
            val defaultName = "Android (${Build.MODEL ?: "Device"})"
            prefs.edit()
                .putString(KEY_DEVICE_ID, newId)
                .putString(KEY_DEVICE_NAME, defaultName)
                .apply()
        }
    }

    val deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, "") ?: UUID.randomUUID().toString()

    var deviceName: String
        get() = prefs.getString(KEY_DEVICE_NAME, "Android Device") ?: "Android Device"
        set(value) = prefs.edit().putString(KEY_DEVICE_NAME, value).apply()

    var desktopUrl: String
        get() = prefs.getString(KEY_DESKTOP_URL, "http://192.168.1.100:38475") ?: "http://192.168.1.100:38475"
        set(value) {
            val clean = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_DESKTOP_URL, clean).apply()
        }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var desktopName: String?
        get() = prefs.getString(KEY_DESKTOP_NAME, null)
        set(value) = prefs.edit().putString(KEY_DESKTOP_NAME, value).apply()

    var defaultProvider: String
        get() = prefs.getString(KEY_DEFAULT_PROVIDER, "gemini") ?: "gemini"
        set(value) = prefs.edit().putString(KEY_DEFAULT_PROVIDER, value).apply()

    var defaultModel: String
        get() = prefs.getString(KEY_DEFAULT_MODEL, "gemini-2.5-flash") ?: "gemini-2.5-flash"
        set(value) = prefs.edit().putString(KEY_DEFAULT_MODEL, value).apply()

    var isSessionVerified: Boolean = false

    val isPaired: Boolean
        get() = !authToken.isNullOrBlank()

    val isTailscale: Boolean
        get() {
            val url = desktopUrl.lowercase()
            return url.contains(".ts.net") ||
                   url.contains("://100.") ||
                   (desktopName?.contains("Tailscale", ignoreCase = true) == true)
        }

    fun clearPairing() {
        isSessionVerified = false
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_DESKTOP_NAME)
            .apply()
    }
}
