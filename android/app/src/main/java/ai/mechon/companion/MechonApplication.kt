package ai.mechon.companion

import android.app.Application
import ai.mechon.companion.data.local.AppDatabase
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.LanDiscoveryService
import ai.mechon.companion.data.remote.SessionManager
import ai.mechon.companion.data.repository.ChatRepository
import ai.mechon.companion.data.repository.RoleplayRepository
import ai.mechon.companion.data.repository.SyncRepository
import ai.mechon.companion.data.search.WebSearchManager

class MechonApplication : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var sessionManager: SessionManager
        private set

    lateinit var desktopApiClient: DesktopApiClient
        private set

    lateinit var lanDiscoveryService: LanDiscoveryService
        private set

    lateinit var tailscaleManager: ai.mechon.companion.data.remote.TailscaleManager
        private set

    lateinit var connectionManager: ai.mechon.companion.data.remote.ConnectionManager
        private set

    lateinit var webSearchManager: WebSearchManager
        private set

    lateinit var chatRepository: ChatRepository
        private set

    lateinit var roleplayRepository: RoleplayRepository
        private set

    lateinit var syncRepository: SyncRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        database = AppDatabase.getInstance(this)
        sessionManager = SessionManager(this)
        desktopApiClient = DesktopApiClient(sessionManager)
        lanDiscoveryService = LanDiscoveryService(this)
        tailscaleManager = ai.mechon.companion.data.remote.TailscaleManager(this, desktopApiClient, sessionManager)
        connectionManager = ai.mechon.companion.data.remote.ConnectionManager(this, sessionManager, desktopApiClient, tailscaleManager)
        webSearchManager = WebSearchManager(this)

        chatRepository = ChatRepository(
            conversationDao = database.conversationDao(),
            messageDao = database.messageDao(),
            desktopApiClient = desktopApiClient,
            sessionManager = sessionManager
        )

        roleplayRepository = RoleplayRepository(
            presetDao = database.promptPresetDao(),
            characterDao = database.characterDao()
        )

        syncRepository = SyncRepository(
            conversationDao = database.conversationDao(),
            messageDao = database.messageDao(),
            desktopApiClient = desktopApiClient
        )
    }

    companion object {
        lateinit var instance: MechonApplication
            private set
    }
}
