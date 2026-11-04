package ai.mechon.companion.ui.screens.roleplay

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.mechon.companion.data.local.PromptPresetEntity
import ai.mechon.companion.data.repository.ChatRepository
import ai.mechon.companion.data.repository.RoleplayConfig
import ai.mechon.companion.data.repository.RoleplayRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class RoleplayUiState(
    val config: RoleplayConfig = RoleplayConfig(),
    val presets: List<PromptPresetEntity> = emptyList(),
    val activePreset: PromptPresetEntity? = null,
    val isPreviewExpanded: Boolean = false,
    val isSaveDialogOpen: Boolean = false,
    val isPresetListOpen: Boolean = false,
    val composedPromptPreview: String = ""
)

class RoleplayViewModel(
    private val roleplayRepository: RoleplayRepository,
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(RoleplayUiState())
    val uiState: StateFlow<RoleplayUiState> = _uiState.asStateFlow()

    init {
        updateComposedPreview(_uiState.value.config)
        observePresets()
    }

    private fun observePresets() {
        viewModelScope.launch {
            roleplayRepository.getAllPresetsFlow().collectLatest { list ->
                val active = list.firstOrNull { it.isActive }
                _uiState.update { it.copy(presets = list, activePreset = active) }
            }
        }
    }

    fun updateSectionContent(sectionId: String, content: String) {
        val current = _uiState.value.config
        val updated = when (sectionId) {
            "identity" -> current.copy(characterIdentity = current.characterIdentity.copy(content = content))
            "appearance" -> current.copy(appearance = current.appearance.copy(content = content))
            "personality" -> current.copy(personality = current.personality.copy(content = content))
            "voice" -> current.copy(speechVoice = current.speechVoice.copy(content = content))
            "world" -> current.copy(worldSetting = current.worldSetting.copy(content = content))
            "scenario" -> current.copy(scenarioContext = current.scenarioContext.copy(content = content))
            "user" -> current.copy(userPersona = current.userPersona.copy(content = content))
            "rules" -> current.copy(rulesGuardrails = current.rulesGuardrails.copy(content = content))
            "custom" -> current.copy(customDirectives = current.customDirectives.copy(content = content))
            else -> current
        }
        _uiState.update { it.copy(config = updated) }
        updateComposedPreview(updated)
    }

    fun toggleSectionEnabled(sectionId: String) {
        val current = _uiState.value.config
        val updated = when (sectionId) {
            "identity" -> current.copy(characterIdentity = current.characterIdentity.copy(isEnabled = !current.characterIdentity.isEnabled))
            "appearance" -> current.copy(appearance = current.appearance.copy(isEnabled = !current.appearance.isEnabled))
            "personality" -> current.copy(personality = current.personality.copy(isEnabled = !current.personality.isEnabled))
            "voice" -> current.copy(speechVoice = current.speechVoice.copy(isEnabled = !current.speechVoice.isEnabled))
            "world" -> current.copy(worldSetting = current.worldSetting.copy(isEnabled = !current.worldSetting.isEnabled))
            "scenario" -> current.copy(scenarioContext = current.scenarioContext.copy(isEnabled = !current.scenarioContext.isEnabled))
            "user" -> current.copy(userPersona = current.userPersona.copy(isEnabled = !current.userPersona.isEnabled))
            "rules" -> current.copy(rulesGuardrails = current.rulesGuardrails.copy(isEnabled = !current.rulesGuardrails.isEnabled))
            "custom" -> current.copy(customDirectives = current.customDirectives.copy(isEnabled = !current.customDirectives.isEnabled))
            else -> current
        }
        _uiState.update { it.copy(config = updated) }
        updateComposedPreview(updated)
    }

    private fun updateComposedPreview(config: RoleplayConfig) {
        _uiState.update { it.copy(composedPromptPreview = config.composePrompt()) }
    }

    fun setPreviewExpanded(expanded: Boolean) {
        _uiState.update { it.copy(isPreviewExpanded = expanded) }
    }

    fun setSaveDialogOpen(open: Boolean) {
        _uiState.update { it.copy(isSaveDialogOpen = open) }
    }

    fun setPresetListOpen(open: Boolean) {
        _uiState.update { it.copy(isPresetListOpen = open) }
    }

    fun savePreset(name: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            roleplayRepository.savePreset(name, _uiState.value.config)
            _uiState.update { it.copy(isSaveDialogOpen = false) }
        }
    }

    fun loadPreset(preset: PromptPresetEntity) {
        viewModelScope.launch {
            roleplayRepository.activatePreset(preset.id)
            val parsed = roleplayRepository.parseConfig(preset.sectionsJson)
            _uiState.update {
                it.copy(
                    config = parsed,
                    activePreset = preset,
                    isPresetListOpen = false
                )
            }
            updateComposedPreview(parsed)
        }
    }

    fun deletePreset(id: String) {
        viewModelScope.launch {
            roleplayRepository.deletePreset(id)
        }
    }

    fun createChatWithCurrentRoleplay(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val title = _uiState.value.config.characterIdentity.content.lines().firstOrNull()?.take(30)
                ?: "Roleplay Session"
            val conv = chatRepository.createConversation(
                title = title.ifBlank { "Roleplay Session" },
                systemPrompt = _uiState.value.composedPromptPreview
            )
            onCreated(conv.id)
        }
    }
}
