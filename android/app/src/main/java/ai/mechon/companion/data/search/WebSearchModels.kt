package ai.mechon.companion.data.search

enum class SearchProviderType(
    val id: String,
    val displayName: String,
    val defaultEndpoint: String,
    val requiresApiKey: Boolean,
    val supportsCustomEndpoint: Boolean
) {
    TAVILY(
        id = "tavily",
        displayName = "Tavily AI Search",
        defaultEndpoint = "https://api.tavily.com/search",
        requiresApiKey = true,
        supportsCustomEndpoint = false
    ),
    BRAVE(
        id = "brave",
        displayName = "Brave Search",
        defaultEndpoint = "https://api.search.brave.com/res/v1/web/search",
        requiresApiKey = true,
        supportsCustomEndpoint = false
    ),
    SERPAPI(
        id = "serpapi",
        displayName = "SerpAPI (Google)",
        defaultEndpoint = "https://serpapi.com/search.json",
        requiresApiKey = true,
        supportsCustomEndpoint = false
    ),
    SEARXNG(
        id = "searxng",
        displayName = "SearXNG (Self-Hosted)",
        defaultEndpoint = "https://searx.be/search",
        requiresApiKey = false,
        supportsCustomEndpoint = true
    );

    companion object {
        fun fromId(id: String?): SearchProviderType {
            return entries.firstOrNull { it.id.equals(id, ignoreCase = true) } ?: TAVILY
        }
    }
}

data class WebSearchConfig(
    val provider: SearchProviderType = SearchProviderType.TAVILY,
    val apiKey: String = "",
    val endpoint: String = SearchProviderType.TAVILY.defaultEndpoint,
    val timeoutSeconds: Int = 15, // 5 to 30 seconds
    val maxResults: Int = 5 // 1 to 10 results
) {
    val isConfigured: Boolean
        get() = if (provider.requiresApiKey) apiKey.isNotBlank() else endpoint.isNotBlank()
}

interface WebSearchProviderAdapter {
    val providerType: SearchProviderType
    suspend fun search(query: String, config: WebSearchConfig): Result<List<WebSearchResult>>
    suspend fun testConnection(config: WebSearchConfig): Result<Boolean>
}
