package ai.mechon.companion.data.remote

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class DesktopApiClient(
    private val sessionManager: SessionManager,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build(),
    private val gson: Gson = Gson()
) {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun ping(targetUrl: String? = null): Boolean = withContext(Dispatchers.IO) {
        val base = (targetUrl ?: sessionManager.desktopUrl).trimEnd('/')
        val request = Request.Builder()
            .url("$base/api/v1/ping")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            false
        }
    }

    suspend fun getDesktopStatus(targetUrl: String? = null): Result<DesktopStatusResponse> = withContext(Dispatchers.IO) {
        val base = (targetUrl ?: sessionManager.desktopUrl).trimEnd('/')
        val request = Request.Builder()
            .url("$base/api/v1/status")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val status = gson.fromJson(body, DesktopStatusResponse::class.java)
                    Result.success(status)
                } else {
                    Result.failure(IOException("Server returned code ${response.code}: $body"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pair(
        baseUrl: String,
        pairingKey: String
    ): Result<PairResponse> = withContext(Dispatchers.IO) {
        val cleanUrl = baseUrl.trimEnd('/')
        val pairReq = PairRequest(
            deviceId = sessionManager.deviceId,
            deviceName = sessionManager.deviceName,
            pairingKey = pairingKey.trim().uppercase()
        )
        val body = gson.toJson(pairReq).toRequestBody(jsonMediaType)

        val request = Request.Builder()
            .url("$cleanUrl/api/v1/pair")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                val pairResp = gson.fromJson(respStr, PairResponse::class.java)
                if (response.isSuccessful && pairResp.success && pairResp.token != null) {
                    sessionManager.desktopUrl = cleanUrl
                    sessionManager.authToken = pairResp.token
                    sessionManager.desktopName = pairResp.desktopName ?: "Mechon Desktop"
                    Result.success(pairResp)
                } else {
                    val errMsg = pairResp.error ?: "Pairing failed (Code ${response.code})"
                    Result.failure(IOException(errMsg))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getProviderModels(): Result<ProviderModelsResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val request = Request.Builder()
            .url("$base/api/v1/providers/models")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val models = gson.fromJson(body, ProviderModelsResponse::class.java)
                    if (models.defaultModel != null) {
                        sessionManager.defaultModel = models.defaultModel
                    }
                    if (models.defaultProvider != null) {
                        sessionManager.defaultProvider = models.defaultProvider
                    }
                    Result.success(models)
                } else {
                    Result.failure(IOException("Failed to fetch models: ${response.code} $body"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun chatInference(inferenceRequest: ChatInferenceRequest): Result<ChatInferenceResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val body = gson.toJson(inferenceRequest).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$base/api/v1/inference/chat")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val chatResp = gson.fromJson(respStr, ChatInferenceResponse::class.java)
                    Result.success(chatResp)
                } else {
                    Result.failure(IOException("Inference failed (${response.code}): $respStr"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun webSearch(query: String, maxResults: Int = 5): Result<WebSearchResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val searchReq = WebSearchRequest(query, maxResults)
        val body = gson.toJson(searchReq).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$base/api/v1/search")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val searchResp = gson.fromJson(respStr, WebSearchResponse::class.java)
                    Result.success(searchResp)
                } else {
                    Result.failure(IOException("Search failed (${response.code}): $respStr"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncConversations(syncRequest: SyncConversationsRequest): Result<SyncConversationsResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val body = gson.toJson(syncRequest).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$base/api/v1/sync/conversations")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val syncResp = gson.fromJson(respStr, SyncConversationsResponse::class.java)
                    Result.success(syncResp)
                } else {
                    Result.failure(IOException("Sync failed (${response.code}): $respStr"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
