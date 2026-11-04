package ai.mechon.companion.data.remote

import com.google.gson.annotations.SerializedName

// Pairing Models
data class PairRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("device_type") val deviceType: String = "android",
    @SerializedName("pairing_key") val pairingKey: String
)

data class PairResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("token") val token: String?,
    @SerializedName("device_id") val deviceId: String?,
    @SerializedName("desktop_name") val desktopName: String?,
    @SerializedName("version") val version: String?,
    @SerializedName("error") val error: String? = null
)

// Approval-based Pairing Models (v1.2.5)
data class ApprovalPairingRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("device_platform") val devicePlatform: String = "android",
    @SerializedName("client_nonce") val clientNonce: String = ""
)

data class ApprovalPairingInitResponse(
    @SerializedName("request_id") val requestId: String,
    @SerializedName("status") val status: String, // "pending"
    @SerializedName("message") val message: String
)

data class ApprovalPairingStatusResponse(
    @SerializedName("request_id") val requestId: String,
    @SerializedName("status") val status: String, // "pending", "approved", "rejected"
    @SerializedName("token") val token: String? = null,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("desktop_name") val desktopName: String? = null,
    @SerializedName("version") val version: String? = null,
    @SerializedName("error") val error: String? = null
)

// LAN Auto-Discovery Workstation Beacon
data class DiscoveredWorkstation(
    @SerializedName("service") val service: String = "mechon-gateway",
    @SerializedName("name") val name: String = "Mechon Desktop",
    @SerializedName("lan_ip") val lanIp: String,
    @SerializedName("port") val port: Int = 38475,
    @SerializedName("version") val version: String = "1.2.7",
    val lastSeenTimestamp: Long = System.currentTimeMillis()
)

// Desktop Gateway Status
data class DesktopStatusResponse(
    @SerializedName("is_running") val isRunning: Boolean,
    @SerializedName("lan_ip") val lanIp: String,
    @SerializedName("port") val port: Int,
    @SerializedName("endpoint") val endpoint: String,
    @SerializedName("version") val version: String,
    @SerializedName("connected_devices_count") val connectedDevicesCount: Int
)

// Providers & Models
data class RemoteModelItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("supports_vision") val supportsVision: Boolean = false,
    @SerializedName("supports_streaming") val supportsStreaming: Boolean = true,
    @SerializedName("context_length") val contextLength: Int = 128000
)

data class RemoteProviderItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("provider_type") val providerType: String = "",
    @SerializedName("is_active") val isActive: Boolean = true,
    @SerializedName("has_api_key") val hasApiKey: Boolean = false,
    @SerializedName("default_model") val defaultModel: String? = null,
    @SerializedName("models") val models: List<RemoteModelItem>? = null
)

data class ProviderModelItem(
    @SerializedName("provider_id") val providerId: String,
    @SerializedName("provider_name") val providerName: String,
    @SerializedName("provider_type") val providerType: String = "",
    @SerializedName("model_id") val modelId: String,
    @SerializedName("model_name") val modelName: String = modelId,
    @SerializedName("supports_vision") val supportsVision: Boolean = false,
    @SerializedName("supports_streaming") val supportsStreaming: Boolean = true,
    @SerializedName("context_length") val contextLength: Int = 128000,
    @SerializedName("is_active") val isActive: Boolean = true,
    @SerializedName("is_available") val isAvailable: Boolean = true
)

