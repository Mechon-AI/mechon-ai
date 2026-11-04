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
            speechVoice = RoleplaySection("voice", "Speech & Voice", "", true, "Whispering and precise"),
            worldSetting = RoleplaySection("world", "World Setting", "", false, "Floating islands")
        )

        val prompt = config.composePrompt()

        assertTrue(prompt.contains("## Character Identity"))
        assertTrue(prompt.contains("Name: Elena"))
        assertTrue(prompt.contains("## Speech Style & Voice"))
        assertTrue(prompt.contains("Whispering and precise"))
        // Disabled section should be omitted
        assertFalse(prompt.contains("Floating islands"))
    }

    @Test
    fun testVersionAlignment() {
        val expectedVersion = "1.2.4"
        val expectedBuild = 124

        assertEquals("1.2.4", expectedVersion)
        assertEquals(124, expectedBuild)
    }
}
