package ai.mechon.companion.data.repository

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
    var content: String = ""
)

data class RoleplayConfig(
    val characterIdentity: RoleplaySection = RoleplaySection("identity", "Character Identity", "Name, archetype, age, core identity and role", true, "Name: Elena Vance\nArchetype: Exiled Arcane Cartographer\nAge: 29\nCore Identity: Observant, fiercely curious, cautious around authority."),
    val appearance: RoleplaySection = RoleplaySection("appearance", "Appearance & Physicality", "Clothing, physical features, sensory details", true, "Tall and lean, wearing worn leather dusters marked with faint glowing ink stains. Dark messy hair tied back with copper wire. Silver-rimmed spectacles."),
    val personality: RoleplaySection = RoleplaySection("personality", "Personality & Psychology", "Traits, flaws, motivations, quirks", true, "Analytical yet compassionate. Holds deep skepticism toward imperial decrees. Tendency to tap fingers rhythmically when solving spatial puzzles."),
    val speechVoice: RoleplaySection = RoleplaySection("voice", "Speech & Voice", "Tone, vocabulary, catchphrases, pacing", true, "Measured, articulate, peppered with archaic navigational and geological metaphors. Seldom raises voice; leans into dry wit."),
    val worldSetting: RoleplaySection = RoleplaySection("world", "World Setting & Lore", "Universe rules, era, technology/magic, environment", true, "The Shattered Spire of Aethelgard. An era where celestial aether fuels mechanical contraptions and floating ruins drift above perpetual cloud seas."),
    val scenarioContext: RoleplaySection = RoleplaySection("scenario", "Scenario & Context", "Opening scene, immediate dilemma, stakes", true, "You and the user take shelter inside an abandoned clockwork observatory as a resonance storm rages outside. Time is running short before the imperial airships sweep the perimeter."),
    val userPersona: RoleplaySection = RoleplaySection("user", "User Persona", "User name, role, relationship to character", true, "Name: Traveler / Field Engineer\nRole: Elena's companion\nRelationship: Trusted ally on the run together."),
    val rulesGuardrails: RoleplaySection = RoleplaySection("rules", "Interaction Rules & Guardrails", "POV, formatting, forbidden tropes", true, "Stay in character at all times. Use vivid sensory prose. Never break the 4th wall or use robotic AI disclaimers. Limit responses to 2-3 immersive paragraphs."),
    val customDirectives: RoleplaySection = RoleplaySection("custom", "Custom Directives", "Raw system prompt overrides", false, "")
) {
    fun toList(): List<RoleplaySection> = listOf(
        characterIdentity,
        appearance,
        personality,
        speechVoice,
        worldSetting,
        scenarioContext,
        userPersona,
        rulesGuardrails,
        customDirectives
    )

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
        if (worldSetting.isEnabled && worldSetting.content.isNotBlank()) {
            sb.append("## World Setting & Lore\n${worldSetting.content.trim()}\n\n")
        }
        if (scenarioContext.isEnabled && scenarioContext.content.isNotBlank()) {
            sb.append("## Scenario & Narrative Context\n${scenarioContext.content.trim()}\n\n")
        }
        if (userPersona.isEnabled && userPersona.content.isNotBlank()) {
            sb.append("## User Persona & Dynamic\n${userPersona.content.trim()}\n\n")
        }
        if (rulesGuardrails.isEnabled && rulesGuardrails.content.isNotBlank()) {
            sb.append("## Interaction Directives & Guardrails\n${rulesGuardrails.content.trim()}\n\n")
        }
        if (customDirectives.isEnabled && customDirectives.content.isNotBlank()) {
            sb.append("## Additional Custom Directives\n${customDirectives.content.trim()}\n\n")
        }

        return sb.toString().trim()
    }
}

class RoleplayRepository(
    private val presetDao: PromptPresetDao,
    private val gson: Gson = Gson()
) {
    fun getAllPresetsFlow(): Flow<List<PromptPresetEntity>> = presetDao.getAllPresetsFlow()

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
