package ai.mechon.companion.data.search

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.io.IOException

class WebSearchManager(
    private val context: Context,
    private val secureStore: WebSearchSecureStore = WebSearchSecureStore(context),
    private val adapters: Map<SearchProviderType, WebSearchProviderAdapter> = mapOf(
        SearchProviderType.TAVILY to TavilySearchAdapter(),
        SearchProviderType.BRAVE to BraveSearchAdapter(),
        SearchProviderType.SERPAPI to SerpApiAdapter(),
        SearchProviderType.SEARXNG to SearxngAdapter()
    )
) {
    fun loadConfig(): WebSearchConfig {
        return secureStore.loadConfig()
    }

    fun saveConfig(config: WebSearchConfig) {
        secureStore.saveConfig(config)
    }

    fun isOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    suspend fun search(query: String): Result<List<WebSearchResult>> {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) {
            return Result.failure(IllegalArgumentException("Search query cannot be empty"))
        }

        if (!isOnline()) {
            return Result.failure(IOException("No active internet connection available on device"))
        }

        val config = loadConfig()
        if (!config.isConfigured) {
            val msg = if (config.provider.requiresApiKey) {
                "Web search is not configured. Please enter an API key for ${config.provider.displayName} in Settings."
            } else {
                "Web search endpoint for ${config.provider.displayName} is not configured."
            }
            return Result.failure(IllegalStateException(msg))
        }

        val adapter = adapters[config.provider]
            ?: return Result.failure(IllegalStateException("No search adapter registered for ${config.provider.displayName}"))

        return adapter.search(cleanQuery, config)
    }

    suspend fun testConnection(config: WebSearchConfig): Result<Boolean> {
        if (!isOnline()) {
            return Result.failure(IOException("No active internet connection available on device"))
        }

        val adapter = adapters[config.provider]
            ?: return Result.failure(IllegalStateException("No search adapter for ${config.provider.displayName}"))

        return adapter.testConnection(config)
    }

    companion object {
        fun formatGroundingPrompt(query: String, results: List<WebSearchResult>): String {
            if (results.isEmpty()) return ""
            val sb = StringBuilder()
            sb.append("\n\n[EXTERNAL GROUNDING - LIVE WEB SEARCH RESULTS FOR: \"").append(query).append("\"]\n")
            results.forEachIndexed { idx, res ->
                sb.append("Source [").append(idx + 1).append("]: ").append(res.title)
                if (res.domain.isNotBlank()) {
                    sb.append(" (").append(res.domain).append(")")
                }
                sb.append("\nURL: ").append(res.url).append("\n")
                if (!res.publishedDate.isNullOrBlank()) {
                    sb.append("Date: ").append(res.publishedDate).append("\n")
                }
                sb.append("Excerpt: ").append(res.snippet.trim()).append("\n\n")
            }
            sb.append("[END SEARCH RESULTS]\n")
            sb.append("Instruction: Use the factual information from the web search results above to answer the user's question accurately. Attribute key facts to the corresponding source domains where appropriate.")
            return sb.toString()
        }
    }
}
