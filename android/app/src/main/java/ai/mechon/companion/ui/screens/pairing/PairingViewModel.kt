package ai.mechon.companion.ui.screens.pairing

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.DiscoveredWorkstation
import ai.mechon.companion.data.remote.LanDiscoveryService
import ai.mechon.companion.data.remote.SessionManager
import com.google.gson.Gson
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class PairingFlowState {
    DISCONNECTED,
    DISCOVERING,
    AVAILABLE,
    CONNECTING,
    PAIRING_REQUESTED,
    AWAITING_APPROVAL,
    APPROVAL_PENDING,
    PAIRING,
    CONNECTED,
    RECONNECTING,
    CONNECTION_LOST,
    ERROR,
    REJECTED,
    FAILED
}

data class PairingUiState(
    val isPaired: Boolean = false,
    val flowState: PairingFlowState = PairingFlowState.DISCOVERING,
    val pairedDesktopName: String? = null,
    val pairedDesktopUrl: String = "",
    val discoveredWorkstations: List<DiscoveredWorkstation> = emptyList(),
    val pendingRequestId: String? = null,
    val manualIp: String = "192.168.1.100",
    val manualPort: String = "38475",
    val manualKey: String = "",
    val manualTailscaleHost: String = "",
    val manualTailscalePort: String = "38475",
    val manualTailscaleKey: String = "",
    val isTailscaleTesting: Boolean = false,
    val tailscaleTestResult: String? = null,
    val isPairing: Boolean = false,
    val isScanning: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

class PairingViewModel(
    private val sessionManager: SessionManager,
    private val desktopApiClient: DesktopApiClient,
    private val lanDiscoveryService: LanDiscoveryService
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        PairingUiState(
            isPaired = sessionManager.isPaired,
            flowState = if (sessionManager.isPaired) PairingFlowState.CONNECTED else PairingFlowState.DISCOVERING,
            pairedDesktopName = sessionManager.desktopName,
            pairedDesktopUrl = sessionManager.desktopUrl
        )
    )
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            lanDiscoveryService.discovered.collectLatest { list ->
                _uiState.update {
                    val nextState = if (list.isNotEmpty() && it.flowState == PairingFlowState.DISCOVERING) {
                        PairingFlowState.AVAILABLE
                    } else it.flowState
                    it.copy(
                        discoveredWorkstations = list,
                        flowState = nextState
                    )
                }
            }
        }
    }

    fun startDiscovery() {
        if (_uiState.value.isPaired) return
        _uiState.update { it.copy(isScanning = true, flowState = PairingFlowState.DISCOVERING) }
        lanDiscoveryService.startDiscovery(viewModelScope)
    }

    fun stopDiscovery() {
        lanDiscoveryService.stopDiscovery()
        _uiState.update { it.copy(isScanning = false) }
    }

    fun connectWorkstation(ws: DiscoveredWorkstation, useTailscale: Boolean = false) {
        val targetIp = if (useTailscale && !ws.tailscaleIp.isNullOrBlank()) ws.tailscaleIp else ws.lanIp
        val targetUrl = "http://$targetIp:${ws.port}"
        _uiState.update {
            it.copy(
                flowState = PairingFlowState.CONNECTING,
                isPairing = true,
                errorMessage = null,
                successMessage = null
            )
        }

        viewModelScope.launch {
            val result = desktopApiClient.requestApprovalPairing(targetUrl)
            result.fold(
                onSuccess = { initResp ->
                    _uiState.update {
                        it.copy(
                            flowState = PairingFlowState.APPROVAL_PENDING,
                            isPairing = false,
                            pendingRequestId = initResp.requestId,
                            successMessage = "Request sent! Please click Approve on Mechon Desktop."
                        )
                    }
                    startPollingApprovalStatus(targetUrl, initResp.requestId)
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            flowState = PairingFlowState.FAILED,
                            isPairing = false,
                            errorMessage = err.message ?: "Failed to send pairing request"
                        )
                    }
                }
            )
        }
    }

    private fun startPollingApprovalStatus(targetUrl: String, requestId: String) {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(2000)
                val statusResult = desktopApiClient.checkPairingStatus(targetUrl, requestId)
                statusResult.onSuccess { statusResp ->
                    when (statusResp.status) {
                        "approved" -> {
                            _uiState.update {
                                it.copy(
                                    isPaired = true,
                                    flowState = PairingFlowState.CONNECTED,
                                    pairedDesktopName = statusResp.desktopName ?: "Mechon Workstation",
                                    pairedDesktopUrl = targetUrl,
                                    successMessage = "Connected successfully to ${statusResp.desktopName ?: "Mechon Workstation"}!",
                                    pendingRequestId = null
                                )
                            }
                            stopDiscovery()
                            return@launch
                        }
                        "rejected" -> {
                            _uiState.update {
                                it.copy(
                                    flowState = PairingFlowState.REJECTED,
                                    errorMessage = "Connection request was rejected on Mechon Desktop.",
                                    pendingRequestId = null
                                )
                            }
                            return@launch
                        }
                    }
                }
            }
        }
    }

    fun cancelPendingRequest() {
        pollJob?.cancel()
        pollJob = null
        _uiState.update {
            it.copy(
                flowState = PairingFlowState.AVAILABLE,
                pendingRequestId = null,
                errorMessage = null,
                successMessage = null
            )
        }
    }

    fun updateManualIp(ip: String) {
        _uiState.update { it.copy(manualIp = ip) }
    }

    fun updateManualPort(port: String) {
        _uiState.update { it.copy(manualPort = port) }
    }

    fun updateManualKey(key: String) {
        _uiState.update { it.copy(manualKey = key.uppercase()) }
    }

    fun updateManualTailscaleHost(host: String) {
        _uiState.update { it.copy(manualTailscaleHost = host.trim()) }
    }

    fun updateManualTailscalePort(port: String) {
        _uiState.update { it.copy(manualTailscalePort = port.trim()) }
    }

    fun updateManualTailscaleKey(key: String) {
        _uiState.update { it.copy(manualTailscaleKey = key.trim().uppercase()) }
    }

    fun testTailscaleConnection() {
        val host = _uiState.value.manualTailscaleHost.trim()
        val port = _uiState.value.manualTailscalePort.trim()
        if (host.isBlank()) {
            _uiState.update { it.copy(tailscaleTestResult = "Please enter Tailscale 100.x.y.z IP or MagicDNS hostname") }
            return
        }
        val url = if (host.startsWith("http://") || host.startsWith("https://")) host else "http://$host:$port"
        _uiState.update { it.copy(isTailscaleTesting = true, tailscaleTestResult = null) }

        viewModelScope.launch {
            val pingOk = desktopApiClient.ping(url)
            _uiState.update {
                it.copy(
                    isTailscaleTesting = false,
                    tailscaleTestResult = if (pingOk) "Mesh Online: Mechon Gateway is reachable via Tailscale!" else "Offline: Could not connect to $url"
                )
            }
        }
    }

    fun pairWithTailscale(useApproval: Boolean = false) {
        val host = _uiState.value.manualTailscaleHost.trim()
        val port = _uiState.value.manualTailscalePort.trim()
        val key = _uiState.value.manualTailscaleKey.trim().uppercase()

        if (host.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter Tailscale IP or MagicDNS") }
            return
        }

        val url = if (host.startsWith("http://") || host.startsWith("https://")) host else "http://$host:$port"

        if (useApproval) {
            _uiState.update {
                it.copy(
                    flowState = PairingFlowState.CONNECTING,
                    isPairing = true,
                    errorMessage = null,
                    successMessage = null
                )
            }
            viewModelScope.launch {
                val result = desktopApiClient.requestApprovalPairing(url)
                result.fold(
                    onSuccess = { initResp ->
                        _uiState.update {
                            it.copy(
                                flowState = PairingFlowState.APPROVAL_PENDING,
                                isPairing = false,
                                pendingRequestId = initResp.requestId,
                                successMessage = "Approval request sent over Tailscale! Click Approve on Mechon Desktop."
                            )
                        }
                        startPollingApprovalStatus(url, initResp.requestId)
                    },
                    onFailure = { err ->
                        _uiState.update {
                            it.copy(
                                flowState = PairingFlowState.FAILED,
                                isPairing = false,
                                errorMessage = err.message ?: "Failed to initiate Tailscale approval handshake"
                            )
                        }
                    }
                )
            }
        } else {
            if (key.isBlank()) {
                _uiState.update { it.copy(errorMessage = "Please enter pairing key or use approval handshake") }
                return
            }
            pairWithKey(url, key)
        }
    }

    fun pairWithManualKey() {
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
        pairWithKey(url, key)
    }

    fun handleScannedQrCode(qrText: String) {
        try {
            if (qrText.startsWith("mechon://")) {
                val uri = Uri.parse(qrText)
                val ip = uri.getQueryParameter("host") ?: uri.getQueryParameter("ip")
                val port = uri.getQueryParameter("port") ?: "38475"
                val key = uri.getQueryParameter("code") ?: uri.getQueryParameter("key")
                if (ip != null && key != null) {
                    pairWithKey("http://$ip:$port", key)
                }
            } else if (qrText.trim().startsWith("{")) {
                val map = Gson().fromJson(qrText, Map::class.java)
                val ip = map["ip"]?.toString() ?: map["lan_ip"]?.toString()
                val port = (map["port"] as? Double)?.toInt()?.toString() ?: "38475"
                val key = map["key"]?.toString() ?: map["code"]?.toString()
                if (ip != null && key != null) {
                    pairWithKey("http://$ip:$port", key)
                }
            } else if (qrText.trim().startsWith("MCH-")) {
                val url = "http://${_uiState.value.manualIp}:${_uiState.value.manualPort}"
                pairWithKey(url, qrText.trim())
            }
        } catch (e: Exception) {
            _uiState.update { it.copy(errorMessage = "Could not parse QR code: ${e.message}") }
        }
    }

    private fun pairWithKey(url: String, key: String) {
        _uiState.update { it.copy(isPairing = true, flowState = PairingFlowState.PAIRING, errorMessage = null, successMessage = null) }

        viewModelScope.launch {
            val result = desktopApiClient.pair(url, key)
            result.fold(
                onSuccess = { resp ->
                    _uiState.update {
                        it.copy(
                            isPairing = false,
                            isPaired = true,
                            flowState = PairingFlowState.CONNECTED,
                            pairedDesktopName = resp.desktopName,
                            pairedDesktopUrl = url,
                            successMessage = "Connected to ${resp.desktopName ?: "Desktop"}!"
                        )
                    }
                    stopDiscovery()
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isPairing = false,
                            flowState = PairingFlowState.FAILED,
                            errorMessage = err.message ?: "Failed to pair with Mechon Desktop"
                        )
                    }
                }
            )
        }
    }

    fun unpair() {
        pollJob?.cancel()
        pollJob = null
        sessionManager.clearPairing()
        _uiState.update {
            it.copy(
                isPaired = false,
                flowState = PairingFlowState.DISCONNECTED,
                pairedDesktopName = null,
                successMessage = "Device unpaired"
            )
        }
    }

    fun clearFeedback() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }
}
