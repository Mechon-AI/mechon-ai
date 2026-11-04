package ai.mechon.companion

import ai.mechon.companion.data.search.*
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class WebSearchAdaptersTest {

    private lateinit var mockWebServer: MockWebServer

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun testTavilyAdapterSuccess() = runBlocking {
        val serverUrl = mockWebServer.url("/search").toString()
        val jsonResponse = """
            {
              "results": [
                {
                  "title": "Quantum Computing 2026",
                  "url": "https://example.com/quantum",
                  "content": "Major milestones reached in error correction.",
                  "score": 0.98,
                  "published_date": "2026-10-15"
                }
              ]
            }
        """.trimIndent()

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(jsonResponse))

        val adapter = TavilySearchAdapter()
        val config = WebSearchConfig(
            provider = SearchProviderType.TAVILY,
            apiKey = "tvly-test-key",
            endpoint = serverUrl,
            timeoutSeconds = 5,
            maxResults = 3
        )

        val result = adapter.search("quantum error correction", config)
        assertTrue(result.isSuccess)
        val list = result.getOrNull()
        assertNotNull(list)
        assertEquals(1, list?.size)
        val item = list!![0]
        assertEquals("Quantum Computing 2026", item.title)
        assertEquals("https://example.com/quantum", item.url)
        assertEquals("example.com", item.domain)
        assertEquals("Major milestones reached in error correction.", item.snippet)
        assertEquals(0.98, item.score ?: 0.0, 0.001)

        val recorded = mockWebServer.takeRequest()
        assertEquals("POST", recorded.method)
        assertTrue(recorded.body.readUtf8().contains("tvly-test-key"))
    }

    @Test
    fun testBraveAdapterSuccess() = runBlocking {
        val serverUrl = mockWebServer.url("/res/v1/web/search").toString()
        val jsonResponse = """
            {
              "web": {
                "results": [
                  {
                    "title": "Kotlin 2.0 Released",
                    "url": "https://kotlinlang.org/releases/2.0",
                    "description": "The K2 compiler is now stable by default.",
                    "page_age": "2026-05-21"
                  }
                ]
              }
            }
        """.trimIndent()

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(jsonResponse))

        val adapter = BraveSearchAdapter()
        val config = WebSearchConfig(
            provider = SearchProviderType.BRAVE,
            apiKey = "brave-token-xyz",
            endpoint = serverUrl,
            timeoutSeconds = 5,
            maxResults = 5
        )

        val result = adapter.search("kotlin 2.0 release", config)
        assertTrue(result.isSuccess)
        val list = result.getOrNull()
        assertNotNull(list)
        assertEquals(1, list?.size)
        val item = list!![0]
        assertEquals("Kotlin 2.0 Released", item.title)
        assertEquals("kotlinlang.org", item.domain)

        val recorded = mockWebServer.takeRequest()
        assertEquals("GET", recorded.method)
        assertEquals("brave-token-xyz", recorded.getHeader("X-Subscription-Token"))
        assertTrue(recorded.path!!.contains("q=kotlin+2.0+release") || recorded.path!!.contains("q=kotlin%202.0%20release"))
    }

    @Test
    fun testSerpApiAdapterSuccess() = runBlocking {
        val serverUrl = mockWebServer.url("/search.json").toString()
        val jsonResponse = """
            {
              "organic_results": [
                {
                  "title": "DeepSeek V3 Benchmarks",
                  "link": "https://deepseek.ai/v3-benchmarks",
                  "snippet": "Multi-head latent attention architecture details.",
                  "date": "2026-01-10"
                }
              ]
            }
        """.trimIndent()

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(jsonResponse))

        val adapter = SerpApiAdapter()
        val config = WebSearchConfig(
            provider = SearchProviderType.SERPAPI,
            apiKey = "serpapi-key-123",
            endpoint = serverUrl,
            timeoutSeconds = 5,
            maxResults = 5
        )

        val result = adapter.search("deepseek v3", config)
        assertTrue(result.isSuccess)
        val list = result.getOrNull()
        assertNotNull(list)
        assertEquals(1, list?.size)
        val item = list!![0]
        assertEquals("DeepSeek V3 Benchmarks", item.title)
        assertEquals("deepseek.ai", item.domain)

        val recorded = mockWebServer.takeRequest()
        assertEquals("GET", recorded.method)
        assertTrue(recorded.path!!.contains("api_key=serpapi-key-123"))
    }

    @Test
    fun testSearxngAdapterSuccess() = runBlocking {
        val serverUrl = mockWebServer.url("/search").toString()
        val jsonResponse = """
            {
              "results": [
                {
                  "title": "Self-Hosted Privacy Engine",
                  "url": "https://searx.github.io",
                  "content": "A privacy-respecting metasearch engine.",
                  "publishedDate": "2026-03-01"
                }
              ]
            }
        """.trimIndent()

        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody(jsonResponse))

        val adapter = SearxngAdapter()
        val config = WebSearchConfig(
            provider = SearchProviderType.SEARXNG,
            apiKey = "",
            endpoint = serverUrl,
            timeoutSeconds = 5,
            maxResults = 5
        )

        val result = adapter.search("searxng documentation", config)
        assertTrue(result.isSuccess)
        val list = result.getOrNull()
        assertNotNull(list)
        assertEquals(1, list?.size)
        val item = list!![0]
        assertEquals("Self-Hosted Privacy Engine", item.title)
        assertEquals("searx.github.io", item.domain)
    }

    @Test
    fun testDomainExtraction() {
        assertEquals("github.com", WebSearchResult.extractDomain("https://github.com/torvalds/linux"))
        assertEquals("docs.rs", WebSearchResult.extractDomain("http://docs.rs/tokio/1.0/index.html"))
        assertEquals("100.127.109.78", WebSearchResult.extractDomain("http://100.127.109.78:38475/api/v1/ping"))
    }

    @Test
    fun testGroundingPromptFormatting() {
        val results = listOf(
            WebSearchResult(
                title = "Android 15 Page Size",
                url = "https://developer.android.com/16kb",
                snippet = "Android 15 supports 16 KB page sizes.",
                domain = "developer.android.com",
                publishedDate = "2026"
            )
        )
        val prompt = WebSearchManager.formatGroundingPrompt("16kb page size", results)
        assertTrue(prompt.contains("[EXTERNAL GROUNDING - LIVE WEB SEARCH RESULTS FOR: \"16kb page size\"]"))
        assertTrue(prompt.contains("Source [1]: Android 15 Page Size (developer.android.com)"))
        assertTrue(prompt.contains("URL: https://developer.android.com/16kb"))
        assertTrue(prompt.contains("Excerpt: Android 15 supports 16 KB page sizes."))
        assertTrue(prompt.contains("[END SEARCH RESULTS]"))
    }
}
