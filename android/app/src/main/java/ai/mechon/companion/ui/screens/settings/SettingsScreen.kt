package ai.mechon.companion.ui.screens.settings

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.remote.DesktopApiClient
import ai.mechon.companion.data.remote.SessionManager
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    sessionManager: SessionManager,
    desktopApiClient: DesktopApiClient,
    onNavigateBack: () -> Unit,
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
                    Text(
                        text = "Settings",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = TextPrimary
                        )
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Version Card
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MechonSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Mechon AI Android Companion",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Version 1.2.4 (Build 124)",
                        style = MaterialTheme.typography.labelMedium,
                        color = MechonBlueLight
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Mobile conversational companion and SFT dataset staging client for Mechon AI Fine-Tuning Workstation.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted
                    )
                }
            }

            // Connection Diagnostics Card
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MechonSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Desktop Gateway Diagnostics",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Endpoint: ${sessionManager.desktopUrl}",
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = TextSecondary
                    )
                    Text(
                        text = "Status: ${if (sessionManager.isPaired) "Paired (${sessionManager.desktopName ?: "Desktop"})" else "Unpaired"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (sessionManager.isPaired) MechonGreen else TextMuted
                    )

                    if (pingResult != null) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = pingResult ?: "",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (pingResult?.startsWith("Online") == true) MechonGreen else MechonRed
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            isPinging = true
                            pingResult = null
                            coroutineScope.launch {
                                val ok = desktopApiClient.ping()
                                isPinging = false
                                pingResult = if (ok) "Online: Desktop Gateway reachable!" else "Offline: Desktop Gateway did not respond."
                            }
                        },
                        enabled = !isPinging,
                        colors = ButtonDefaults.buttonColors(containerColor = MechonSurfaceVariant),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isPinging) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = TextPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Pinging Desktop...")
                        } else {
                            Icon(imageVector = Icons.Default.NetworkCheck, contentDescription = null, tint = MechonBlueLight)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Test LAN Gateway Connection", color = TextPrimary)
                        }
                    }
                }
            }

            // Device Identity Card
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MechonSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Device Identity",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = deviceNameInput,
                        onValueChange = { deviceNameInput = it },
                        label = { Text("Mobile Device Name") },
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

                    Text(
                        text = "Device ID: ${sessionManager.deviceId}",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = TextMuted
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            sessionManager.deviceName = deviceNameInput
                            Toast.makeText(context, "Device name saved", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MechonBlue),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Device Name")
                    }
                }
            }
        }
    }
}
