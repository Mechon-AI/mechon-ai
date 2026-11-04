package ai.mechon.companion.data.repository

import ai.mechon.companion.data.local.ConversationDao
import ai.mechon.companion.data.local.MessageDao
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.SyncConversationPayload
import ai.mechon.companion.data.remote.SyncConversationsRequest
import ai.mechon.companion.data.remote.SyncConversationsResponse
import ai.mechon.companion.data.remote.SyncMessagePayload
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class SyncRepository(
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao,
    private val desktopApiClient: DesktopApiClient
) {
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)

    suspend fun syncConversationsToDesktop(conversationIds: List<String>): Result<SyncConversationsResponse> {
        if (conversationIds.isEmpty()) {
            return Result.failure(IllegalArgumentException("No conversations selected for sync"))
        }

        val payloads = mutableListOf<SyncConversationPayload>()
        for (id in conversationIds) {
            val conv = conversationDao.getConversationById(id) ?: continue
            val messages = messageDao.getMessages(id)

            val msgPayloads = messages.map { m ->
                SyncMessagePayload(
                    role = m.role,
                    content = m.content,
                    timestamp = dateFormat.format(Date(m.timestamp))
                )
            }

            val tagsList = conv.tags.split(",").map { it.trim() }.filter { it.isNotBlank() }

            payloads.add(
                SyncConversationPayload(
                    mobileSessionId = conv.id,
                    originalSessionId = conv.id,
                    title = conv.title,
                    systemPrompt = conv.systemPrompt,
                    modelId = conv.modelId,
                    providerId = conv.providerId,
                    tags = tagsList,
                    messages = msgPayloads,
                    createdAt = dateFormat.format(Date(conv.createdAt)),
                    updatedAt = dateFormat.format(Date(conv.updatedAt))
                )
            )
        }

        if (payloads.isEmpty()) {
            return Result.failure(IllegalStateException("No valid conversation data to transmit"))
        }

        val idempotencyKey = "SYNC-" + UUID.randomUUID().toString()
        val syncRequest = SyncConversationsRequest(
            conversations = payloads,
            idempotencyKey = idempotencyKey
        )

        val result = desktopApiClient.syncConversations(syncRequest)
        return result.mapCatching { resp ->
            if (resp.success) {
                conversationDao.markAsSynced(conversationIds, resp.transferId)
            }
            resp
        }
    }
}
