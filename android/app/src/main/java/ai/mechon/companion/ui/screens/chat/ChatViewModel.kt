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
    val isModelDialogOpen: Boolean = false
)

class ChatViewModel(
    private val chatRepository: ChatRepository,
    private val roleplayRepository: RoleplayRepository,
    private val desktopApiClient: DesktopApiClient,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init {
        fetchAvailableModels()
    }

    fun loadConversation(conversationId: String?) {
        viewModelScope.launch {
            if (conversationId != null) {
                chatRepository.getConversationFlow(conversationId).collectLatest { conv ->
                    _uiState.update { it.copy(conversation = conv) }
                }
            } else {
                // Check if existing conversations exist, otherwise create a blank one with active roleplay prompt
                val activePrompt = roleplayRepository.getActivePrompt()
                val newConv = chatRepository.createConversation(
                    title = "New Conversation",
                    systemPrompt = activePrompt
                )
                _uiState.update { it.copy(conversation = newConv) }
                loadConversation(newConv.id)
            }
        }

        if (conversationId != null) {
            viewModelScope.launch {
                chatRepository.getMessagesFlow(conversationId).collectLatest { msgs ->
                    _uiState.update { it.copy(messages = msgs) }
                }
            }
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

        viewModelScope.launch {
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

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
