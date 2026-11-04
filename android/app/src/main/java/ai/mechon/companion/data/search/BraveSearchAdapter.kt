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

class BraveSearchAdapter(
    private val baseClient: OkHttpClient = OkHttpClient(),
    private val gson: Gson = Gson()
) : WebSearchProviderAdapter {

    override val providerType: SearchProviderType = SearchProviderType.BRAVE

    private fun getClient(timeoutSeconds: Int): OkHttpClient {
        return baseClient.newBuilder()
            .connectTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .build()
    }

    private data class BraveResultItem(
        @SerializedName("title") val title: String?,
        @SerializedName("url") val url: String?,
        @SerializedName("description") val description: String?,
        @SerializedName("page_age") val pageAge: String?
    )

    private data class BraveWebContainer(
        @SerializedName("results") val results: List<BraveResultItem>?
    )

    private data class BraveSearchResponse(
        @SerializedName("web") val web: BraveWebContainer?
    )

    override suspend fun search(query: String, config: WebSearchConfig): Result<List<WebSearchResult>> = withContext(Dispatchers.IO) {
        if (config.apiKey.isBlank()) {
            return@withContext Result.failure(IllegalStateException("Brave Search API key is not configured"))
        }

        val endpoint = if (config.endpoint.isNotBlank()) config.endpoint else providerType.defaultEndpoint
        val urlBuilder = endpoint.toHttpUrlOrNull()?.newBuilder()
            ?: return@withContext Result.failure(IllegalArgumentException("Invalid endpoint URL: $endpoint"))

        urlBuilder.addQueryParameter("q", query)
        urlBuilder.addQueryParameter("count", config.maxResults.coerceIn(1, 10).toString())

        val request = Request.Builder()
            .url(urlBuilder.build())
            .addHeader("Accept", "application/json")
            .addHeader("X-Subscription-Token", config.apiKey.trim())
            .get()
            .build()

        try {
            val client = getClient(config.timeoutSeconds)
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val parsed = gson.fromJson(body, BraveSearchResponse::class.java)
                    val results = parsed.web?.results?.map { item ->
                        val url = item.url ?: ""
                        WebSearchResult(
                            title = item.title ?: "Web Page",
                            url = url,
                            snippet = item.description ?: "",
                            domain = WebSearchResult.extractDomain(url),
                            publishedDate = item.pageAge
                        )
                    } ?: emptyList()
                    Result.success(results)
                } else {
                    Result.failure(IOException("Brave search failed (${response.code}): $body"))
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
