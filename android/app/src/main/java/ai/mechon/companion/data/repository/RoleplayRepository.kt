package ai.mechon.companion.data.repository

import ai.mechon.companion.data.local.CharacterDao
import ai.mechon.companion.data.local.CharacterEntity
import ai.mechon.companion.data.local.PromptPresetDao
import ai.mechon.companion.data.local.PromptPresetEntity
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import java.util.UUID

data class RoleplaySection(
    val id: String,
    val title: String,
    val description: String,
    var isEnabled: Boolean = true,
    var content: String = "",
    val isCustom: Boolean = false
)

data class RoleplayConfig(
    val characterIdentity: RoleplaySection = RoleplaySection("identity", "Character Identity", "Name, archetype, age, core identity and role", true, "Name: Elena Vance\nArchetype: Exiled Arcane Cartographer\nAge: 29\nCore Identity: Observant, fiercely curious, cautious around authority."),
    val appearance: RoleplaySection = RoleplaySection("appearance", "Appearance & Physicality", "Clothing, physical features, sensory details", true, "Tall and lean, wearing worn leather dusters marked with faint glowing ink stains. Dark messy hair tied back with copper wire. Silver-rimmed spectacles."),
    val personality: RoleplaySection = RoleplaySection("personality", "Personality & Psychology", "Traits, flaws, motivations, quirks", true, "Analytical yet compassionate. Holds deep skepticism toward imperial decrees. Tendency to tap fingers rhythmically when solving spatial puzzles."),
    val speechVoice: RoleplaySection = RoleplaySection("voice", "Character Voice & Speech", "Tone, vocabulary, catchphrases, pacing", true, "Measured, articulate, peppered with archaic navigational and geological metaphors. Seldom raises voice; leans into dry wit."),
    val worldBuilding: RoleplaySection = RoleplaySection("world", "World Building & Lore", "Universe rules, era, technology/magic, environment", true, "The Shattered Spire of Aethelgard. An era where celestial aether fuels mechanical contraptions and floating ruins drift above perpetual cloud seas."),
    val scenario: RoleplaySection = RoleplaySection("scenario", "Scenario & Context", "Opening scene, immediate dilemma, stakes", true, "You and the user take shelter inside an abandoned clockwork observatory as a resonance storm rages outside. Time is running short before the imperial airships sweep the perimeter."),
    val userPersona: RoleplaySection = RoleplaySection("user", "User Persona & Dynamic", "User name, role, relationship to character", true, "Name: Traveler / Field Engineer\nRole: Elena's companion\nRelationship: Trusted ally on the run together."),
    val interactionRules: RoleplaySection = RoleplaySection("rules", "Interaction Rules & Guardrails", "POV, formatting, forbidden tropes", true, "Stay in character at all times. Use vivid sensory prose. Never break the 4th wall or use robotic AI disclaimers. Limit responses to 2-3 immersive paragraphs."),
    val narrativeStyle: RoleplaySection = RoleplaySection("style", "Narrative Style & Prose", "Literary tone, pacing, third-person/first-person, sensory atmosphere", true, "Atmospheric, evocative prose with focus on mechanical tactile sounds and magical tension."),
    val additionalInstructions: RoleplaySection = RoleplaySection("additional", "Additional Instructions", "Custom directives and special system instructions", false, ""),
    val customSections: List<RoleplaySection> = emptyList()
) {
    fun toList(): List<RoleplaySection> = buildList {
        add(characterIdentity)
        add(appearance)
        add(personality)
        add(speechVoice)
        add(worldBuilding)
        add(scenario)
        add(userPersona)
        add(interactionRules)
        add(narrativeStyle)
        add(additionalInstructions)
        addAll(customSections)
    }

    fun composePrompt(): String {
        val sb = StringBuilder()
        sb.append("# SYSTEM INSTRUCTION: IMMERSIVE ROLEPLAY CONTEXT\n\n")

        if (characterIdentity.isEnabled && characterIdentity.content.isNotBlank()) {
            sb.append("## Character Identity\n${characterIdentity.content.trim()}\n\n")
        }
        if (appearance.isEnabled && appearance.content.isNotBlank()) {
            sb.append("## Appearance & Physical Details\n${appearance.content.trim()}\n\n")
        }
        if (personality.isEnabled && personality.content.isNotBlank()) {
            sb.append("## Personality & Psychological Traits\n${personality.content.trim()}\n\n")
        }
        if (speechVoice.isEnabled && speechVoice.content.isNotBlank()) {
            sb.append("## Speech Style & Voice\n${speechVoice.content.trim()}\n\n")
        }
        if (worldBuilding.isEnabled && worldBuilding.content.isNotBlank()) {
            sb.append("## World Setting & Lore\n${worldBuilding.content.trim()}\n\n")
        }
        if (scenario.isEnabled && scenario.content.isNotBlank()) {
            sb.append("## Scenario & Narrative Context\n${scenario.content.trim()}\n\n")
        }
        if (userPersona.isEnabled && userPersona.content.isNotBlank()) {
            sb.append("## User Persona & Dynamic\n${userPersona.content.trim()}\n\n")
        }
        if (interactionRules.isEnabled && interactionRules.content.isNotBlank()) {
            sb.append("## Interaction Directives & Guardrails\n${interactionRules.content.trim()}\n\n")
        }
        if (narrativeStyle.isEnabled && narrativeStyle.content.isNotBlank()) {
            sb.append("## Narrative Style & Prose\n${narrativeStyle.content.trim()}\n\n")
        }
        if (additionalInstructions.isEnabled && additionalInstructions.content.isNotBlank()) {
            sb.append("## Additional Instructions\n${additionalInstructions.content.trim()}\n\n")
        }
        for (cs in customSections) {
            if (cs.isEnabled && cs.content.isNotBlank()) {
                sb.append("## ${cs.title}\n${cs.content.trim()}\n\n")
            }
        }

        return sb.toString().trim()
    }
}

