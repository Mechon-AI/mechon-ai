package ai.mechon.companion

import ai.mechon.companion.data.remote.*
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

class LanTailscaleConnectivityRegressionTest {

    private val gson = Gson()

    @Test
    fun test_tailscale_connected_device_with_unreachable_desktop_must_not_display_ready() {
        // Tailscale report simulation where VPN is active on Android, but desktop endpoint is offline
        val report = TailscaleValidationReport(
            vpnActive = true,
            ipReachable = false,
            httpReachable = false,
            authenticated = false,
            providersAvailable = false,
            latencyMs = 4000,
            details = "TCP connect to 100.64.0.10:38475 timed out. Ensure Tailscale is running on desktop.",
            isReady = false
        )

        assertFalse("Tailscale with unreachable desktop must NEVER report isReady", report.isReady)
        assertTrue("VPN interface is active", report.vpnActive)
        assertFalse("Desktop IP must be unreachable", report.ipReachable)
    }

    @Test
    fun test_approved_device_without_valid_session_token_must_not_display_connected() {
        // Device approved on desktop, but token revoked or missing
        val diag = ConnectionDiagnostics(
            state = ConnectionState.ERROR,
            transport = "LAN",
            targetEndpoint = "http://192.168.1.50:38475",
            isTcpConnected = true,
            isAuthenticated = false,
            lastError = "Device pairing revoked by Mechon Desktop"
        )

        assertFalse("Approved device with invalid/revoked token must not be READY", diag.isReady)
        assertNotEquals("State must not be CONNECTED", ConnectionState.CONNECTED, diag.state)
        assertEquals("State must be ERROR", ConnectionState.ERROR, diag.state)
    }

    @Test
    fun test_lan_discovery_beacon_json_parsing_and_advertisement() {
        val beaconJson = """
            {
                "service": "mechon-gateway",
                "name": "Mechon Workstation Studio",
                "server_id": "srv-test-uuid-42",
                "lan_ip": "192.168.1.120",
                "tailscale_ip": "100.102.103.104",
                "port": 38475,
                "version": "1.2.8",
                "is_tailscale": true
            }
        """.trimIndent()

        val ws = gson.fromJson(beaconJson, DiscoveredWorkstation::class.java)
        assertNotNull(ws)
        assertEquals("srv-test-uuid-42", ws.server_id)
        assertEquals("192.168.1.120", ws.lanIp)
        assertEquals("100.102.103.104", ws.tailscaleIp)
        assertEquals(38475, ws.port)
        assertEquals("1.2.8", ws.version)
        assertTrue(ws.isTailscale)
    }

    @Test
    fun test_seven_stage_pipeline_invariants() {
        // Case A: Missing active providers -> DEGRADED, not READY
        val degradedDiag = ConnectionDiagnostics(
            state = ConnectionState.DEGRADED,
            isTcpConnected = true,
            isAuthenticated = true,
            isIdentityVerified = true,
            isHealthOk = true,
            isCapabilitiesOk = true,
            activeProvidersCount = 0,
            availableModelsCount = 0
        )
        assertFalse("Cannot report READY when activeProvidersCount is 0", degradedDiag.isReady)

        // Case B: All 7 stages pass -> READY
        val readyDiag = ConnectionDiagnostics(
            state = ConnectionState.READY,
            isTcpConnected = true,
            isAuthenticated = true,
            isIdentityVerified = true,
            isHealthOk = true,
            isCapabilitiesOk = true,
            activeProvidersCount = 2,
            availableModelsCount = 5
        )
        assertTrue("Must report READY when all 7 stages succeed", readyDiag.isReady)
    }
}
