package ai.mechon.companion.data.remote

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket

enum class ConnectionState {
    DISCONNECTED,
    DISCOVERING,
    SERVER_FOUND,
    PAIRING_REQUESTED,
    AWAITING_APPROVAL,
    APPROVED,
    AUTHENTICATING,
    CONNECTING,
    CONNECTED,
    SYNCHRONIZING,
    READY,
    DEGRADED,
    RECONNECTING,
    ERROR
}

data class ConnectionDiagnostics(
    val state: ConnectionState = ConnectionState.DISCONNECTED,
    val transport: String = "None",
    val targetEndpoint: String = "",
    val desktopVersion: String = "",
    val desktopName: String = "",
    val isTcpConnected: Boolean = false,
    val isAuthenticated: Boolean = false,
    val isIdentityVerified: Boolean = false,
    val isHealthOk: Boolean = false,
    val isCapabilitiesOk: Boolean = false,
    val activeProvidersCount: Int = 0,
    val availableModelsCount: Int = 0,
    val latencyMs: Long = 0,
    val lastError: String? = null,
    val lastCheckTimestamp: Long = 0,
    val isChecking: Boolean = false
) {
    val isReady: Boolean
        get() = state == ConnectionState.READY
}

class ConnectionManager(
    private val context: Context,
    private val sessionManager: SessionManager,
    private val desktopApiClient: DesktopApiClient,
    private val tailscaleManager: TailscaleManager,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default)
) {
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _diagnostics = MutableStateFlow(ConnectionDiagnostics())
    val diagnostics: StateFlow<ConnectionDiagnostics> = _diagnostics.asStateFlow()

    private var reconnectJob: Job? = null
    private var verificationJob: Job? = null
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    init {
        registerNetworkCallback()
    }

    private fun registerNetworkCallback() {
        try {
            connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    if (sessionManager.isPaired && _connectionState.value != ConnectionState.READY) {
                        triggerReconnect(immediate = true)
                    }
                }

                override fun onLost(network: Network) {
                    if (_connectionState.value == ConnectionState.READY) {
                        _connectionState.value = ConnectionState.RECONNECTING
                        _diagnostics.update { it.copy(state = ConnectionState.RECONNECTING, lastError = "Network connection lost") }
                        triggerReconnect(immediate = false)
                    }
                }
            }

            connectivityManager?.registerNetworkCallback(request, networkCallback!!)
        } catch (e: Exception) {
            // Callback registration may fail in unit test environments without shadow
        }
    }

    fun triggerReconnect(immediate: Boolean = false) {
        if (!sessionManager.isPaired) return
        if (reconnectJob?.isActive == true && !immediate) return

        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            var backoffMs = if (immediate) 0L else 2000L
            val maxBackoffMs = 30000L

            while (isActive) {
                if (backoffMs > 0) {
                    _connectionState.value = ConnectionState.RECONNECTING
                    _diagnostics.update { it.copy(state = ConnectionState.RECONNECTING) }
                    delay(backoffMs)
                }

                val diag = runVerificationPipeline()
                if (diag.state == ConnectionState.READY) {
                    break
                }

                // Exponential backoff: 2s -> 4s -> 8s -> 16s -> 30s
                backoffMs = if (backoffMs == 0L) 2000L else (backoffMs * 2).coerceAtMost(maxBackoffMs)
            }
        }
    }

    fun setState(newState: ConnectionState) {
        _connectionState.value = newState
        _diagnostics.update { it.copy(state = newState) }
    }

    suspend fun runVerificationPipeline(targetUrl: String? = null): ConnectionDiagnostics = withContext(Dispatchers.IO) {
        val url = (targetUrl ?: sessionManager.desktopUrl).trimEnd('/')
        val token = sessionManager.authToken

        val transportType = if (sessionManager.isTailscale || url.contains(".ts.net") || url.contains("://100.")) {
            "Tailscale Mesh"
        } else {
            "LAN"
        }

        _diagnostics.update {
            it.copy(
                isChecking = true,
                targetEndpoint = url,
                transport = transportType,
                lastError = null
            )
        }

        if (token.isNullOrBlank()) {
            val diag = ConnectionDiagnostics(
                state = ConnectionState.DISCONNECTED,
                transport = transportType,
                targetEndpoint = url,
                lastError = "Device is not paired. Token missing.",
                lastCheckTimestamp = System.currentTimeMillis(),
                isChecking = false
            )
            _connectionState.value = ConnectionState.DISCONNECTED
            _diagnostics.value = diag
            return@withContext diag
        }

        val startTime = System.currentTimeMillis()

        // 1. TCP Check
        _connectionState.value = ConnectionState.CONNECTING
        val uri = try { java.net.URI.create(url) } catch (e: Exception) { null }
        val host = uri?.host ?: "127.0.0.1"
        val port = if (uri != null && uri.port != -1) uri.port else 38475

        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), 3000)
            }
        } catch (e: Exception) {
            val latency = System.currentTimeMillis() - startTime
            val diag = ConnectionDiagnostics(
                state = ConnectionState.ERROR,
                transport = transportType,
                targetEndpoint = url,
                isTcpConnected = false,
                latencyMs = latency,
                lastError = "TCP connect to $host:$port failed: ${e.message}",
                lastCheckTimestamp = System.currentTimeMillis(),
                isChecking = false
            )
            _connectionState.value = ConnectionState.ERROR
            _diagnostics.value = diag
            return@withContext diag
        }

        // 2-4. Health & Session Auth Verification
        _connectionState.value = ConnectionState.AUTHENTICATING
        val healthRes = desktopApiClient.verifySession(url, token)
        val latency = System.currentTimeMillis() - startTime

        if (healthRes.isFailure) {
            val err = healthRes.exceptionOrNull()
            val state = when (err) {
                is PairingRevokedException -> ConnectionState.ERROR
                is InvalidTokenException -> ConnectionState.ERROR
                else -> ConnectionState.RECONNECTING
            }
            val diag = ConnectionDiagnostics(
                state = state,
                transport = transportType,
                targetEndpoint = url,
                isTcpConnected = true,
                isAuthenticated = false,
                latencyMs = latency,
                lastError = err?.message ?: "Application authentication failed",
                lastCheckTimestamp = System.currentTimeMillis(),
                isChecking = false
            )
            _connectionState.value = state
            _diagnostics.value = diag
            return@withContext diag
        }

        val health = healthRes.getOrThrow()
        _connectionState.value = ConnectionState.CONNECTED

        // 5. Capabilities Check
        _connectionState.value = ConnectionState.SYNCHRONIZING
        val capsRes = desktopApiClient.getCapabilities()
        val capsOk = capsRes.isSuccess

        // 6. Providers Check
        val provRes = desktopApiClient.getProviders()
        val provList = provRes.getOrNull() ?: emptyList()
        val activeProviders = provList.count { it.isActive }

        // 7. Models Check
        val modelsRes = desktopApiClient.getProviderModels()
        val modelsList = modelsRes.getOrNull()?.models ?: emptyList()
        val availableModels = modelsList.count { it.isActive }

        val finalLatency = System.currentTimeMillis() - startTime

        val finalState = if (activeProviders > 0 && availableModels > 0) {
            ConnectionState.READY
        } else if (activeProviders == 0) {
            ConnectionState.DEGRADED
        } else {
            ConnectionState.DEGRADED
        }

        val finalDiag = ConnectionDiagnostics(
            state = finalState,
            transport = transportType,
            targetEndpoint = url,
            desktopVersion = health.version,
            desktopName = health.desktopName ?: sessionManager.desktopName ?: "Mechon Desktop",
            isTcpConnected = true,
            isAuthenticated = true,
            isIdentityVerified = health.deviceId != null,
            isHealthOk = true,
            isCapabilitiesOk = capsOk,
            activeProvidersCount = activeProviders.coerceAtLeast(health.activeProvidersCount),
            availableModelsCount = availableModels.coerceAtLeast(health.availableModelsCount),
            latencyMs = finalLatency,
            lastError = if (finalState == ConnectionState.DEGRADED) "Connected, but no active providers or models configured on desktop." else null,
            lastCheckTimestamp = System.currentTimeMillis(),
            isChecking = false
        )

        _connectionState.value = finalState
        _diagnostics.value = finalDiag
        sessionManager.isSessionVerified = (finalState == ConnectionState.READY)

        finalDiag
    }

    fun cleanUp() {
        reconnectJob?.cancel()
        verificationJob?.cancel()
        try {
            if (connectivityManager != null && networkCallback != null) {
                connectivityManager?.unregisterNetworkCallback(networkCallback!!)
            }
        } catch (e: Exception) {
            // Ignore during cleanup
        }
    }
}
