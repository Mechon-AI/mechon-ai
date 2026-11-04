package ai.mechon.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import ai.mechon.companion.ui.navigation.Screen
import ai.mechon.companion.ui.screens.chat.ChatScreen
import ai.mechon.companion.ui.screens.chat.ChatViewModel
import ai.mechon.companion.ui.screens.conversations.ConversationsScreen
import ai.mechon.companion.ui.screens.conversations.ConversationsViewModel
import ai.mechon.companion.ui.screens.pairing.PairingScreen
import ai.mechon.companion.ui.screens.pairing.PairingViewModel
import ai.mechon.companion.ui.screens.roleplay.RoleplayStudioScreen
import ai.mechon.companion.ui.screens.roleplay.RoleplayViewModel
import ai.mechon.companion.ui.screens.settings.SettingsScreen
import ai.mechon.companion.ui.theme.MechonDarkBg
import ai.mechon.companion.ui.theme.MechonTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val app = application as MechonApplication

        setContent {
            MechonTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MechonDarkBg
                ) {
                    val navController = rememberNavController()

                    NavHost(
                        navController = navController,
                        startDestination = "chat"
                    ) {
                        // Main Chat Screen (Primary UI)
                        composable(
                            route = Screen.Chat.route,
                            arguments = listOf(
                                navArgument("conversationId") {
                                    type = NavType.StringType
                                    nullable = true
                                    defaultValue = null
                                }
                            )
                        ) { backStackEntry ->
                            val convId = backStackEntry.arguments?.getString("conversationId")
                            val vm: ChatViewModel = viewModel(
                                factory = object : ViewModelProvider.Factory {
                                    @Suppress("UNCHECKED_CAST")
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        return ChatViewModel(
                                            chatRepository = app.chatRepository,
                                            roleplayRepository = app.roleplayRepository,
                                            syncRepository = app.syncRepository,
                                            desktopApiClient = app.desktopApiClient,
                                            sessionManager = app.sessionManager
                                        ) as T
                                    }
                                }
                            )
                            ChatScreen(
                                viewModel = vm,
                                conversationId = convId,
                                onNavigateToRoleplay = {
                                    navController.navigate(Screen.Roleplay.route)
                                },
                                onNavigateToPairing = {
                                    navController.navigate(Screen.Pairing.route)
                                },
                                onNavigateToSettings = {
                                    navController.navigate(Screen.Settings.route)
                                },
                                onNavigateToHistory = {
                                    navController.navigate(Screen.Conversations.route)
                                }
                            )
                        }

                        // Conversation History Screen
                        composable(Screen.Conversations.route) {
                            val vm: ConversationsViewModel = viewModel(
                                factory = object : ViewModelProvider.Factory {
                                    @Suppress("UNCHECKED_CAST")
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        return ConversationsViewModel(
                                            chatRepository = app.chatRepository,
                                            syncRepository = app.syncRepository,
                                            sessionManager = app.sessionManager
                                        ) as T
                                    }
                                }
                            )
                            ConversationsScreen(
                                viewModel = vm,
                                onConversationSelected = { id ->
                                    navController.navigate(Screen.Chat.createRoute(id)) {
                                        popUpTo(Screen.Chat.route) { inclusive = true }
                                    }
                                },
                                onNavigateToChat = {
                                    navController.navigate(Screen.Chat.createRoute(null)) {
                                        popUpTo(Screen.Chat.route) { inclusive = true }
                                    }
                                },
                                onNavigateToPairing = {
                                    navController.navigate(Screen.Pairing.route)
                                },
                                onNavigateToSettings = {
                                    navController.navigate(Screen.Settings.route)
                                }
                            )
                        }

                        // Roleplay Studio Screen
                        composable(Screen.Roleplay.route) {
                            val vm: RoleplayViewModel = viewModel(
                                factory = object : ViewModelProvider.Factory {
                                    @Suppress("UNCHECKED_CAST")
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        return RoleplayViewModel(
                                            roleplayRepository = app.roleplayRepository,
                                            chatRepository = app.chatRepository
                                        ) as T
                                    }
                                }
                            )
                            RoleplayStudioScreen(
                                viewModel = vm,
                                onNavigateBack = { navController.popBackStack() },
                                onNavigateToChat = { convId ->
                                    navController.navigate("chat?conversationId=$convId")
                                }
                            )
                        }

                        // Desktop Pairing Screen (Auto LAN Discovery + Approval + QR Fallback)
                        composable(Screen.Pairing.route) {
                            val vm: PairingViewModel = viewModel(
                                factory = object : ViewModelProvider.Factory {
                                    @Suppress("UNCHECKED_CAST")
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        return PairingViewModel(
                                            sessionManager = app.sessionManager,
                                            desktopApiClient = app.desktopApiClient,
                                            lanDiscoveryService = app.lanDiscoveryService
                                        ) as T
                                    }
                                }
                            )
                            PairingScreen(
                                viewModel = vm,
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }

                        // Settings Screen
                        composable(Screen.Settings.route) {
                            SettingsScreen(
                                sessionManager = app.sessionManager,
                                desktopApiClient = app.desktopApiClient,
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }
}
