package ai.mechon.companion.ui.screens.pairing

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.SessionManager
import com.google.gson.Gson
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class PairingUiState(
    val isPaired: Boolean = false,
    val pairedDesktopName: String? = null,
    val pairedDesktopUrl: String = "",
    val manualIp: String = "192.168.1.100",
    val manualPort: String = "38475",
    val manualKey: String = "",
    val isPairing: Boolean = false,
    val isCameraScanning: Boolean = true,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

class PairingViewModel(
    private val sessionManager: SessionManager,
    private val desktopApiClient: DesktopApiClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        PairingUiState(
            isPaired = sessionManager.isPaired,
            pairedDesktopName = sessionManager.desktopName,
            pairedDesktopUrl = sessionManager.desktopUrl
        )
    )
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    fun updateManualIp(ip: String) {
        _uiState.update { it.copy(manualIp = ip) }
    }

    fun updateManualPort(port: String) {
        _uiState.update { it.copy(manualPort = port) }
    }

    fun updateManualKey(key: String) {
        _uiState.update { it.copy(manualKey = key.uppercase()) }
    }

    fun setCameraScanning(scanning: Boolean) {
        _uiState.update { it.copy(isCameraScanning = scanning) }
    }

    fun handleScannedQrCode(qrText: String) {
        // Formats supported:
        // 1. mechon://pair?ip=192.168.1.5&port=38475&key=MCH-1234-ABCD
        // 2. JSON: {"ip":"192.168.1.5","port":38475,"key":"MCH-1234-ABCD"}
        // 3. Raw key if user just scans the code text
        try {
            if (qrText.startsWith("mechon://")) {
                val uri = Uri.parse(qrText)
                val ip = uri.getQueryParameter("ip") ?: uri.getQueryParameter("host")
                val port = uri.getQueryParameter("port") ?: "38475"
                val key = uri.getQueryParameter("key") ?: uri.getQueryParameter("pairing_key")
                if (ip != null && key != null) {
                    pairDesktop("http://$ip:$port", key)
                }
            } else if (qrText.trim().startsWith("{")) {
                val map = Gson().fromJson(qrText, Map::class.java)
                val ip = map["ip"]?.toString() ?: map["lan_ip"]?.toString()
                val port = (map["port"] as? Double)?.toInt()?.toString() ?: "38475"
                val key = map["key"]?.toString() ?: map["pairing_key"]?.toString()
                if (ip != null && key != null) {
                    pairDesktop("http://$ip:$port", key)
                }
            } else if (qrText.trim().startsWith("MCH-")) {
                // User scanned bare key, use existing manual IP/port
                val url = "http://${_uiState.value.manualIp}:${_uiState.value.manualPort}"
                pairDesktop(url, qrText.trim())
            }
        } catch (e: Exception) {
            _uiState.update { it.copy(errorMessage = "Could not parse QR code: ${e.message}") }
        }
    }

    fun pairWithManualInput() {
        val ip = _uiState.value.manualIp.trim()
        val port = _uiState.value.manualPort.trim()
        val key = _uiState.value.manualKey.trim().uppercase()

        if (ip.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter desktop LAN IP address") }
            return
        }
        if (key.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter 10-character pairing key") }
            return
        }

        val url = "http://$ip:$port"
        pairDesktop(url, key)
    }

    private fun pairDesktop(url: String, key: String) {
        _uiState.update { it.copy(isPairing = true, errorMessage = null, successMessage = null) }

        viewModelScope.launch {
            val result = desktopApiClient.pair(url, key)
            result.fold(
                onSuccess = { resp ->
                    _uiState.update {
                        it.copy(
                            isPairing = false,
                            isPaired = true,
                            pairedDesktopName = resp.desktopName,
                            pairedDesktopUrl = url,
                            successMessage = "Connected to ${resp.desktopName ?: "Desktop"}!"
                        )
                    }
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isPairing = false,
                            errorMessage = err.message ?: "Failed to pair with Mechon Desktop"
                        )
                    }
                }
            )
        }
    }

    fun unpair() {
        sessionManager.clearPairing()
        _uiState.update {
            it.copy(
                isPaired = false,
                pairedDesktopName = null,
                successMessage = "Device unpaired"
            )
        }
    }

    fun clearFeedback() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }
}
