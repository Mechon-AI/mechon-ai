package ai.mechon.companion.ui.screens.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.mechon.companion.data.local.ConversationEntity
import ai.mechon.companion.data.local.MessageEntity
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.ProviderModelItem
import ai.mechon.companion.data.remote.SessionManager
import ai.mechon.companion.data.repository.ChatRepository
import ai.mechon.companion.data.repository.RoleplayRepository
import ai.mechon.companion.data.repository.SyncRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ChatUiState(
    val conversation: ConversationEntity? = null,
    val messages: List<MessageEntity> = emptyList(),
    val isInferring: Boolean = false,
    val error: String? = null,
    val webSearchEnabled: Boolean = false,
    val selectedAttachments: List<AttachmentPayload> = emptyList(),
    val availableModels: List<ProviderModelItem> = emptyList(),
    val isModelDialogOpen: Boolean = false,
    // Conversation Drawer State
    val conversationsList: List<ConversationEntity> = emptyList(),
    val searchQuery: String = "",
    val selectedForSyncIds: Set<String> = emptySet(),
    val isSyncing: Boolean = false,
    val syncSuccessMessage: String? = null,
    // Message Action Modal State
    val activeActionMessage: MessageEntity? = null,
    val isEditingMessage: Boolean = false,
    val editContentText: String = ""
)