data class ProviderModelsResponse(
    @SerializedName("models") val models: List<ProviderModelItem>? = null,
    @SerializedName("providers") val providers: List<RemoteProviderItem>? = null,
    @SerializedName("default_model") val defaultModel: String? = null,
    @SerializedName("default_provider") val defaultProvider: String? = null
) {
    fun getNormalizedModels(): List<ProviderModelItem> {
        val result = mutableListOf<ProviderModelItem>()
        models?.filterNotNull()?.forEach { result.add(it) }

        if (result.isEmpty() && providers != null) {
            for (p in providers.filterNotNull()) {
                if (!p.isActive) continue
                val pModels = p.models?.filterNotNull() ?: emptyList()
                for (m in pModels) {
                    val mLower = m.id.lowercase()
                    val vision = m.supportsVision || mLower.contains("vision") || mLower.contains("flash") || mLower.contains("gemini")
                    result.add(
                        ProviderModelItem(
                            providerId = p.id,
                            providerName = p.name,
                            providerType = p.providerType,
                            modelId = m.id,
                            modelName = if (!m.name.isNullOrBlank()) m.name else m.id,
                            supportsVision = vision,
                            supportsStreaming = m.supportsStreaming,
                            contextLength = m.contextLength,
                            isActive = p.isActive,
                            isAvailable = p.hasApiKey || p.providerType == "mock" || p.providerType == "ollama"
                        )
                    )
                }
            }
        }
        return result
    }
}

// Attachments
data class AttachmentPayload(
    @SerializedName("name") val name: String,
    @SerializedName("mime_type") val mimeType: String,
    @SerializedName("data_base64") val dataBase64: String,
    @SerializedName("size_bytes") val sizeBytes: Long
)

// Chat Inference
data class ChatMessagePayload(
    @SerializedName("role") val role: String,
    @SerializedName("content") val content: String,
    @SerializedName("attachments") val attachments: List<AttachmentPayload>? = null
)

data class ChatInferenceRequest(
    @SerializedName("model") val model: String,
    @SerializedName("model_id") val modelId: String = model,
    @SerializedName("provider_id") val providerId: String,
    @SerializedName("messages") val messages: List<ChatMessagePayload>,
    @SerializedName("system_prompt") val systemPrompt: String? = null,
    @SerializedName("temperature") val temperature: Double = 0.7,
    @SerializedName("max_tokens") val maxTokens: Int = 2048,
    @SerializedName("web_search_enabled") val webSearchEnabled: Boolean = false
)

data class ChatInferenceResponse(
    @SerializedName("role") val role: String = "assistant",
    @SerializedName("content") val content: String = "",
    @SerializedName("provider_id") val providerId: String? = null,
    @SerializedName("model") private val _model: String? = null,
    @SerializedName("model_id") private val _modelId: String? = null,
    @SerializedName("search_results") val searchResults: List<SearchResultItem>? = null,
    @SerializedName("prompt_tokens") val promptTokens: Int? = null,
    @SerializedName("completion_tokens") val completionTokens: Int? = null,
    @SerializedName("latency_ms") val latencyMs: Long? = null
) {
    val modelId: String
        get() = _modelId ?: _model ?: ""
    val model: String
        get() = _model ?: _modelId ?: ""
}

// Web Search
data class WebSearchRequest(
    @SerializedName("query") val query: String,
    @SerializedName("max_results") val maxResults: Int = 5
)

data class SearchResultItem(
    @SerializedName("title") val title: String,
    @SerializedName("snippet") val snippet: String,
    @SerializedName("url") val url: String
)

data class WebSearchResponse(
    @SerializedName("query") val query: String,
    @SerializedName("results") val results: List<SearchResultItem>
)

// Sync & SFT Transfer
data class SyncMessagePayload(
    @SerializedName("role") val role: String,
    @SerializedName("content") val content: String,
    @SerializedName("timestamp") val timestamp: String
)

data class SyncConversationPayload(
    @SerializedName("mobile_session_id") val mobileSessionId: String,
    @SerializedName("title") val title: String,
    @SerializedName("system_prompt") val systemPrompt: String,
    @SerializedName("tags") val tags: List<String>,
    @SerializedName("messages") val messages: List<SyncMessagePayload>,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class SyncConversationsRequest(
    @SerializedName("conversations") val conversations: List<SyncConversationPayload>,
    @SerializedName("idempotency_key") val idempotencyKey: String
)

data class SyncConversationsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("transfer_id") val transferId: String,
    @SerializedName("received_count") val receivedCount: Int,
    @SerializedName("message") val message: String
)
