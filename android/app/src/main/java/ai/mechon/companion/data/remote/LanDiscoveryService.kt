package ai.mechon.companion.data.remote

import com.google.gson.Gson
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

class LanDiscoveryService(
    private val gson: Gson = Gson()
) {
    private val _discovered = MutableStateFlow<List<DiscoveredWorkstation>>(emptyList())
    val discovered: StateFlow<List<DiscoveredWorkstation>> = _discovered.asStateFlow()

    private var discoveryJob: Job? = null
    private var socket: DatagramSocket? = null

    fun startDiscovery(scope: CoroutineScope) {
        if (discoveryJob != null && discoveryJob?.isActive == true) return

        discoveryJob = scope.launch(Dispatchers.IO) {
            try {
                val udpSocket = DatagramSocket()
                udpSocket.broadcast = true
                udpSocket.soTimeout = 2000
                socket = udpSocket

                // Send discovery probe immediately and then periodically
                launch {
                    val probeData = "MECHON_DISCOVER".toByteArray()
                    val broadcastAddr = InetAddress.getByName("255.255.255.255")
                    val packet = DatagramPacket(probeData, probeData.size, broadcastAddr, 38476)

                    while (isActive) {
                        try {
                            udpSocket.send(packet)
                        } catch (e: Exception) {
                            // ignore network errors
                        }
                        delay(3000)
                    }
                }

                // Listen for beacon responses
                val buffer = ByteArray(2048)
                while (isActive) {
                    try {
                        val receivePacket = DatagramPacket(buffer, buffer.size)
                        udpSocket.receive(receivePacket)
                        val text = String(receivePacket.data, 0, receivePacket.length)

                        if (text.contains("mechon-gateway")) {
                            val ws = gson.fromJson(text, DiscoveredWorkstation::class.java)
                            if (ws != null) {
                                val resolvedIp = if (ws.lanIp.isBlank() || ws.lanIp == "0.0.0.0") {
                                    receivePacket.address.hostAddress ?: "127.0.0.1"
                                } else {
                                    ws.lanIp
                                }
                                val resolved = ws.copy(lanIp = resolvedIp, lastSeenTimestamp = System.currentTimeMillis())

                                _discovered.update { current ->
                                    val list = current.filter { it.lanIp != resolved.lanIp }.toMutableList()
                                    list.add(resolved)
                                    list
                                }
                            }
                        }
                    } catch (e: Exception) {
                        // socket timeout is expected, loop continues
                    }
                }
            } catch (e: Exception) {
                // Discovery terminated
            } finally {
                socket?.close()
                socket = null
            }
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
    }

    fun clear() {
        _discovered.value = emptyList()
    }
}
