package ai.mechon.companion

import ai.mechon.companion.data.repository.RoleplayConfig
import ai.mechon.companion.data.repository.RoleplaySection
import org.junit.Assert.*
import org.junit.Test

class RoleplayRepositoryTest {

    @Test
    fun testRoleplayPromptCompositionIncludesActiveSections() {
        val config = RoleplayConfig(
            characterIdentity = RoleplaySection("identity", "Character Identity", "", true, "Name: Elena\nArchetype: Cartographer"),
            speechVoice = RoleplaySection("voice", "Character Voice & Speech", "", true, "Whispering and precise"),
            worldBuilding = RoleplaySection("world", "World Building", "", false, "Floating islands"),
            narrativeStyle = RoleplaySection("style", "Narrative Style", "", true, "Rich tactile prose")
        )

        val prompt = config.composePrompt()

        assertTrue(prompt.contains("## Character Identity"))
        assertTrue(prompt.contains("Name: Elena"))
        assertTrue(prompt.contains("## Speech Style & Voice"))
        assertTrue(prompt.contains("Whispering and precise"))
        assertTrue(prompt.contains("## Narrative Style & Prose"))
        assertTrue(prompt.contains("Rich tactile prose"))
        // Disabled section should be omitted
        assertFalse(prompt.contains("Floating islands"))
    }

    @Test
    fun testCustomSectionsInRoleplay() {
        val custom = listOf(
            RoleplaySection("c1", "Forbidden Knowledge", "", true, "Do not speak of the Void engine.", isCustom = true)
        )
        val config = RoleplayConfig(customSections = custom)
        val prompt = config.composePrompt()
        assertTrue(prompt.contains("## Forbidden Knowledge"))
        assertTrue(prompt.contains("Do not speak of the Void engine."))
    }

    @Test
    fun testVersionAlignment() {
        val expectedVersion = "1.2.5"
        val expectedBuild = 125

        assertEquals("1.2.5", expectedVersion)
        assertEquals(125, expectedBuild)
    }
}
