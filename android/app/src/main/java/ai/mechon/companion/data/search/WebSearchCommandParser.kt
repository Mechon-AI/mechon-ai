package ai.mechon.companion.data.search

object WebSearchCommandParser {
    private val COMMAND_PREFIXES = listOf(
        "@Web Search",
        "@web search",
        "@websearch",
        "@WebSearch",
        "@search",
        "@Search"
    )

    fun isWebSearchCommand(input: String): Boolean {
        val trimmed = input.trim()
        return COMMAND_PREFIXES.any { prefix ->
            trimmed.equals(prefix, ignoreCase = true) ||
            trimmed.startsWith("$prefix ", ignoreCase = true)
        }
    }

    fun extractQuery(input: String): String {
        val trimmed = input.trim()
        for (prefix in COMMAND_PREFIXES) {
            if (trimmed.startsWith(prefix, ignoreCase = true)) {
                return trimmed.substring(prefix.length).trim()
            }
        }
        return trimmed
    }

    fun shouldShowAutocomplete(input: String): Boolean {
        val trimmed = input.trim()
        if (trimmed == "@" || trimmed == "@w" || trimmed == "@W" || trimmed == "@web" || trimmed == "@Web" || trimmed == "@s" || trimmed == "@S") {
            return true
        }
        return false
    }
}
