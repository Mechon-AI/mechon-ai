package ai.mechon.companion.data.search

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class WebSearchSecureStore(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("mechon_web_search_secure_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "mechon_web_search_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128

        private const val PREF_PROVIDER = "search_provider"
        private const val PREF_API_KEY_ENC = "search_api_key_enc"
        private const val PREF_ENDPOINT = "search_endpoint"
        private const val PREF_TIMEOUT = "search_timeout"
        private const val PREF_MAX_RESULTS = "search_max_results"
    }

    private fun getOrCreateKey(): SecretKey? {
        return try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    ANDROID_KEYSTORE
                )
                val keyGenParameterSpec = KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build()
                keyGenerator.init(keyGenParameterSpec)
                keyGenerator.generateKey()
            } else {
                val entry = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
                entry?.secretKey
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun encrypt(plainText: String): String {
        if (plainText.isEmpty()) return ""
        val secretKey = getOrCreateKey()
        if (secretKey == null) {
            // JVM / Test fallback: obfuscated Base64
            return "plain:" + Base64.encodeToString(plainText.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        }
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)
            val iv = cipher.iv
            val cipherText = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
            val combined = ByteArray(iv.size + cipherText.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(cipherText, 0, combined, iv.size, cipherText.size)
            Base64.encodeToString(combined, Base64.NO_WRAP)
        } catch (e: Exception) {
            "plain:" + Base64.encodeToString(plainText.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        }
    }

    private fun decrypt(cipherString: String): String {
        if (cipherString.isEmpty()) return ""
        if (cipherString.startsWith("plain:")) {
            val raw = cipherString.removePrefix("plain:")
            return try {
                String(Base64.decode(raw, Base64.NO_WRAP), Charsets.UTF_8)
            } catch (e: Exception) {
                ""
            }
        }
        val secretKey = getOrCreateKey() ?: return ""
        return try {
            val decoded = Base64.decode(cipherString, Base64.NO_WRAP)
            if (decoded.size <= GCM_IV_LENGTH) return ""
            val iv = ByteArray(GCM_IV_LENGTH)
            val cipherText = ByteArray(decoded.size - GCM_IV_LENGTH)
            System.arraycopy(decoded, 0, iv, 0, GCM_IV_LENGTH)
            System.arraycopy(decoded, GCM_IV_LENGTH, cipherText, 0, cipherText.size)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
            val plainBytes = cipher.doFinal(cipherText)
            String(plainBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            ""
        }
    }

    fun loadConfig(): WebSearchConfig {
        val providerId = prefs.getString(PREF_PROVIDER, SearchProviderType.TAVILY.id)
        val provider = SearchProviderType.fromId(providerId)
        val encryptedKey = prefs.getString(PREF_API_KEY_ENC, "") ?: ""
        val apiKey = decrypt(encryptedKey)
        val endpoint = prefs.getString(PREF_ENDPOINT, provider.defaultEndpoint) ?: provider.defaultEndpoint
        val timeout = prefs.getInt(PREF_TIMEOUT, 15).coerceIn(5, 30)
        val maxResults = prefs.getInt(PREF_MAX_RESULTS, 5).coerceIn(1, 10)

        return WebSearchConfig(
            provider = provider,
            apiKey = apiKey,
            endpoint = endpoint,
            timeoutSeconds = timeout,
            maxResults = maxResults
        )
    }

    fun saveConfig(config: WebSearchConfig) {
        val encryptedKey = encrypt(config.apiKey.trim())
        prefs.edit()
            .putString(PREF_PROVIDER, config.provider.id)
            .putString(PREF_API_KEY_ENC, encryptedKey)
            .putString(PREF_ENDPOINT, config.endpoint.trim())
            .putInt(PREF_TIMEOUT, config.timeoutSeconds.coerceIn(5, 30))
            .putInt(PREF_MAX_RESULTS, config.maxResults.coerceIn(1, 10))
            .apply()
    }

    fun clearCredentials() {
        prefs.edit().remove(PREF_API_KEY_ENC).apply()
    }
}
