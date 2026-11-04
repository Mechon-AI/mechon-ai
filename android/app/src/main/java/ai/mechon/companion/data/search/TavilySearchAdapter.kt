package ai.mechon.companion.data.search

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class TavilySearchAdapter(
    private val baseClient: OkHttpClient = OkHttpClient(),
    private val gson: Gson = Gson()
) : WebSearchProviderAdapter {

    override val providerType: SearchProviderType = SearchProviderType.TAVILY
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun getClient(timeoutSeconds: Int): OkHttpClient {
        return baseClient.newBuilder()
            .connectTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .build()
    }

    private data class TavilySearchRequest(
        @SerializedName("api_key") val apiKey: String,
        @SerializedName("query") val query: String,
        @SerializedName("max_results") val maxResults: Int = 5,
        @SerializedName("include_answer") val includeAnswer: Boolean = false
    )

    private data class TavilyItem(
        @SerializedName("title") val title: String?,
        @SerializedName("url") val url: String?,
        @SerializedName("content") val content: String?,
        @SerializedName("score") val score: Double?,
        @SerializedName("published_date") val publishedDate: String?
    )

    private data class TavilyResponse(
        @SerializedName("results") val results: List<TavilyItem>?
    )

    override suspend fun search(query: String, config: WebSearchConfig): Result<List<WebSearchResult>> = withContext(Dispatchers.IO) {
        if (config.apiKey.isBlank()) {
            return@withContext Result.failure(IllegalStateException("Tavily API key is not configured"))
        }

        val endpoint = if (config.endpoint.isNotBlank()) config.endpoint else providerType.defaultEndpoint
        val requestPayload = TavilySearchRequest(
            apiKey = config.apiKey,
            query = query,
            maxResults = config.maxResults,
            includeAnswer = false
        )

        val request = Request.Builder()
            .url(endpoint)
            .post(gson.toJson(requestPayload).toRequestBody(jsonMediaType))
            .build()

        try {
            val client = getClient(config.timeoutSeconds)
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val parsed = gson.fromJson(body, TavilyResponse::class.java)
                    val results = parsed.results?.map { item ->
                        val url = item.url ?: ""
                        WebSearchResult(
                            title = item.title ?: "Web Page",
                            url = url,
                            snippet = item.content ?: "",
                            domain = WebSearchResult.extractDomain(url),
                            publishedDate = item.publishedDate,
                            score = item.score
                        )
                    } ?: emptyList()
                    Result.success(results)
                } else {
                    Result.failure(IOException("Tavily search failed (${response.code}): $body"))
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
