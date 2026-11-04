package ai.mechon.companion.ui.screens.diagnostics

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ai.mechon.companion.data.remote.ConnectionDiagnostics
import ai.mechon.companion.data.remote.ConnectionState
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ConnectionDiagnosticsDialog(
    isOpen: Boolean,
    diagnostics: ConnectionDiagnostics,
    onDismiss: () -> Unit,
    onTestConnection: suspend () -> Unit,
    onOpenPairing: (() -> Unit)? = null
) {
    if (!isOpen) return

    val coroutineScope = rememberCoroutineScope()
    var isTesting by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.85f)
                .clip(RoundedCornerShape(24.dp))
                .border(1.dp, GlassBorder, RoundedCornerShape(24.dp)),
            color = ObsidianBlack
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(MechonPurple.copy(alpha = 0.2f))
                                .border(1.dp, MechonPurple.copy(alpha = 0.4f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.NetworkCheck,
                                contentDescription = null,
                                tint = SoftLavender,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "CONNECTION DIAGNOSTICS",
                                color = TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.1.sp
                            )
                            Text(
                                text = "Live 7-Stage Application Verification",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Overall Status Banner
                val statusColor = when (diagnostics.state) {
                    ConnectionState.READY -> StatusConnected
                    ConnectionState.CONNECTED, ConnectionState.SYNCHRONIZING, ConnectionState.DEGRADED -> StatusWarning
                    ConnectionState.RECONNECTING -> StatusWarning
                    ConnectionState.ERROR -> StatusError
                    else -> TextMuted
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(statusColor.copy(alpha = 0.12f))
                        .border(1.dp, statusColor.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(statusColor)
                    )

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = diagnostics.state.name,
                            color = statusColor,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = when (diagnostics.state) {
                                ConnectionState.READY -> "100% Operational. Transport, auth, and models verified."
                                ConnectionState.DEGRADED -> "Connected, but no active providers or models configured."
                                ConnectionState.CONNECTED -> "Transport connected. Application verification in progress."
                                ConnectionState.ERROR -> diagnostics.lastError ?: "Connection or authentication error."
                                ConnectionState.RECONNECTING -> "Desktop unreachable. Retrying with exponential backoff..."
                                else -> "Unpaired or disconnected."
                            },
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                    }

                    if (diagnostics.latencyMs > 0) {
                        Text(
                            text = "${diagnostics.latencyMs} ms",
                            color = SoftLavender,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Scrollable Diagnostic Metrics & 7-Stage Pipeline
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Diagnostic Overview Card
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ElevatedSurface)
                            .border(1.dp, GlassBorder, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "NETWORK & HOST METRICS",
                            color = SoftLavender,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        DiagnosticRow("Transport", diagnostics.transport)
                        DiagnosticRow("Endpoint", diagnostics.targetEndpoint.ifBlank { "Not configured" })
                        DiagnosticRow("Desktop Name", diagnostics.desktopName.ifBlank { "Unknown" })
                        DiagnosticRow("Desktop Version", diagnostics.desktopVersion.ifBlank { "Unknown" })
                        DiagnosticRow("Active Providers", "${diagnostics.activeProvidersCount} configured")
                        DiagnosticRow("Available Models", "${diagnostics.availableModelsCount} models")
                    }

                    // 7-Stage Verification Pipeline Card
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ElevatedSurface)
                            .border(1.dp, GlassBorder, RoundedCornerShape(14.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "7-STAGE APPLICATION PIPELINE",
                            color = SoftLavender,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        StageCheckItem(1, "TCP Connection Established", diagnostics.isTcpConnected)
                        StageCheckItem(2, "Application Authentication", diagnostics.isAuthenticated)
                        StageCheckItem(3, "Desktop Identity Verified", diagnostics.isIdentityVerified)
                        StageCheckItem(4, "Health Check Responded OK", diagnostics.isHealthOk)
                        StageCheckItem(5, "Desktop Capabilities Retrieved", diagnostics.isCapabilitiesOk)
                        StageCheckItem(6, "Desktop Providers Retrieved", diagnostics.activeProvidersCount > 0)
                        StageCheckItem(7, "Model Registry Synchronized", diagnostics.availableModelsCount > 0)
                    }

                    if (!diagnostics.lastError.isNullOrBlank()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(StatusError.copy(alpha = 0.1f))
                                .border(1.dp, StatusError.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = "LAST ERROR",
                                color = StatusError,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = diagnostics.lastError,
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            if (!isTesting) {
                                isTesting = true
                                coroutineScope.launch {
                                    try {
                                        onTestConnection()
                                    } finally {
                                        isTesting = false
                                    }
                                }
                            }
                        },
                        enabled = !isTesting && !diagnostics.isChecking,
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MechonPurple,
                            disabledContainerColor = MechonPurple.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (isTesting || diagnostics.isChecking) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Testing Pipeline...", fontSize = 12.sp)
                        } else {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Test Connection", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    if (onOpenPairing != null) {
                        OutlinedButton(
                            onClick = {
                                onDismiss()
                                onOpenPairing()
                            },
                            modifier = Modifier.height(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, GlassBorder)
                        ) {
                            Text("Pairing Settings", color = SoftLavender, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DiagnosticRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, color = TextMuted, fontSize = 11.5.sp)
        Text(
            text = value,
            color = TextPrimary,
            fontSize = 11.5.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun StageCheckItem(stage: Int, title: String, passed: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = if (passed) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (passed) StatusConnected else TextMuted,
            modifier = Modifier.size(16.dp)
        )
        Text(
            text = "$stage. $title",
            color = if (passed) TextPrimary else TextSecondary,
            fontSize = 11.5.sp
        )
    }
}
