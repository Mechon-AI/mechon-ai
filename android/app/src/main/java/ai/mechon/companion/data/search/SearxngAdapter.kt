package ai.mechon.companion.data.search

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

class SearxngAdapter(
    private val baseClient: OkHttpClient = OkHttpClient(),
    private val gson: Gson = Gson()
) : WebSearchProviderAdapter {

    override val providerType: SearchProviderType = SearchProviderType.SEARXNG

    private fun getClient(timeoutSeconds: Int): OkHttpClient {
        return baseClient.newBuilder()
            .connectTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .build()
    }

    private data class SearxngResultItem(
        @SerializedName("title") val title: String?,
        @SerializedName("url") val url: String?,
        @SerializedName("content") val content: String?,
        @SerializedName("publishedDate") val publishedDate: String?
    )

    private data class SearxngResponse(
        @SerializedName("results") val results: List<SearxngResultItem>?
    )

    override suspend fun search(query: String, config: WebSearchConfig): Result<List<WebSearchResult>> = withContext(Dispatchers.IO) {
        val endpoint = if (config.endpoint.isNotBlank()) config.endpoint else providerType.defaultEndpoint
        val urlBuilder = endpoint.toHttpUrlOrNull()?.newBuilder()
            ?: return@withContext Result.failure(IllegalArgumentException("Invalid SearXNG endpoint URL: $endpoint"))

        urlBuilder.addQueryParameter("q", query)
        urlBuilder.addQueryParameter("format", "json")

        val reqBuilder = Request.Builder()
            .url(urlBuilder.build())
            .addHeader("Accept", "application/json")
            .get()

        if (config.apiKey.isNotBlank()) {
            reqBuilder.addHeader("Authorization", "Bearer ${config.apiKey.trim()}")
        }

        try {
            val client = getClient(config.timeoutSeconds)
            client.newCall(reqBuilder.build()).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val parsed = gson.fromJson(body, SearxngResponse::class.java)
                    val limit = config.maxResults.coerceIn(1, 10)
                    val results = parsed.results?.take(limit)?.map { item ->
                        val url = item.url ?: ""
                        WebSearchResult(
                            title = item.title ?: "Web Page",
                            url = url,
                            snippet = item.content ?: "",
                            domain = WebSearchResult.extractDomain(url),
                            publishedDate = item.publishedDate
                        )
                    } ?: emptyList()
                    Result.success(results)
                } else {
                    Result.failure(IOException("SearXNG search failed (${response.code}): $body"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun testConnection(config: WebSearchConfig): Result<Boolean> = withContext(Dispatchers.IO) {
        search("test connectivity", config.copy(maxResults = 1)).fold(
            onSuccess = { Result.success(true) },
            onFailure = { Result.failure(it) }
        )
    }
}
