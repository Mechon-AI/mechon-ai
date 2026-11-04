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

class SerpApiAdapter(
    private val baseClient: OkHttpClient = OkHttpClient(),
    private val gson: Gson = Gson()
) : WebSearchProviderAdapter {

    override val providerType: SearchProviderType = SearchProviderType.SERPAPI

    private fun getClient(timeoutSeconds: Int): OkHttpClient {
        return baseClient.newBuilder()
            .connectTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .build()
    }

    private data class SerpOrganicItem(
        @SerializedName("title") val title: String?,
        @SerializedName("link") val link: String?,
        @SerializedName("snippet") val snippet: String?,
        @SerializedName("date") val date: String?
    )

    private data class SerpApiResponse(
        @SerializedName("organic_results") val organicResults: List<SerpOrganicItem>?,
        @SerializedName("error") val error: String?
    )

    override suspend fun search(query: String, config: WebSearchConfig): Result<List<WebSearchResult>> = withContext(Dispatchers.IO) {
        if (config.apiKey.isBlank()) {
            return@withContext Result.failure(IllegalStateException("SerpAPI key is not configured"))
        }

        val endpoint = if (config.endpoint.isNotBlank()) config.endpoint else providerType.defaultEndpoint
        val urlBuilder = endpoint.toHttpUrlOrNull()?.newBuilder()
            ?: return@withContext Result.failure(IllegalArgumentException("Invalid endpoint URL: $endpoint"))

        urlBuilder.addQueryParameter("q", query)
        urlBuilder.addQueryParameter("api_key", config.apiKey.trim())
        urlBuilder.addQueryParameter("num", config.maxResults.coerceIn(1, 10).toString())
        urlBuilder.addQueryParameter("engine", "google")

        val request = Request.Builder()
            .url(urlBuilder.build())
            .get()
            .build()

        try {
            val client = getClient(config.timeoutSeconds)
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val parsed = gson.fromJson(body, SerpApiResponse::class.java)
                    if (parsed.error != null) {
                        return@withContext Result.failure(IOException("SerpAPI error: ${parsed.error}"))
                    }
                    val results = parsed.organicResults?.map { item ->
                        val url = item.link ?: ""
                        WebSearchResult(
                            title = item.title ?: "Web Page",
                            url = url,
                            snippet = item.snippet ?: "",
                            domain = WebSearchResult.extractDomain(url),
                            publishedDate = item.date
                        )
                    } ?: emptyList()
                    Result.success(results)
                } else {
                    Result.failure(IOException("SerpAPI search failed (${response.code}): $body"))
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