class ChatViewModel(
    private val chatRepository: ChatRepository,
    private val roleplayRepository: RoleplayRepository,
    private val syncRepository: SyncRepository,
    private val desktopApiClient: DesktopApiClient,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private var inferenceJob: Job? = null
    private var conversationObserveJob: Job? = null
    private var messagesObserveJob: Job? = null

    init {
        observeConversationsList("")
        fetchAvailableModels()
    }

    private fun observeConversationsList(query: String) {
        viewModelScope.launch {
            chatRepository.searchConversationsFlow(query).collectLatest { list ->
                _uiState.update { it.copy(conversationsList = list) }
            }
        }
    }

    fun updateSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        observeConversationsList(query)
    }

    fun loadConversation(conversationId: String?) {
        conversationObserveJob?.cancel()
        messagesObserveJob?.cancel()

        if (conversationId != null) {
            conversationObserveJob = viewModelScope.launch {
                chatRepository.getConversationFlow(conversationId).collectLatest { conv ->
                    _uiState.update { it.copy(conversation = conv) }
                }
            }
            messagesObserveJob = viewModelScope.launch {
                chatRepository.getMessagesFlow(conversationId).collectLatest { msgs ->
                    _uiState.update { it.copy(messages = msgs) }
                }
            }
        } else {
            // Find most recent conversation or create a new one
            viewModelScope.launch {
                val all = chatRepository.getAllConversationsFlow().first()
                if (all.isNotEmpty()) {
                    loadConversation(all.first().id)
                } else {
                    val activePrompt = roleplayRepository.getActivePrompt()
                    val newConv = chatRepository.createConversation(
                        title = "New Conversation",
                        systemPrompt = activePrompt
                    )
                    loadConversation(newConv.id)
                }
            }
        }
    }

    fun createNewConversation(onCreated: (String) -> Unit = {}) {
        viewModelScope.launch {
            val activePrompt = roleplayRepository.getActivePrompt()
            val newConv = chatRepository.createConversation(
                title = "New Conversation",
                systemPrompt = activePrompt
            )
            loadConversation(newConv.id)
            onCreated(newConv.id)
        }
    }

    fun renameConversation(id: String, newTitle: String) {
        viewModelScope.launch {
            chatRepository.renameConversation(id, newTitle)
        }
    }

    fun duplicateConversation(id: String) {
        viewModelScope.launch {
            val copy = chatRepository.duplicateConversation(id)
            if (copy != null) {
                loadConversation(copy.id)
            }
        }
    }

    fun archiveConversation(id: String) {
        viewModelScope.launch {
            chatRepository.setArchived(id, true)
            // If active was archived, load next
            if (_uiState.value.conversation?.id == id) {
                loadConversation(null)
            }
        }
    }

    fun deleteConversation(id: String) {
        viewModelScope.launch {
            chatRepository.deleteConversation(id)
            if (_uiState.value.conversation?.id == id) {
                loadConversation(null)
            }
        }
    }

    fun toggleSyncSelection(id: String) {
        _uiState.update {
            val set = it.selectedForSyncIds.toMutableSet()
            if (set.contains(id)) set.remove(id) else set.add(id)
            it.copy(selectedForSyncIds = set)
        }
    }

    fun syncSelectedConversations() {
        val ids = _uiState.value.selectedForSyncIds.toList()
        if (ids.isEmpty()) return

        _uiState.update { it.copy(isSyncing = true, error = null, syncSuccessMessage = null) }
        viewModelScope.launch {
            val result = syncRepository.syncConversationsToDesktop(ids)
            result.fold(
                onSuccess = { resp ->
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            selectedForSyncIds = emptySet(),
                            syncSuccessMessage = "Transferred ${resp.receivedCount} session(s) to Mechon Desktop!"
                        )
                    }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            error = err.message ?: "Failed to transfer conversations"
                        )
                    }
                }
            )
        }
    }

    fun fetchAvailableModels() {
        viewModelScope.launch {
            if (!sessionManager.isPaired) return@launch
            desktopApiClient.getProviderModels().onSuccess { resp ->
                _uiState.update { it.copy(availableModels = resp.models) }
            }
        }
    }

    fun selectModel(item: ProviderModelItem) {
        val current = _uiState.value.conversation ?: return
        viewModelScope.launch {
            val updated = current.copy(
                modelId = item.modelId,
                providerId = item.providerId
            )
            chatRepository.updateConversation(updated)
            _uiState.update { it.copy(conversation = updated, isModelDialogOpen = false) }
        }
    }

    fun setModelDialogOpen(open: Boolean) {
        _uiState.update { it.copy(isModelDialogOpen = open) }
        if (open) fetchAvailableModels()
    }

    fun toggleWebSearch() {
        _uiState.update { it.copy(webSearchEnabled = !it.webSearchEnabled) }
    }

    fun addAttachment(attachment: AttachmentPayload) {
        _uiState.update { it.copy(selectedAttachments = it.selectedAttachments + attachment) }
    }

    fun removeAttachment(index: Int) {
        _uiState.update {
            val updated = it.selectedAttachments.toMutableList()
            if (index in updated.indices) {
                updated.removeAt(index)
            }
            it.copy(selectedAttachments = updated)
        }
    }

    fun sendMessage(text: String) {
        val conv = _uiState.value.conversation ?: return
        if (text.isBlank() && _uiState.value.selectedAttachments.isEmpty()) return

        val currentAttachments = _uiState.value.selectedAttachments
        val searchEnabled = _uiState.value.webSearchEnabled

        _uiState.update {
            it.copy(
                isInferring = true,
                error = null,
                selectedAttachments = emptyList()
            )
        }

        inferenceJob = viewModelScope.launch {
            val result = chatRepository.sendMessage(
                conversationId = conv.id,
                userContent = text,
                attachments = currentAttachments,
                enableWebSearch = searchEnabled
            )

            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isInferring = false) }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isInferring = false,
                            error = err.message ?: "Failed to generate inference response"
                        )
                    }
                }
            )
        }
    }

    fun stopGeneration() {
        inferenceJob?.cancel()
        inferenceJob = null
        _uiState.update { it.copy(isInferring = false) }
    }

    fun regenerateLastResponse() {
        val conv = _uiState.value.conversation ?: return
        _uiState.update { it.copy(isInferring = true, error = null) }

        inferenceJob = viewModelScope.launch {
            val result = chatRepository.regenerateResponse(
                conversationId = conv.id,
                enableWebSearch = _uiState.value.webSearchEnabled
            )
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isInferring = false) }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isInferring = false,
                            error = err.message ?: "Regeneration failed"
                        )
                    }
                }
            )
        }
    }

    fun openMessageAction(message: MessageEntity) {
        _uiState.update {
            it.copy(
                activeActionMessage = message,
                isEditingMessage = false,
                editContentText = message.content
            )
        }
    }

    fun closeMessageAction() {
        _uiState.update {
            it.copy(
                activeActionMessage = null,
                isEditingMessage = false
            )
        }
    }

    fun startEditingMessage(message: MessageEntity) {
        _uiState.update {
            it.copy(
                activeActionMessage = message,
                isEditingMessage = true,
                editContentText = message.content
            )
        }
    }

    fun saveEditedMessage(newText: String) {
        val msg = _uiState.value.activeActionMessage ?: return
        viewModelScope.launch {
            chatRepository.editMessage(msg.id, newText)
            closeMessageAction()
        }
    }

    fun deleteMessage(messageId: String) {
        viewModelScope.launch {
            chatRepository.deleteMessage(messageId)
            closeMessageAction()
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearFeedback() {
        _uiState.update { it.copy(syncSuccessMessage = null, error = null) }
    }
}
