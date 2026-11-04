package ai.mechon.companion.data.repository

import ai.mechon.companion.data.local.ConversationDao
import ai.mechon.companion.data.local.ConversationEntity
import ai.mechon.companion.data.local.MessageDao
import ai.mechon.companion.data.local.MessageEntity
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.data.remote.ChatInferenceRequest
import ai.mechon.companion.data.remote.ChatMessagePayload
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.SessionManager
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class ChatRepository(
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao,
    private val desktopApiClient: DesktopApiClient,
    private val sessionManager: SessionManager,
    private val gson: Gson = Gson()
) {
    fun getAllConversationsFlow(): Flow<List<ConversationEntity>> =
        conversationDao.getAllConversationsFlow()

    fun searchConversationsFlow(query: String): Flow<List<ConversationEntity>> =
        if (query.isBlank()) conversationDao.getAllConversationsFlow()
        else conversationDao.searchConversationsFlow(query.trim())

    fun getConversationFlow(id: String): Flow<ConversationEntity?> =
        conversationDao.getConversationFlow(id)

    suspend fun getConversationById(id: String): ConversationEntity? =
        conversationDao.getConversationById(id)

    fun getMessagesFlow(conversationId: String): Flow<List<MessageEntity>> =
        messageDao.getMessagesFlow(conversationId)

    suspend fun createConversation(
        title: String = "New Conversation",
        systemPrompt: String = "",
        modelId: String? = null,
        providerId: String? = null,
        characterId: String? = null,
        characterName: String? = null,
        characterAvatar: String? = null
    ): ConversationEntity {
        val model = modelId ?: sessionManager.defaultModel
        val provider = providerId ?: sessionManager.defaultProvider
        val conv = ConversationEntity(
            id = UUID.randomUUID().toString(),
            title = title,
            modelId = model,
            providerId = provider,
            systemPrompt = systemPrompt,
            characterId = characterId,
            characterName = characterName,
            characterAvatar = characterAvatar,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        conversationDao.insertConversation(conv)
        return conv
    }

    suspend fun updateConversation(conversation: ConversationEntity) {
        conversationDao.updateConversation(conversation.copy(updatedAt = System.currentTimeMillis()))
    }

    suspend fun renameConversation(id: String, newTitle: String) {
        conversationDao.renameConversation(id, newTitle)
    }

    suspend fun setArchived(id: String, archived: Boolean) {
        conversationDao.setArchived(id, archived)
    }

    suspend fun duplicateConversation(conversationId: String): ConversationEntity? {
        val original = conversationDao.getConversationById(conversationId) ?: return null
        val messages = messageDao.getMessages(conversationId)

        val newId = UUID.randomUUID().toString()
        val copy = original.copy(
            id = newId,
            title = "${original.title} (Copy)",
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            isSynced = false,
            syncTransferId = null
        )
        conversationDao.insertConversation(copy)

        for (m in messages) {
            messageDao.insertMessage(
                m.copy(
                    id = UUID.randomUUID().toString(),
                    conversationId = newId
                )
            )
        }

        return copy
    }

    suspend fun deleteConversation(id: String) {
        conversationDao.deleteConversation(id)
    }

    suspend fun deleteConversations(ids: List<String>) {
        conversationDao.deleteConversations(ids)
    }

    suspend fun editMessage(messageId: String, newContent: String) {
        messageDao.updateMessageContent(messageId, newContent)
    }

    suspend fun deleteMessage(messageId: String) {
        messageDao.deleteMessage(messageId)
    }

    suspend fun sendMessage(
        conversationId: String,
        userContent: String,
        attachments: List<AttachmentPayload> = emptyList(),
        enableWebSearch: Boolean = false
    ): Result<MessageEntity> {
        val conv = conversationDao.getConversationById(conversationId)
            ?: return Result.failure(IllegalStateException("Conversation not found"))

        // 1. Save User Message
        val attachmentsJson = if (attachments.isNotEmpty()) gson.toJson(attachments) else "[]"
        val userMsg = MessageEntity(
            id = UUID.randomUUID().toString(),
            conversationId = conversationId,
            role = "user",
            content = userContent,
            attachmentsJson = attachmentsJson,
            timestamp = System.currentTimeMillis()
        )
        messageDao.insertMessage(userMsg)

        // Auto-update conversation title if first message
        val allExisting = messageDao.getMessages(conversationId)
        if (allExisting.size <= 1 && userContent.isNotBlank()) {
            val titleSnippet = userContent.take(36).trim()
            val newTitle = if (titleSnippet.length < userContent.length) "$titleSnippet..." else titleSnippet
            conversationDao.updateConversation(conv.copy(title = newTitle, updatedAt = System.currentTimeMillis()))
        }

        return executeInference(conv, allExisting, userContent, enableWebSearch)
    }

    suspend fun regenerateResponse(
        conversationId: String,
        enableWebSearch: Boolean = false
    ): Result<MessageEntity> {
        val conv = conversationDao.getConversationById(conversationId)
            ?: return Result.failure(IllegalStateException("Conversation not found"))

        val messages = messageDao.getMessages(conversationId)
        if (messages.isEmpty()) return Result.failure(IllegalStateException("No messages in conversation"))

        // Remove the last assistant message if present
        if (messages.last().role == "assistant") {
            messageDao.deleteMessage(messages.last().id)
        }

        val remaining = messageDao.getMessages(conversationId)
        val lastUserText = remaining.lastOrNull { it.role == "user" }?.content ?: ""

        return executeInference(conv, remaining, lastUserText, enableWebSearch)
    }

    private suspend fun executeInference(
        conv: ConversationEntity,
        contextMessages: List<MessageEntity>,
        lastPrompt: String,
        enableWebSearch: Boolean
    ): Result<MessageEntity> {
        val messagePayloads = mutableListOf<ChatMessagePayload>()
        for (m in contextMessages) {
            val atts: List<AttachmentPayload>? = if (m.attachmentsJson.isNotBlank() && m.attachmentsJson != "[]") {
                val listType = object : TypeToken<List<AttachmentPayload>>() {}.type
                try { gson.fromJson(m.attachmentsJson, listType) } catch (e: Exception) { null }
            } else null

            messagePayloads.add(
                ChatMessagePayload(
                    role = m.role,
                    content = m.content,
                    attachments = atts
                )
            )
        }

        // Optional Web Search before inference
        var searchMetaJson: String? = null
        if (enableWebSearch && lastPrompt.isNotBlank()) {
            val searchRes = desktopApiClient.webSearch(lastPrompt, maxResults = 3)
            searchRes.onSuccess { ws ->
                if (ws.results.isNotEmpty()) {
                    searchMetaJson = gson.toJson(ws.results)
                }
            }
        }

        val inferenceReq = ChatInferenceRequest(
            modelId = conv.modelId,
            providerId = conv.providerId,
            messages = messagePayloads,
            systemPrompt = conv.systemPrompt.ifBlank { null },
            temperature = 0.7,
            maxTokens = 2048,
            webSearchEnabled = enableWebSearch
        )

        val inferenceResult = desktopApiClient.chatInference(inferenceReq)
        return inferenceResult.mapCatching { resp ->
            val assistantMsg = MessageEntity(
                id = UUID.randomUUID().toString(),
                conversationId = conv.id,
                role = "assistant",
                content = resp.content,
                searchMetadataJson = searchMetaJson,
                timestamp = System.currentTimeMillis()
            )
            messageDao.insertMessage(assistantMsg)
            conversationDao.updateConversation(conv.copy(updatedAt = System.currentTimeMillis()))
            assistantMsg
        }
    }
}
