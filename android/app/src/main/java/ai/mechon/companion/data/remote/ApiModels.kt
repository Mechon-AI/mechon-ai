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
data class ProviderModelItem(
    @SerializedName("provider_id") val providerId: String,
    @SerializedName("provider_name") val providerName: String,
    @SerializedName("model_id") val modelId: String,
    @SerializedName("supports_vision") val supportsVision: Boolean = false
)

data class ProviderModelsResponse(
    @SerializedName("models") val models: List<ProviderModelItem>,
    @SerializedName("default_model") val defaultModel: String?,
    @SerializedName("default_provider") val defaultProvider: String?
)

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
    @SerializedName("model_id") val modelId: String,
    @SerializedName("provider_id") val providerId: String,
    @SerializedName("messages") val messages: List<ChatMessagePayload>,
    @SerializedName("system_prompt") val systemPrompt: String? = null,
    @SerializedName("temperature") val temperature: Double = 0.7,
    @SerializedName("max_tokens") val maxTokens: Int = 2048,
    @SerializedName("web_search_enabled") val webSearchEnabled: Boolean = false
)

data class ChatInferenceResponse(
    @SerializedName("role") val role: String = "assistant",
    @SerializedName("content") val content: String,
    @SerializedName("provider_id") val providerId: String,
    @SerializedName("model_id") val modelId: String,
    @SerializedName("search_results") val searchResults: List<SearchResultItem>? = null,
    @SerializedName("prompt_tokens") val promptTokens: Int? = null,
    @SerializedName("completion_tokens") val completionTokens: Int? = null,
    @SerializedName("latency_ms") val latencyMs: Long? = null
)

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
