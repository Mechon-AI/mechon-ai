package ai.mechon.companion.data.remote

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
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

    suspend fun verifySession(targetUrl: String? = null, token: String? = null): Result<AuthenticatedHealthResponse> = withContext(Dispatchers.IO) {
        val t = token ?: sessionManager.authToken ?: return@withContext Result.failure(InvalidTokenException("No authentication token available"))
        val base = (targetUrl ?: sessionManager.desktopUrl).trimEnd('/')

        val endpoints = listOf("$base/api/mobile/v1/health", "$base/api/v1/health")
        var lastException: Exception? = null

        for (endpoint in endpoints) {
            val request = Request.Builder()
                .url(endpoint)
                .header("Authorization", "Bearer $t")
                .get()
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    val body = response.body?.string() ?: ""
                    when (response.code) {
                        200 -> {
                            val health = gson.fromJson(body, AuthenticatedHealthResponse::class.java)
                            return@withContext Result.success(health)
                        }
                        403 -> {
                            return@withContext Result.failure(PairingRevokedException("Device pairing revoked by Mechon Desktop: $body"))
                        }
                        401 -> {
                            return@withContext Result.failure(InvalidTokenException("Invalid or expired authentication token: $body"))
                        }
                        404 -> {
                            lastException = IOException("Endpoint not found: $endpoint")
                        }
                        else -> {
                            return@withContext Result.failure(IOException("Health check failed (${response.code}): $body"))
                        }
                    }
                }
            } catch (e: Exception) {
                lastException = e
            }
        }

        Result.failure(lastException ?: IOException("Failed to reach health endpoint at $base"))
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

    suspend fun requestApprovalPairing(
        baseUrl: String
    ): Result<ApprovalPairingInitResponse> = withContext(Dispatchers.IO) {
        val cleanUrl = baseUrl.trimEnd('/')
        val reqPayload = ApprovalPairingRequest(
            deviceId = sessionManager.deviceId,
            deviceName = sessionManager.deviceName,
            devicePlatform = "android",
            clientNonce = System.currentTimeMillis().toString()
        )
        val body = gson.toJson(reqPayload).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$cleanUrl/api/v1/pairing/request")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val initResp = gson.fromJson(respStr, ApprovalPairingInitResponse::class.java)
                    sessionManager.desktopUrl = cleanUrl
                    Result.success(initResp)
                } else {
                    Result.failure(IOException("Pairing request failed (${response.code}): $respStr"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun checkPairingStatus(
        baseUrl: String,
        requestId: String
    ): Result<ApprovalPairingStatusResponse> = withContext(Dispatchers.IO) {
        val cleanUrl = baseUrl.trimEnd('/')
        val request = Request.Builder()
            .url("$cleanUrl/api/v1/pairing/status/$requestId")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val respStr = response.body?.string() ?: ""
                val statusResp = gson.fromJson(respStr, ApprovalPairingStatusResponse::class.java)
                Result.success(statusResp)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCapabilities(): Result<CapabilitiesResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired with Mechon Desktop"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val endpoints = listOf("$base/api/mobile/v1/capabilities", "$base/api/v1/capabilities")
        var lastErr: Exception? = null

        for (endpoint in endpoints) {
            val request = Request.Builder()
                .url(endpoint)
                .header("Authorization", "Bearer $token")
                .get()
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    val body = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val caps = gson.fromJson(body, CapabilitiesResponse::class.java)
                        return@withContext Result.success(caps)
                    } else if (response.code == 403) {
                        return@withContext Result.failure(PairingRevokedException("Pairing revoked by desktop"))
                    } else if (response.code != 404) {
                        return@withContext Result.failure(IOException("Capabilities failed (${response.code}): $body"))
                    }
                }
            } catch (e: Exception) {
                lastErr = e
            }
        }
        Result.failure(lastErr ?: IOException("Failed to fetch capabilities"))
    }

    suspend fun getProviders(): Result<List<ProviderSummaryItem>> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val request = Request.Builder()
            .url("$base/api/mobile/v1/providers")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val map = gson.fromJson(body, Map::class.java)
                    val provJson = gson.toJson(map["providers"])
                    val listType = object : com.google.gson.reflect.TypeToken<List<ProviderSummaryItem>>() {}.type
                    val list: List<ProviderSummaryItem> = gson.fromJson(provJson, listType) ?: emptyList()
                    Result.success(list)
                } else {
                    Result.failure(IOException("Failed to fetch providers (${response.code}): $body"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getProviderModels(): Result<ProviderModelsResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired with Mechon Desktop"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val endpoints = listOf("$base/api/mobile/v1/models", "$base/api/v1/providers/models")
        var lastErr: Exception? = null

        for (endpoint in endpoints) {
            val request = Request.Builder()
                .url(endpoint)
                .header("Authorization", "Bearer $token")
                .get()
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    val body = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val rawResp = try {
                            gson.fromJson(body, ProviderModelsResponse::class.java)
                        } catch (e: Exception) {
                            null
                        }
                        val normalizedModels = rawResp?.getNormalizedModels() ?: emptyList()
                        val defaultMod = rawResp?.defaultModel ?: normalizedModels.firstOrNull()?.modelId
                        val defaultProv = rawResp?.defaultProvider ?: normalizedModels.firstOrNull()?.providerId

                        val finalResp = ProviderModelsResponse(
                            models = normalizedModels,
                            providers = rawResp?.providers ?: emptyList(),
                            defaultModel = defaultMod,
                            defaultProvider = defaultProv
                        )

                        if (defaultMod != null) {
                            sessionManager.defaultModel = defaultMod
                        }
                        if (defaultProv != null) {
                            sessionManager.defaultProvider = defaultProv
                        }
                        return@withContext Result.success(finalResp)
                    } else if (response.code != 404) {
                        return@withContext Result.failure(IOException("Failed to fetch models (${response.code}): $body"))
                    }
                }
            } catch (e: Exception) {
                lastErr = e
            }
        }

        Result.failure(lastErr ?: IOException("Failed to fetch models from desktop"))
    }

    suspend fun chatInference(inferenceRequest: ChatInferenceRequest): Result<ChatInferenceResponse> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(IllegalStateException("Device is not paired"))
        val base = sessionManager.desktopUrl.trimEnd('/')

        val body = gson.toJson(inferenceRequest).toRequestBody(jsonMediaType)
        val endpoints = listOf("$base/api/mobile/v1/inference", "$base/api/v1/inference/chat")
        var lastErr: Exception? = null

        for (endpoint in endpoints) {
            val request = Request.Builder()
                .url(endpoint)
                .header("Authorization", "Bearer $token")
                .post(body)
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    val respStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val chatResp = gson.fromJson(respStr, ChatInferenceResponse::class.java)
                        return@withContext Result.success(chatResp)
                    } else if (response.code != 404) {
                        return@withContext Result.failure(IOException("Inference failed (${response.code}): $respStr"))
                    }
                }
            } catch (e: Exception) {
                lastErr = e
            }
        }

        Result.failure(lastErr ?: IOException("Inference failed: endpoint unreachable"))
    }

    fun chatInferenceStream(inferenceRequest: ChatInferenceRequest): Flow<String> = flow {
        val token = sessionManager.authToken ?: throw IllegalStateException("Device is not paired")
        val base = sessionManager.desktopUrl.trimEnd('/')

        val streamReq = inferenceRequest.copy(stream = true)
        val body = gson.toJson(streamReq).toRequestBody(jsonMediaType)
        val endpoints = listOf("$base/api/mobile/v1/inference", "$base/api/v1/inference/chat")

        var connected = false
        for (endpoint in endpoints) {
            val request = Request.Builder()
                .url(endpoint)
                .header("Authorization", "Bearer $token")
                .header("Accept", "text/event-stream")
                .post(body)
                .build()

            var response: okhttp3.Response? = null
            try {
                response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val contentType = response.header("Content-Type") ?: ""
                    if (contentType.contains("text/event-stream")) {
                        connected = true
                        val source = response.body?.source() ?: break
                        while (!source.exhausted()) {
                            val line = source.readUtf8Line() ?: break
                            if (line.startsWith("data: ")) {
                                val data = line.removePrefix("data: ").trim()
                                if (data == "[DONE]") {
                                    break
                                }
                                try {
                                    val chunkMap = gson.fromJson(data, Map::class.java)
                                    val chunk = chunkMap["chunk"]?.toString()
                                    if (!chunk.isNullOrEmpty()) {
                                        emit(chunk)
                                    }
                                } catch (e: Exception) {
                                    emit(data)
                                }
                            }
                        }
                        break
                    } else {
                        val bodyStr = response.body?.string() ?: ""
                        val chatResp = gson.fromJson(bodyStr, ChatInferenceResponse::class.java)
                        emit(chatResp.content)
                        connected = true
                        break
                    }
                }
            } catch (e: Exception) {
                if (connected) throw e
            } finally {
                response?.close()
            }
        }

        if (!connected) {
            val regular = chatInference(inferenceRequest).getOrThrow()
            emit(regular.content)
        }
    }.flowOn(Dispatchers.IO)

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
