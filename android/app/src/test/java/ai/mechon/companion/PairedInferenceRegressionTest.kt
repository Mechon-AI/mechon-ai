package ai.mechon.companion

import ai.mechon.companion.data.remote.ChatInferenceRequest
import ai.mechon.companion.data.remote.ChatInferenceResponse
import ai.mechon.companion.data.remote.ChatMessagePayload
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

class PairedInferenceRegressionTest {

    private val gson = Gson()

    @Test
    fun testChatInferenceRequestSerializesCorrectly() {
        // ChatInferenceRequest now sends only "model" (no duplicate "model_id") to avoid
        // HTTP 422 "duplicate field `model`" on the Rust gateway side.
        val req = ChatInferenceRequest(
            model = "gemini-2.5-flash",
            providerId = "gemini",
            messages = listOf(
                ChatMessagePayload(role = "user", content = "Test prompt")
            ),
            systemPrompt = "You are Mechon AI assistant",
            temperature = 0.7,
            maxTokens = 2048,
            webSearchEnabled = false
        )

        val json = gson.toJson(req)
        assertTrue("Must include model field", json.contains("\"model\":\"gemini-2.5-flash\""))
        assertTrue("Must include provider_id field", json.contains("\"provider_id\":\"gemini\""))
        assertTrue("Must include user message", json.contains("Test prompt"))
        // Verify no duplicate model_id key that caused HTTP 422
        assertFalse("Must NOT send duplicate model_id field", json.contains("\"model_id\""))
    }

    @Test
    fun testChatInferenceResponseDeserialization() {
        val json = """
            {
                "role": "assistant",
                "content": "Hello! I am ready to assist you.",
                "model": "gemini-2.5-flash",
                "provider_id": "gemini",
                "finish_reason": "stop"
            }
        """.trimIndent()

        val resp = gson.fromJson(json, ChatInferenceResponse::class.java)
        assertEquals("assistant", resp.role)
        assertEquals("Hello! I am ready to assist you.", resp.content)
        assertEquals("gemini-2.5-flash", resp.modelId)
        assertEquals("gemini", resp.providerId)
    }
}
