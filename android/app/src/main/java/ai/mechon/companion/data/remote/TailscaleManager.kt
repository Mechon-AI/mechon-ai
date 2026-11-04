package ai.mechon.companion.data.remote

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket

data class TailscaleValidationReport(
    val vpnActive: Boolean,
    val ipReachable: Boolean,
    val httpReachable: Boolean,
    val authenticated: Boolean,
    val providersAvailable: Boolean,
    val latencyMs: Long = 0,
    val details: String = "",
    val isReady: Boolean = false
)

class TailscaleManager(
    private val context: Context,
    private val desktopApiClient: DesktopApiClient,
    private val sessionManager: SessionManager
) {
    fun isVpnActive(): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val activeNetwork = cm?.activeNetwork
            val caps = cm?.getNetworkCapabilities(activeNetwork)
            val hasVpnCap = caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true

            val hasVpnInterface = try {
                NetworkInterface.getNetworkInterfaces()?.toList()?.any { iface ->
                    iface.isUp && (iface.name.contains("tailscale", ignoreCase = true) ||
                            iface.name.contains("tun", ignoreCase = true) ||
                            iface.name.contains("wg", ignoreCase = true))
                } == true
            } catch (e: Exception) {
                false
            }

            hasVpnCap || hasVpnInterface
        } catch (e: Exception) {
            false
        }
    }

    fun parseTailscaleUrl(hostOrUrl: String, defaultPort: Int = 38475): String {
        val trimmed = hostOrUrl.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed.trimEnd('/')
        }
        return if (trimmed.contains(":") && !trimmed.startsWith("[")) {
            "http://$trimmed"
        } else {
            "http://$trimmed:$defaultPort"
        }
    }

    suspend fun validateMesh(
        hostOrUrl: String,
        token: String? = null
    ): TailscaleValidationReport = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        val vpnActive = isVpnActive()

        val fullUrl = parseTailscaleUrl(hostOrUrl)
        val uri = try {
            java.net.URI.create(fullUrl)
        } catch (e: Exception) {
            return@withContext TailscaleValidationReport(
                vpnActive = vpnActive,
                ipReachable = false,
                httpReachable = false,
                authenticated = false,
                providersAvailable = false,
                details = "Invalid URL/hostname format: ${e.message}"
            )
        }

        val host = uri.host ?: hostOrUrl.trim()
        val port = if (uri.port != -1) uri.port else 38475

        // Stage 1: TCP Socket Reachability
        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), 4000)
            }
        } catch (e: Exception) {
            val latency = System.currentTimeMillis() - startTime
            return@withContext TailscaleValidationReport(
                vpnActive = vpnActive,
                ipReachable = false,
                httpReachable = false,
                authenticated = false,
                providersAvailable = false,
                latencyMs = latency,
                details = "TCP connect to $host:$port timed out or unreachable (${e.message}). Ensure Tailscale is running on desktop."
            )
        }

        // Stage 2: HTTP Ping
        val httpReachable = desktopApiClient.ping(fullUrl)
        if (!httpReachable) {
            val latency = System.currentTimeMillis() - startTime
            return@withContext TailscaleValidationReport(
                vpnActive = vpnActive,
                ipReachable = true,
                httpReachable = false,
                authenticated = false,
                providersAvailable = false,
                latencyMs = latency,
                details = "TCP port open, but Mechon HTTP gateway did not respond at $fullUrl/api/v1/ping"
            )
        }

        // Stage 3: Authenticated Session Verification
        val activeToken = token ?: sessionManager.authToken
        if (activeToken.isNullOrBlank()) {
            val latency = System.currentTimeMillis() - startTime
            return@withContext TailscaleValidationReport(
                vpnActive = vpnActive,
                ipReachable = true,
                httpReachable = true,
                authenticated = false,
                providersAvailable = false,
                latencyMs = latency,
                details = "HTTP gateway reachable, but device has no authentication session token. Pairing required."
            )
        }

        val verifyRes = desktopApiClient.verifySession(fullUrl, activeToken)
        val latency = System.currentTimeMillis() - startTime

        verifyRes.fold(
            onSuccess = { health ->
                val hasProviders = health.activeProvidersCount > 0
                val ready = hasProviders && health.availableModelsCount > 0
                val detailsMsg = if (ready) {
                    "Mesh Verified: Connected to ${health.desktopName ?: "Mechon Desktop"} (${latency}ms, ${health.activeProvidersCount} active providers, ${health.availableModelsCount} models)"
                } else {
                    "Mesh Connected: Desktop reachable, but no active providers or models configured on desktop."
                }
                TailscaleValidationReport(
                    vpnActive = vpnActive,
                    ipReachable = true,
                    httpReachable = true,
                    authenticated = true,
                    providersAvailable = hasProviders,
                    latencyMs = latency,
                    details = detailsMsg,
                    isReady = ready
                )
            },
            onFailure = { err ->
                TailscaleValidationReport(
                    vpnActive = vpnActive,
                    ipReachable = true,
                    httpReachable = true,
                    authenticated = false,
                    providersAvailable = false,
                    latencyMs = latency,
                    details = "Authentication failed over mesh: ${err.message}"
                )
            }
        )
    }
}
