package ai.mechon.companion

import ai.mechon.companion.data.search.WebSearchCommandParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebSearchCommandParserTest {

    @Test
    fun testWebSearchCommandDetection() {
        assertTrue(WebSearchCommandParser.isWebSearchCommand("@Web Search quantum computing"))
        assertTrue(WebSearchCommandParser.isWebSearchCommand("@web search quantum computing"))
        assertTrue(WebSearchCommandParser.isWebSearchCommand("@websearch latest news"))
        assertTrue(WebSearchCommandParser.isWebSearchCommand("@WebSearch latest news"))
        assertTrue(WebSearchCommandParser.isWebSearchCommand("@search kotlin 2.0"))
        assertTrue(WebSearchCommandParser.isWebSearchCommand("@Search kotlin 2.0"))

        assertFalse(WebSearchCommandParser.isWebSearchCommand("Hello world"))
        assertFalse(WebSearchCommandParser.isWebSearchCommand("Who won the game?"))
        assertFalse(WebSearchCommandParser.isWebSearchCommand("email@domain.com"))
    }

    @Test
    fun testQueryExtraction() {
        assertEquals("quantum computing in 2026", WebSearchCommandParser.extractQuery("@Web Search quantum computing in 2026"))
        assertEquals("latest ai models", WebSearchCommandParser.extractQuery("@web search   latest ai models  "))
        assertEquals("deep learning benchmarks", WebSearchCommandParser.extractQuery("@websearch deep learning benchmarks"))
        assertEquals("fastest rust web framework", WebSearchCommandParser.extractQuery("@search fastest rust web framework"))
        assertEquals("", WebSearchCommandParser.extractQuery("@Web Search"))
    }

    @Test
    fun testAutocompleteTrigger() {
        assertTrue(WebSearchCommandParser.shouldShowAutocomplete("@"))
        assertTrue(WebSearchCommandParser.shouldShowAutocomplete("@w"))
        assertTrue(WebSearchCommandParser.shouldShowAutocomplete("@W"))
        assertTrue(WebSearchCommandParser.shouldShowAutocomplete("@web"))
        assertTrue(WebSearchCommandParser.shouldShowAutocomplete("@Web"))
        assertTrue(WebSearchCommandParser.shouldShowAutocomplete("@s"))

        assertFalse(WebSearchCommandParser.shouldShowAutocomplete("@Web Search something"))
        assertFalse(WebSearchCommandParser.shouldShowAutocomplete("Hello @friend"))
        assertFalse(WebSearchCommandParser.shouldShowAutocomplete(""))
    }
}
