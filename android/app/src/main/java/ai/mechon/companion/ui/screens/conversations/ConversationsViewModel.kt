package ai.mechon.companion.ui.screens.conversations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.mechon.companion.data.local.ConversationEntity
import ai.mechon.companion.data.remote.SessionManager
import ai.mechon.companion.data.repository.ChatRepository
import ai.mechon.companion.data.repository.SyncRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ConversationsUiState(
    val conversations: List<ConversationEntity> = emptyList(),
    val searchQuery: String = "",
    val selectedIds: Set<String> = emptySet(),
    val isSelectionMode: Boolean = false,
    val isSyncing: Boolean = false,
    val syncSuccessMessage: String? = null,
    val errorMessage: String? = null
) {
    val filteredConversations: List<ConversationEntity>
        get() {
            if (searchQuery.isBlank()) return conversations
            val query = searchQuery.trim().lowercase()
            return conversations.filter {
                it.title.lowercase().contains(query) ||
                it.modelId.lowercase().contains(query) ||
                it.providerId.lowercase().contains(query)
            }
        }
}

class ConversationsViewModel(
    private val chatRepository: ChatRepository,
    private val syncRepository: SyncRepository,
    private val sessionManager: SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ConversationsUiState())
    val uiState: StateFlow<ConversationsUiState> = _uiState.asStateFlow()

    init {
        observeConversations()
    }

    private fun observeConversations() {
        viewModelScope.launch {
            chatRepository.getAllConversationsFlow().collectLatest { list ->
                _uiState.update { it.copy(conversations = list) }
            }
        }
    }

    fun toggleSelection(id: String) {
        val current = _uiState.value.selectedIds.toMutableSet()
        if (current.contains(id)) {
            current.remove(id)
        } else {
            current.add(id)
        }
        _uiState.update {
            it.copy(
                selectedIds = current,
                isSelectionMode = current.isNotEmpty()
            )
        }
    }

    fun selectAll() {
        val allIds = _uiState.value.conversations.map { it.id }.toSet()
        _uiState.update {
            it.copy(
                selectedIds = allIds,
                isSelectionMode = allIds.isNotEmpty()
            )
        }
    }

    fun clearSelection() {
        _uiState.update {
            it.copy(
                selectedIds = emptySet(),
                isSelectionMode = false
            )
        }
    }

    fun createNewConversation(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val conv = chatRepository.createConversation()
            onCreated(conv.id)
        }
    }

    fun deleteSelected() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            chatRepository.deleteConversations(ids)
            clearSelection()
        }
    }

    fun sendSelectedToDesktop() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        if (!sessionManager.isPaired) {
            _uiState.update { it.copy(errorMessage = "Device not paired. Pair with Desktop first.") }
            return
        }

        _uiState.update { it.copy(isSyncing = true, errorMessage = null, syncSuccessMessage = null) }

        viewModelScope.launch {
            val result = syncRepository.syncConversationsToDesktop(ids)
            result.fold(
                onSuccess = { resp ->
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            syncSuccessMessage = "Successfully transferred ${resp.receivedCount} session(s) to Mechon Desktop!",
                            selectedIds = emptySet(),
                            isSelectionMode = false
                        )
                    }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isSyncing = false,
                            errorMessage = err.message ?: "Failed to sync conversations with desktop"
                        )
                    }
                }
            )
        }
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun renameConversation(id: String, newTitle: String) {
        if (newTitle.isBlank()) return
        viewModelScope.launch {
            chatRepository.renameConversation(id, newTitle.trim())
        }
    }

    fun deleteConversation(id: String) {
        viewModelScope.launch {
            chatRepository.deleteConversation(id)
        }
    }

    fun archiveConversation(id: String) {
        viewModelScope.launch {
            chatRepository.deleteConversation(id)
        }
    }

    fun clearFeedback() {
        _uiState.update { it.copy(errorMessage = null, syncSuccessMessage = null) }
    }
}
