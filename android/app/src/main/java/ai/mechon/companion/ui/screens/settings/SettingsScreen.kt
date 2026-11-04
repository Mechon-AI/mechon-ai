package ai.mechon.companion.ui.screens.settings

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.SessionManager
import ai.mechon.companion.ui.components.*
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    sessionManager: SessionManager,
    desktopApiClient: DesktopApiClient,
    onNavigateBack: () -> Unit,
    onNavigateToChat: () -> Unit = {},
    onNavigateToHistory: () -> Unit = {},
    onNavigateToPairing: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isPinging by remember { mutableStateOf(false) }
    var pingResult by remember { mutableStateOf<String?>(null) }
    var deviceNameInput by remember { mutableStateOf(sessionManager.deviceName) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MechonLogoMark(size = 24.dp)
                        Text(
                            text = "Settings",
                            color = TextPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
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
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ObsidianBlack
                )
            )
        },
        bottomBar = {
            MechonFloatingBottomNav(
                currentTab = NavTab.SETTINGS,
                onTabSelected = { tab ->
                    when (tab) {
                        NavTab.CHAT -> onNavigateToChat()
                        NavTab.HISTORY -> onNavigateToHistory()
                        NavTab.SETTINGS -> {} // Already on Settings
                    }
                }
            )
        },
        containerColor = ObsidianBlack
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(ObsidianBlack)
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Section 1: Desktop Connection & Pairing Status
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(ElevatedSurface)
                    .border(1.dp, GlassBorder, RoundedCornerShape(20.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (sessionManager.isPaired) StatusConnected else TextMuted)
                        )
                        Text(
                            text = "Desktop Connection",
                            color = TextPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (sessionManager.isPaired) StatusConnected.copy(alpha = 0.15f) else ElevatedSurfaceHighlight)
                            .border(1.dp, if (sessionManager.isPaired) StatusConnected.copy(alpha = 0.3f) else GlassBorder, RoundedCornerShape(12.dp))
                            .clickable { onNavigateToPairing() }
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = if (sessionManager.isPaired) "Manage Pairing" else "Pair Now",
                            color = if (sessionManager.isPaired) StatusConnected else SoftLavender,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(ElevatedSurfaceHighlight)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Workstation: ${sessionManager.desktopName ?: "None (Unpaired)"}",
                        color = TextPrimary,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "LAN Gateway: ${sessionManager.desktopUrl}",
                        color = TextMuted,
                        fontSize = 11.5.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Authentication: ${if (sessionManager.authToken != null) "Active SHA-256 Bearer Token" else "Not authenticated"}",
                        color = if (sessionManager.authToken != null) SoftLavender else StatusError,
                        fontSize = 11.5.sp
                    )
                }

                if (pingResult != null) {
                    Text(
                        text = pingResult ?: "",
                        fontSize = 12.sp,
                        color = if (pingResult?.startsWith("Online") == true) StatusConnected else StatusError,
                        fontWeight = FontWeight.Medium
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            isPinging = true
                            pingResult = null
                            coroutineScope.launch {
                                val ok = desktopApiClient.ping()
                                isPinging = false
                                pingResult = if (ok) "Online: Mechon Desktop Gateway is reachable!" else "Offline: Mechon Desktop Gateway did not respond."
                            }
                        },
                        enabled = !isPinging,
                        colors = ButtonDefaults.buttonColors(containerColor = ElevatedSurfaceHighlight),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(42.dp)
                    ) {
                        if (isPinging) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = SoftLavender)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Testing...", color = TextPrimary, fontSize = 12.sp)
                        } else {
                            Icon(imageVector = Icons.Default.NetworkCheck, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Test Gateway", color = TextPrimary, fontSize = 12.sp)
                        }
                    }

                    if (sessionManager.isPaired) {
                        OutlinedButton(
                            onClick = {
                                sessionManager.clearPairing()
                                Toast.makeText(context, "Workstation unpaired", Toast.LENGTH_SHORT).show()
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusError),
                            modifier = Modifier.height(42.dp)
                        ) {
                            Text("Unpair", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            // Section 2: Mobile Device Identity
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(ElevatedSurface)
                    .border(1.dp, GlassBorder, RoundedCornerShape(20.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Device Identity",
                    color = TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )

                OutlinedTextField(
                    value = deviceNameInput,
                    onValueChange = { deviceNameInput = it },
                    placeholder = { Text("Device Name (e.g. Pixel 9 Pro)", color = TextMuted) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = ElectricViolet,
                        unfocusedBorderColor = GlassBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Device Nonce ID: ${sessionManager.deviceId}",
                    color = TextMuted,
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace
                )

                Button(
                    onClick = {
                        sessionManager.deviceName = deviceNameInput
                        Toast.makeText(context, "Device name updated", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(40.dp)
                ) {
                    Text("Save Device Name", color = TextPrimary, fontSize = 13.sp)
                }
            }

            // Section 3: Appearance & Obsidian Identity
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(ElevatedSurface)
                    .border(1.dp, GlassBorder, RoundedCornerShape(20.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Appearance & Visual Identity",
                    color = TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(ElevatedSurfaceHighlight)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(ElectricViolet)
                        )
                        Text(
                            text = "Obsidian Dark Theme",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    Text("Active", color = SoftLavender, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Section 4: About MECHON MOBILE
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(ElevatedSurface)
                    .border(1.dp, GlassBorder, RoundedCornerShape(20.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MechonLogoMark(size = 32.dp, animated = false)
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "MECHON",
                                color = TextPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.4.sp
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "MOBILE",
                                color = SoftLavender,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp
                            )
                        }
                        Text(
                            text = "Version 1.2.7 (Build 127) • Obsidian Edition",
                            color = TextMuted,
                            fontSize = 11.sp
                        )
                    }
                }

                Text(
                    text = "Mechon Mobile is the conversational companion and dataset curation client for Mechon AI Fine-Tuning Workstation. Featuring local network inference, 10-section modular roleplay context, and 16 KB page-size compatibility.",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    lineHeight = 17.sp
                )
            }

            Spacer(modifier = Modifier.height(60.dp))
        }
    }
}