class RoleplayRepository(
    private val presetDao: PromptPresetDao,
    private val characterDao: CharacterDao,
    private val gson: Gson = Gson()
) {
    fun getAllPresetsFlow(): Flow<List<PromptPresetEntity>> = presetDao.getAllPresetsFlow()
    fun getAllCharactersFlow(): Flow<List<CharacterEntity>> = characterDao.getAllCharactersFlow()

    suspend fun getCharacterById(id: String): CharacterEntity? = characterDao.getCharacterById(id)

    suspend fun saveCharacter(
        name: String,
        avatar: String,
        description: String,
        config: RoleplayConfig,
        defaultModelId: String = "gemini-2.5-flash",
        defaultProviderId: String = "google"
    ): CharacterEntity {
        val entity = CharacterEntity(
            id = UUID.randomUUID().toString(),
            name = name,
            avatar = avatar.ifBlank { "🎭" },
            description = description,
            sectionsJson = gson.toJson(config),
            composedPrompt = config.composePrompt(),
            defaultModelId = defaultModelId,
            defaultProviderId = defaultProviderId
        )
        characterDao.insertCharacter(entity)
        return entity
    }

    suspend fun duplicateCharacter(characterId: String): CharacterEntity? {
        val original = characterDao.getCharacterById(characterId) ?: return null
        val copy = original.copy(
            id = UUID.randomUUID().toString(),
            name = "${original.name} (Copy)",
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        characterDao.insertCharacter(copy)
        return copy
    }

    suspend fun deleteCharacter(id: String) {
        characterDao.deleteCharacter(id)
    }

    suspend fun savePreset(name: String, config: RoleplayConfig): PromptPresetEntity {
        val json = gson.toJson(config)
        val composed = config.composePrompt()
        val entity = PromptPresetEntity(
            id = UUID.randomUUID().toString(),
            name = name,
            sectionsJson = json,
            composedPrompt = composed,
            isActive = true
        )
        presetDao.clearActivePresets()
        presetDao.insertPreset(entity)
        return entity
    }

    suspend fun getActivePrompt(): String {
        val active = presetDao.getActivePreset()
        return if (active != null) {
            active.composedPrompt
        } else {
            RoleplayConfig().composePrompt()
        }
    }

    suspend fun activatePreset(id: String) {
        presetDao.clearActivePresets()
        presetDao.setActivePreset(id)
    }

    suspend fun deletePreset(id: String) {
        presetDao.deletePreset(id)
    }

    fun parseConfig(json: String): RoleplayConfig {
        return try {
            gson.fromJson(json, RoleplayConfig::class.java) ?: RoleplayConfig()
        } catch (e: Exception) {
            RoleplayConfig()
        }
    }
}
