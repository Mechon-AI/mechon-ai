package ai.mechon.companion.data.remote

import android.content.Context
import android.net.wifi.WifiManager
import com.google.gson.Gson
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.net.*

data class DiscoveryDiagnostics(
    val isScanning: Boolean = false,
    val interfacesScanned: List<String> = emptyList(),
    val targetBroadcastAddresses: List<String> = emptyList(),
    val probesSentCount: Int = 0,
    val responsesReceivedCount: Int = 0,
    val lastScanTimestamp: Long = 0L,
    val lastErrorMessage: String? = null
)

class LanDiscoveryService(
    private val context: Context? = null,
    private val gson: Gson = Gson()
) {
    private val _discovered = MutableStateFlow<List<DiscoveredWorkstation>>(emptyList())
    val discovered: StateFlow<List<DiscoveredWorkstation>> = _discovered.asStateFlow()

    private val _diagnostics = MutableStateFlow(DiscoveryDiagnostics())
    val diagnostics: StateFlow<DiscoveryDiagnostics> = _diagnostics.asStateFlow()

    private var discoveryJob: Job? = null
    private var socket: DatagramSocket? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    private fun acquireMulticastLock() {
        try {
            if (context != null) {
                val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                if (wifiManager != null) {
                    val lock = wifiManager.createMulticastLock("mechon_lan_multicast_lock")
                    lock.setReferenceCounted(true)
                    lock.acquire()
                    multicastLock = lock
                }
            }
        } catch (e: Exception) {
            // Log or record in diagnostics
        }
    }

    private fun releaseMulticastLock() {
        try {
            multicastLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (e: Exception) {
            // ignore
        } finally {
            multicastLock = null
        }
    }

    private fun getBroadcastTargets(): Pair<List<String>, List<InetAddress>> {
        val ifaceNames = mutableListOf<String>()
        val addresses = mutableSetOf<InetAddress>()

        // Always include global broadcast
        try {
            addresses.add(InetAddress.getByName("255.255.255.255"))
        } catch (e: Exception) {
            // ignore
        }

        // Include SSDP multicast
        try {
            addresses.add(InetAddress.getByName("239.255.255.250"))
        } catch (e: Exception) {
            // ignore
        }

        try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return Pair(ifaceNames, addresses.toList())
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                ifaceNames.add(iface.name)

                for (addr in iface.interfaceAddresses) {
                    val broadcast = addr.broadcast
                    if (broadcast != null) {
                        addresses.add(broadcast)
                    }
                }
            }
        } catch (e: Exception) {
            // ignore
        }

        return Pair(ifaceNames, addresses.toList())
    }

    fun startDiscovery(scope: CoroutineScope) {
        if (discoveryJob != null && discoveryJob?.isActive == true) return

        acquireMulticastLock()
        _diagnostics.update { it.copy(isScanning = true, lastErrorMessage = null, lastScanTimestamp = System.currentTimeMillis()) }

        discoveryJob = scope.launch(Dispatchers.IO) {
            try {
                val (ifaces, broadcastTargets) = getBroadcastTargets()
                _diagnostics.update {
                    it.copy(
                        interfacesScanned = ifaces,
                        targetBroadcastAddresses = broadcastTargets.map { a -> a.hostAddress ?: a.toString() }
                    )
                }

                // Bind to any available UDP port with broadcast enabled
                val udpSocket = DatagramSocket(null)
                udpSocket.reuseAddress = true
                udpSocket.broadcast = true
                udpSocket.soTimeout = 2000
                udpSocket.bind(InetSocketAddress(0))
                socket = udpSocket

                // Send discovery probe immediately and then periodically
                launch {
                    val probeData = "MECHON_DISCOVER:v1.2.8".toByteArray()

                    while (isActive) {
                        for (target in broadcastTargets) {
                            try {
                                val packet = DatagramPacket(probeData, probeData.size, target, 38476)
                                udpSocket.send(packet)
                                _diagnostics.update { it.copy(probesSentCount = it.probesSentCount + 1) }
                            } catch (e: Exception) {
                                // network interface error
                            }
                        }
                        delay(2500)
                    }
                }

                // Listen for beacon responses
                val buffer = ByteArray(4096)
                while (isActive) {
                    try {
                        val receivePacket = DatagramPacket(buffer, buffer.size)
                        udpSocket.receive(receivePacket)
                        val text = String(receivePacket.data, 0, receivePacket.length)

                        if (text.contains("mechon-gateway")) {
                            _diagnostics.update { it.copy(responsesReceivedCount = it.responsesReceivedCount + 1) }
                            val ws = gson.fromJson(text, DiscoveredWorkstation::class.java)
                            if (ws != null) {
                                val senderIp = receivePacket.address.hostAddress ?: "127.0.0.1"
                                val resolvedIp = if (ws.lanIp.isBlank() || ws.lanIp == "0.0.0.0") {
                                    senderIp
                                } else {
                                    ws.lanIp
                                }
                                val resolved = ws.copy(
                                    lanIp = resolvedIp,
                                    lastSeenTimestamp = System.currentTimeMillis()
                                )

                                _discovered.update { current ->
                                    val list = current.filter { it.lanIp != resolved.lanIp && (it.server_id == null || it.server_id != resolved.server_id) }.toMutableList()
                                    list.add(resolved)
                                    list
                                }
                            }
                        }
                    } catch (e: SocketTimeoutException) {
                        // socket timeout is expected, loop continues
                    } catch (e: Exception) {
                        if (isActive) {
                            _diagnostics.update { it.copy(lastErrorMessage = e.message) }
                        }
                    }
                }
            } catch (e: Exception) {
                _diagnostics.update { it.copy(lastErrorMessage = "Discovery failed: ${e.message}") }
            } finally {
                socket?.close()
                socket = null
                releaseMulticastLock()
                _diagnostics.update { it.copy(isScanning = false) }
            }
        }
    }

    suspend fun probeDirect(host: String, port: Int = 38475): Result<DiscoveredWorkstation> = withContext(Dispatchers.IO) {
        val cleanHost = host.trim()
            .removePrefix("http://")
            .removePrefix("https://")
            .substringBefore(':')
            .substringBefore('/')

        if (cleanHost.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Host cannot be blank"))
        }

        try {
            val udpSocket = DatagramSocket()
            udpSocket.soTimeout = 2000
            val probeData = "MECHON_DISCOVER:v1.2.8".toByteArray()
            val targetAddr = InetAddress.getByName(cleanHost)
            val packet = DatagramPacket(probeData, probeData.size, targetAddr, 38476)
            udpSocket.send(packet)

            val buffer = ByteArray(4096)
            val receivePacket = DatagramPacket(buffer, buffer.size)
            udpSocket.receive(receivePacket)
            val text = String(receivePacket.data, 0, receivePacket.length)
            udpSocket.close()

            if (text.contains("mechon-gateway")) {
                val ws = gson.fromJson(text, DiscoveredWorkstation::class.java)
                if (ws != null) {
                    val resolved = ws.copy(
                        lanIp = if (ws.lanIp.isBlank() || ws.lanIp == "0.0.0.0") cleanHost else ws.lanIp,
                        lastSeenTimestamp = System.currentTimeMillis()
                    )
                    _discovered.update { current ->
                        val list = current.filter { it.lanIp != resolved.lanIp }.toMutableList()
                        list.add(resolved)
                        list
                    }
                    return@withContext Result.success(resolved)
                }
            }
            Result.failure(SocketTimeoutException("No Mechon Gateway response from $cleanHost:38476"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun stopDiscovery() {
        discoveryJob?.cancel()
        discoveryJob = null
        try {
            socket?.close()
        } catch (e: Exception) {
            // ignore
        }
        socket = null
        releaseMulticastLock()
        _diagnostics.update { it.copy(isScanning = false) }
    }

    fun clear() {
        _discovered.value = emptyList()
    }
}
