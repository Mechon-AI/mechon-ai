package ai.mechon.companion.data.search

import com.google.gson.annotations.SerializedName

data class WebSearchResult(
    @SerializedName("title") val title: String,
    @SerializedName("url") val url: String,
    @SerializedName("snippet") val snippet: String,
    @SerializedName("domain") val domain: String = extractDomain(url),
    @SerializedName("published_date") val publishedDate: String? = null,
    @SerializedName("score") val score: Double? = null
) {
    companion object {
        fun extractDomain(rawUrl: String): String {
            return try {
                var clean = rawUrl.trim()
                if (clean.startsWith("https://", ignoreCase = true)) {
                    clean = clean.substring(8)
                } else if (clean.startsWith("http://", ignoreCase = true)) {
                    clean = clean.substring(7)
                }
                val slashIdx = clean.indexOf('/')
                val host = if (slashIdx != -1) clean.substring(0, slashIdx) else clean
                val colonIdx = host.indexOf(':')
                if (colonIdx != -1) host.substring(0, colonIdx) else host
            } catch (e: Exception) {
                rawUrl
            }
        }
    }
}
