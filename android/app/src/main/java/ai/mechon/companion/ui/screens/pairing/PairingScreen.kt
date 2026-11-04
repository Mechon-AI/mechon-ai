package ai.mechon.companion.ui.screens.pairing

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.remote.DiscoveredWorkstation
import ai.mechon.companion.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairingScreen(
    viewModel: PairingViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Auto LAN Discovery, 1 = Manual Key, 2 = QR Code

    DisposableEffect(Unit) {
        viewModel.startDiscovery()
        onDispose {
            viewModel.stopDiscovery()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Desktop Pairing",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Automatic LAN Discovery & Approval Handshake",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = TextPrimary
                        )
                    }
                },
                actions = {
                    if (selectedTab == 0 && !uiState.isPaired) {
                        IconButton(onClick = { viewModel.startDiscovery() }) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh Scan",
                                tint = MechonBlueLight
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MechonDarkBg
                )
            )
        },
        containerColor = MechonDarkBg
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Status Feedback Banners
            if (uiState.successMessage != null) {
                Surface(
                    color = MechonGreen.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                ) {
                    Text(
                        text = uiState.successMessage ?: "",
                        color = MechonGreen,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            if (uiState.errorMessage != null) {
                Surface(
                    color = MechonRed.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                ) {
                    Text(
                        text = uiState.errorMessage ?: "",
                        color = MechonRed,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // Connection Status Header Card
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MechonSurface,
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = androidx.compose.ui.graphics.SolidColor(
                        if (uiState.isPaired) MechonGreen else MechonBorder
                    )
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (uiState.isPaired) Icons.Default.CheckCircle else Icons.Default.CloudOff,
                                contentDescription = null,
                                tint = if (uiState.isPaired) MechonGreen else TextMuted,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (uiState.isPaired) "Connected to Mechon Desktop" else "Gateway Unpaired",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (uiState.isPaired) MechonGreen else TextMuted
                            )
                        }

                        if (uiState.isPaired) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Workstation: ${uiState.pairedDesktopName ?: "Mechon Workstation"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                            Text(
                                text = "LAN Endpoint: ${uiState.pairedDesktopUrl}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextMuted,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    if (uiState.isPaired) {
                        OutlinedButton(
                            onClick = { viewModel.unpair() },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MechonRed),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Disconnect")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Navigation Tabs
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = MechonSurface,
                contentColor = MechonBlueLight
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Auto LAN", fontSize = 11.sp) },
                    icon = { Icon(Icons.Default.Lan, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Tailscale", fontSize = 11.sp) },
                    icon = { Icon(Icons.Default.VpnLock, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
                Tab(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    text = { Text("Manual Key", fontSize = 11.sp) },
                    icon = { Icon(Icons.Default.Key, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
                Tab(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    text = { Text("QR Code", fontSize = 11.sp) },
                    icon = { Icon(Icons.Default.QrCodeScanner, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Tab 0: Automatic LAN Discovery & Approval-Based Pairing
            if (selectedTab == 0) {
                // If approval is pending on desktop
                if (uiState.flowState == PairingFlowState.APPROVAL_PENDING || uiState.flowState == PairingFlowState.AWAITING_APPROVAL) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MechonSurface,
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(MechonCyan)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(36.dp),
                                strokeWidth = 3.dp,
                                color = MechonCyan
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "Awaiting Desktop Approval",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Please click 'Approve' in the Mechon AI Desktop Mobile Companion tab to authorize this device.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            OutlinedButton(
                                onClick = { viewModel.cancelPendingRequest() },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = TextMuted)
                            ) {
                                Text("Cancel Request")
                            }
                        }
                    }
                } else {
                    // List of discovered workstations
                    Column(modifier = Modifier.fillMaxWidth().weight(1f)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Discovered Workstations (${uiState.discoveredWorkstations.size})",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = TextMuted
                            )
                            if (uiState.isScanning) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 2.dp, color = MechonCyan)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Scanning Wi-Fi...", style = MaterialTheme.typography.labelSmall, color = MechonCyan, fontSize = 10.sp)
                                }
                            }
                        }

                        if (uiState.discoveredWorkstations.isEmpty()) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MechonSurface,
                                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Icon(Icons.Default.WifiFind, contentDescription = null, tint = TextMuted, modifier = Modifier.size(48.dp))
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text(
                                        text = "Searching for Mechon Desktop on LAN...",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextSecondary
                                    )
                                    Text(
                                        text = "Ensure Mechon AI is open on your desktop and the Mobile Gateway is turned ON.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextMuted,
                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(uiState.discoveredWorkstations) { ws ->
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = MechonSurface,
                                        border = ButtonDefaults.outlinedButtonBorder.copy(
                                            brush = androidx.compose.ui.graphics.SolidColor(MechonBorder)
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(14.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Icon(Icons.Default.Computer, contentDescription = null, tint = MechonBlueLight, modifier = Modifier.size(18.dp))
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(ws.name, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                }
                                                Text(
                                                    text = "LAN: http://${ws.lanIp}:${ws.port} • v${ws.version}",
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 11.sp,
                                                    color = TextMuted,
                                                    modifier = Modifier.padding(top = 2.dp)
                                                )
                                                if (!ws.tailscaleIp.isNullOrBlank()) {
                                                    Text(
                                                        text = "Tailscale Mesh: ${ws.tailscaleIp}",
                                                        fontFamily = FontFamily.Monospace,
                                                        fontSize = 10.5.sp,
                                                        color = SoftLavender,
                                                        modifier = Modifier.padding(top = 1.dp)
                                                    )
                                                }
                                            }

                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Button(
                                                    onClick = { viewModel.connectWorkstation(ws, useTailscale = false) },
                                                    enabled = !uiState.isPairing && !uiState.isPaired,
                                                    colors = ButtonDefaults.buttonColors(containerColor = MechonBlue),
                                                    shape = RoundedCornerShape(8.dp),
                                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                                ) {
                                                    Text("LAN", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                                }
                                                if (!ws.tailscaleIp.isNullOrBlank()) {
                                                    Button(
                                                        onClick = { viewModel.connectWorkstation(ws, useTailscale = true) },
                                                        enabled = !uiState.isPairing && !uiState.isPaired,
                                                        colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet),
                                                        shape = RoundedCornerShape(8.dp),
                                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                                    ) {
                                                        Text("Mesh", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Tab 1: Tailscale Mesh Connectivity
            if (selectedTab == 1) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MechonSurface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.VpnLock, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Tailscale Mesh Connectivity",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Connect remotely to Mechon Desktop over Tailscale CGNAT IP (100.64.0.0/10) or MagicDNS (*.ts.net) without port forwarding.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary,
                            fontSize = 11.5.sp
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = uiState.manualTailscaleHost,
                            onValueChange = { viewModel.updateManualTailscaleHost(it) },
                            label = { Text("Tailscale IP or MagicDNS") },
                            placeholder = { Text("100.127.109.78 or my-pc.ts.net") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = ElectricViolet,
                                unfocusedBorderColor = MechonBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = uiState.manualTailscalePort,
                            onValueChange = { viewModel.updateManualTailscalePort(it) },
                            label = { Text("Gateway Port (Default 38475)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = ElectricViolet,
                                unfocusedBorderColor = MechonBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = uiState.manualTailscaleKey,
                            onValueChange = { viewModel.updateManualTailscaleKey(it) },
                            label = { Text("Pairing Key (Optional if using Approval)") },
                            placeholder = { Text("MCH-XXXX-YYYY") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = ElectricViolet,
                                unfocusedBorderColor = MechonBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        if (uiState.tailscaleTestResult != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = uiState.tailscaleTestResult ?: "",
                                fontSize = 11.5.sp,
                                color = if (uiState.tailscaleTestResult?.startsWith("Mesh Online") == true) StatusConnected else StatusError,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { viewModel.testTailscaleConnection() },
                                enabled = !uiState.isTailscaleTesting && !uiState.isPairing,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f).height(44.dp)
                            ) {
                                if (uiState.isTailscaleTesting) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = SoftLavender)
                                } else {
                                    Icon(Icons.Default.NetworkPing, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Ping Mesh", fontSize = 12.sp)
                                }
                            }

                            Button(
                                onClick = { viewModel.pairWithTailscale(useApproval = true) },
                                enabled = !uiState.isPairing,
                                colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.weight(1f).height(44.dp)
                            ) {
                                Text("Pair Device", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Tab 2: Manual Key Fallback
            if (selectedTab == 2) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MechonSurface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Manual Connection Credentials",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = uiState.manualIp,
                            onValueChange = { viewModel.updateManualIp(it) },
                            label = { Text("Desktop LAN IP Address") },
                            placeholder = { Text("192.168.1.100") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = MechonBlue,
                                unfocusedBorderColor = MechonBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = uiState.manualPort,
                            onValueChange = { viewModel.updateManualPort(it) },
                            label = { Text("Port (38475)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = MechonBlue,
                                unfocusedBorderColor = MechonBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = uiState.manualKey,
                            onValueChange = { viewModel.updateManualKey(it) },
                            label = { Text("Pairing Key (MCH-XXXX-YYYY)") },
                            placeholder = { Text("MCH-8A2F-9C14") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = MechonBlue,
                                unfocusedBorderColor = MechonBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        Button(
                            onClick = { viewModel.pairWithManualKey() },
                            enabled = !uiState.isPairing,
                            colors = ButtonDefaults.buttonColors(containerColor = MechonBlue),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                        ) {
                            if (uiState.isPairing) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = TextPrimary)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Authenticating...")
                            } else {
                                Icon(Icons.Default.Link, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Connect With Key")
                            }
                        }
                    }
                }
            }

            // Tab 3: QR Code Guidance
            if (selectedTab == 3) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MechonSurface,
                    modifier = Modifier.fillMaxWidth().weight(1f)
                ) {
                    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = MechonBlueLight, modifier = Modifier.size(64.dp))
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "Desktop QR Pairing",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Use your device camera or an external scanner to read the 15-minute pairing code shown on Mechon Desktop, then enter the key in the Manual Key tab or tap Auto LAN Discovery.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}
