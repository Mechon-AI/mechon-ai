package ai.mechon.companion.ui.screens.roleplay

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.mechon.companion.data.local.CharacterEntity
import ai.mechon.companion.data.local.PromptPresetEntity
import ai.mechon.companion.data.repository.ChatRepository
import ai.mechon.companion.data.repository.RoleplayConfig
import ai.mechon.companion.data.repository.RoleplayRepository
import ai.mechon.companion.data.repository.RoleplaySection
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID

data class RoleplayUiState(
    val config: RoleplayConfig = RoleplayConfig(),
    val presets: List<PromptPresetEntity> = emptyList(),
    val characters: List<CharacterEntity> = emptyList(),
    val activePreset: PromptPresetEntity? = null,
    val activeCharacter: CharacterEntity? = null,
    val isPreviewExpanded: Boolean = false,
    val isSaveDialogOpen: Boolean = false,
    val isPresetListOpen: Boolean = false,
    val isCharacterLibraryOpen: Boolean = false,
    val isAddCustomSectionOpen: Boolean = false,
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
        observeCharacters()
    }

    private fun observePresets() {
        viewModelScope.launch {
            roleplayRepository.getAllPresetsFlow().collectLatest { list ->
                val active = list.firstOrNull { it.isActive }
                _uiState.update { it.copy(presets = list, activePreset = active) }
            }
        }
    }

    private fun observeCharacters() {
        viewModelScope.launch {
            roleplayRepository.getAllCharactersFlow().collectLatest { list ->
                _uiState.update { it.copy(characters = list) }
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
            "world" -> current.copy(worldBuilding = current.worldBuilding.copy(content = content))
            "scenario" -> current.copy(scenario = current.scenario.copy(content = content))
            "user" -> current.copy(userPersona = current.userPersona.copy(content = content))
            "rules" -> current.copy(interactionRules = current.interactionRules.copy(content = content))
            "style" -> current.copy(narrativeStyle = current.narrativeStyle.copy(content = content))
            "additional" -> current.copy(additionalInstructions = current.additionalInstructions.copy(content = content))
            else -> {
                // Check custom sections
                val updatedCustom = current.customSections.map {
                    if (it.id == sectionId) it.copy(content = content) else it
                }
                current.copy(customSections = updatedCustom)
            }
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
            "world" -> current.copy(worldBuilding = current.worldBuilding.copy(isEnabled = !current.worldBuilding.isEnabled))
            "scenario" -> current.copy(scenario = current.scenario.copy(isEnabled = !current.scenario.isEnabled))
            "user" -> current.copy(userPersona = current.userPersona.copy(isEnabled = !current.userPersona.isEnabled))
            "rules" -> current.copy(interactionRules = current.interactionRules.copy(isEnabled = !current.interactionRules.isEnabled))
            "style" -> current.copy(narrativeStyle = current.narrativeStyle.copy(isEnabled = !current.narrativeStyle.isEnabled))
            "additional" -> current.copy(additionalInstructions = current.additionalInstructions.copy(isEnabled = !current.additionalInstructions.isEnabled))
            else -> {
                val updatedCustom = current.customSections.map {
                    if (it.id == sectionId) it.copy(isEnabled = !it.isEnabled) else it
                }
                current.copy(customSections = updatedCustom)
            }
        }
        _uiState.update { it.copy(config = updated) }
        updateComposedPreview(updated)
    }

    fun addCustomSection(title: String, content: String) {
        if (title.isBlank()) return
        val current = _uiState.value.config
        val newSection = RoleplaySection(
            id = "custom_" + UUID.randomUUID().toString().take(8),
            title = title.trim(),
            description = "Custom Roleplay Directive",
            isEnabled = true,
            content = content.trim(),
            isCustom = true
        )
        val updated = current.copy(customSections = current.customSections + newSection)
        _uiState.update { it.copy(config = updated, isAddCustomSectionOpen = false) }
        updateComposedPreview(updated)
    }

    fun deleteCustomSection(sectionId: String) {
        val current = _uiState.value.config
        val updated = current.copy(customSections = current.customSections.filter { it.id != sectionId })
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

    fun setCharacterLibraryOpen(open: Boolean) {
        _uiState.update { it.copy(isCharacterLibraryOpen = open) }
    }

    fun setAddCustomSectionOpen(open: Boolean) {
        _uiState.update { it.copy(isAddCustomSectionOpen = open) }
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

    fun saveAsCharacter(name: String, avatar: String, description: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            val char = roleplayRepository.saveCharacter(
                name = name,
                avatar = avatar.ifBlank { "🎭" },
                description = description,
                config = _uiState.value.config
            )
            _uiState.update {
                it.copy(
                    activeCharacter = char,
                    isCharacterLibraryOpen = false
                )
            }
        }
    }

    fun loadCharacter(character: CharacterEntity) {
        val parsed = roleplayRepository.parseConfig(character.sectionsJson)
        _uiState.update {
            it.copy(
                config = parsed,
                activeCharacter = character,
                isCharacterLibraryOpen = false
            )
        }
        updateComposedPreview(parsed)
    }

    fun duplicateCharacter(characterId: String) {
        viewModelScope.launch {
            roleplayRepository.duplicateCharacter(characterId)
        }
    }

    fun deleteCharacter(characterId: String) {
        viewModelScope.launch {
            roleplayRepository.deleteCharacter(characterId)
        }
    }

    fun createChatWithCurrentRoleplay(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val activeChar = _uiState.value.activeCharacter
            val title = activeChar?.name
                ?: _uiState.value.config.characterIdentity.content.lines().firstOrNull()?.take(30)
                ?: "Roleplay Session"

            val conv = chatRepository.createConversation(
                title = title.ifBlank { "Roleplay Session" },
                systemPrompt = _uiState.value.composedPromptPreview,
                characterId = activeChar?.id,
                characterName = activeChar?.name,
                characterAvatar = activeChar?.avatar
            )
            onCreated(conv.id)
        }
    }
}
