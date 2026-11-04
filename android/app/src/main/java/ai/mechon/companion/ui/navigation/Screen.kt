package ai.mechon.companion.ui.navigation

sealed class Screen(val route: String, val title: String) {
    object Chat : Screen("chat?conversationId={conversationId}", "Chat") {
        fun createRoute(conversationId: String?) =
            if (conversationId != null) "chat?conversationId=$conversationId" else "chat"
    }
    object Conversations : Screen("conversations", "Conversations")
    object Roleplay : Screen("roleplay", "Roleplay Studio")
    object Pairing : Screen("pairing", "Desktop Pairing")
    object Transfers : Screen("transfers", "Transfer History")
    object Settings : Screen("settings", "Settings")
}
