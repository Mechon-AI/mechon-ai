package ai.mechon.companion

import ai.mechon.companion.data.remote.ProviderModelItem
import ai.mechon.companion.data.remote.ProviderModelsResponse
import ai.mechon.companion.data.remote.RemoteModelItem
import ai.mechon.companion.data.remote.RemoteProviderItem
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

class ProviderModelDiscoveryTest {

    private val gson = Gson()

    @Test
    fun testParseDirectModelsJson() {
        val json = """
            {
                "models": [
                    {
                        "provider_id": "gemini",
                        "provider_name": "Google Gemini",
                        "model_id": "gemini-2.5-flash",
                        "supports_vision": true,
                        "supports_streaming": true,
                        "context_length": 1048576,
                        "is_available": true
                    }
                ],
                "default_provider": "gemini",
                "default_model": "gemini-2.5-flash"
            }
        """.trimIndent()

        val resp = gson.fromJson(json, ProviderModelsResponse::class.java)
        assertNotNull(resp)
        val normalized = resp.getNormalizedModels()
        assertEquals(1, normalized.size)
        assertEquals("gemini", normalized[0].providerId)
        assertEquals("gemini-2.5-flash", normalized[0].modelId)
        assertTrue(normalized[0].supportsVision)
        assertTrue(normalized[0].isAvailable)
    }

    @Test
    fun testSynthesizeModelsFromProvidersOnlyJson() {
        val json = """
            {
                "providers": [
                    {
                        "id": "gemini",
                        "name": "Google Gemini",
                        "provider_type": "gemini",
                        "is_active": true,
                        "has_api_key": true,
                        "default_model": "gemini-2.5-flash",
                        "models": [
                            {
                                "id": "gemini-2.5-flash",
                                "name": "gemini-2.5-flash",
                                "supports_vision": true,
                                "supports_streaming": true,
                                "context_length": 1048576
                            }
                        ]
                    }
                ]
            }
        """.trimIndent()

        val resp = gson.fromJson(json, ProviderModelsResponse::class.java)
        assertNotNull(resp)
        val normalized = resp.getNormalizedModels()
        assertEquals(1, normalized.size)
        assertEquals("gemini", normalized[0].providerId)
        assertEquals("Google Gemini", normalized[0].providerName)
        assertEquals("gemini-2.5-flash", normalized[0].modelId)
        assertTrue(normalized[0].supportsVision)
        assertTrue(normalized[0].isAvailable)
    }

    @Test
    fun testNullOrEmptyJsonDoesNotCrash() {
        val emptyJson = "{}"
        val resp = gson.fromJson(emptyJson, ProviderModelsResponse::class.java)
        assertNotNull(resp)
        val normalized = resp.getNormalizedModels()
        assertNotNull(normalized)
        assertTrue(normalized.isEmpty())
    }

    @Test
    fun testVisionDetectionForFlashAndGemini() {
        val json = """
            {
                "models": [
                    {
                        "provider_id": "gemini",
                        "provider_name": "Google Gemini",
                        "model_id": "gemini-2.5-pro",
                        "supports_vision": true
                    },
                    {
                        "provider_id": "openai",
                        "provider_name": "OpenAI",
                        "model_id": "gpt-4o",
                        "supports_vision": true
                    }
                ]
            }
        """.trimIndent()

        val resp = gson.fromJson(json, ProviderModelsResponse::class.java)
        val normalized = resp.getNormalizedModels()
        assertEquals(2, normalized.size)
        assertTrue(normalized[0].supportsVision)
        assertTrue(normalized[1].supportsVision)
    }
}
