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
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ai.mechon.companion.data.search.SearchProviderType
import ai.mechon.companion.data.search.WebSearchConfig
import ai.mechon.companion.data.search.WebSearchManager
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun WebSearchSettingsDialog(
    webSearchManager: WebSearchManager,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val initialConfig = remember { webSearchManager.loadConfig() }

    var selectedProvider by remember { mutableStateOf(initialConfig.provider) }
    var apiKey by remember { mutableStateOf(initialConfig.apiKey) }
    var endpoint by remember { mutableStateOf(initialConfig.endpoint) }
    var timeoutSeconds by remember { mutableFloatStateOf(initialConfig.timeoutSeconds.toFloat()) }
    var maxResults by remember { mutableFloatStateOf(initialConfig.maxResults.toFloat()) }
    var isKeyVisible by remember { mutableStateOf(false) }

    var isTesting by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<String?>(null) }
    var testSuccess by remember { mutableStateOf(false) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f)
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
                                .clip(CircleShape)
                                .background(ElectricViolet.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Language,
                                contentDescription = null,
                                tint = SoftLavender,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Web Search Engine",
                                color = TextPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Standalone Mobile Grounding",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }

                    IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Scrollable Content
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Provider Selection Chips
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "Search Provider",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            SearchProviderType.entries.forEach { provider ->
                                val isSelected = provider == selectedProvider
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (isSelected) ElectricViolet.copy(alpha = 0.25f) else ElevatedSurfaceHighlight)
                                        .border(
                                            1.dp,
                                            if (isSelected) ElectricViolet else GlassBorder,
                                            RoundedCornerShape(10.dp)
                                        )
                                        .clickable {
                                            selectedProvider = provider
                                            if (endpoint == initialConfig.provider.defaultEndpoint) {
                                                endpoint = provider.defaultEndpoint
                                            }
                                        }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(
                                            text = provider.displayName.substringBefore(" "),
                                            color = if (isSelected) TextPrimary else TextSecondary,
                                            fontSize = 11.5.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // API Key Field
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (selectedProvider.requiresApiKey) "API Key (Required)" else "API Key (Optional)",
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Keystore Encrypted",
                                color = SoftLavender,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        OutlinedTextField(
                            value = apiKey,
                            onValueChange = { apiKey = it },
                            placeholder = { Text("Enter ${selectedProvider.displayName} API Key", color = TextMuted, fontSize = 12.sp) },
                            singleLine = true,
                            visualTransformation = if (isKeyVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            trailingIcon = {
                                IconButton(onClick = { isKeyVisible = !isKeyVisible }) {
                                    Icon(
                                        imageVector = if (isKeyVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                        contentDescription = "Toggle Visibility",
                                        tint = SoftLavender,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = ElectricViolet,
                                unfocusedBorderColor = GlassBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    // Endpoint Field
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Search API Endpoint",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )

                        OutlinedTextField(
                            value = endpoint,
                            onValueChange = { endpoint = it },
                            placeholder = { Text(selectedProvider.defaultEndpoint, color = TextMuted, fontSize = 11.5.sp) },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedBorderColor = ElectricViolet,
                                unfocusedBorderColor = GlassBorder
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    // Result Limits & Timeout
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Max Sources", color = TextPrimary, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                                Text("${maxResults.roundToInt()}", color = SoftLavender, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                            }
                            Slider(
                                value = maxResults,
                                onValueChange = { maxResults = it },
                                valueRange = 1f..10f,
                                steps = 8,
                                colors = SliderDefaults.colors(
                                    thumbColor = ElectricViolet,
                                    activeTrackColor = ElectricViolet,
                                    inactiveTrackColor = ElevatedSurfaceHighlight
                                )
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Timeout", color = TextPrimary, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                                Text("${timeoutSeconds.roundToInt()}s", color = SoftLavender, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                            }
                            Slider(
                                value = timeoutSeconds,
                                onValueChange = { timeoutSeconds = it },
                                valueRange = 5f..30f,
                                steps = 24,
                                colors = SliderDefaults.colors(
                                    thumbColor = ElectricViolet,
                                    activeTrackColor = ElectricViolet,
                                    inactiveTrackColor = ElevatedSurfaceHighlight
                                )
                            )
                        }
                    }

                    // Test Status Banner
                    if (testResult != null) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            color = if (testSuccess) StatusConnected.copy(alpha = 0.15f) else StatusError.copy(alpha = 0.15f),
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(if (testSuccess) StatusConnected else StatusError)
                            )
                        ) {
                            Text(
                                text = testResult ?: "",
                                color = if (testSuccess) StatusConnected else StatusError,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    // Architecture Isolation Note
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = ElevatedSurfaceHighlight,
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = androidx.compose.ui.graphics.SolidColor(GlassBorder)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Security, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(16.dp))
                            Text(
                                text = "Web Search executes locally on your phone without desktop gateway dependency. Keys are Keystore-isolated and never included in dataset exports.",
                                color = TextMuted,
                                fontSize = 11.sp,
                                lineHeight = 15.sp
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
                    OutlinedButton(
                        onClick = {
                            isTesting = true
                            testResult = null
                            val tempConfig = WebSearchConfig(
                                provider = selectedProvider,
                                apiKey = apiKey.trim(),
                                endpoint = endpoint.trim().ifBlank { selectedProvider.defaultEndpoint },
                                timeoutSeconds = timeoutSeconds.roundToInt(),
                                maxResults = 1
                            )
                            coroutineScope.launch {
                                val res = webSearchManager.testConnection(tempConfig)
                                isTesting = false
                                res.fold(
                                    onSuccess = {
                                        testSuccess = true
                                        testResult = "Connection Verified: ${selectedProvider.displayName} API responded successfully!"
                                    },
                                    onFailure = { err ->
                                        testSuccess = false
                                        testResult = "Connection Failed: ${err.message ?: "Unknown error"}"
                                    }
                                )
                            }
                        },
                        enabled = !isTesting,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) {
                        if (isTesting) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = SoftLavender)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Testing...", fontSize = 12.sp)
                        } else {
                            Icon(Icons.Default.NetworkCheck, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Test API", fontSize = 12.sp)
                        }
                    }

                    Button(
                        onClick = {
                            val newConfig = WebSearchConfig(
                                provider = selectedProvider,
                                apiKey = apiKey.trim(),
                                endpoint = endpoint.trim().ifBlank { selectedProvider.defaultEndpoint },
                                timeoutSeconds = timeoutSeconds.roundToInt(),
                                maxResults = maxResults.roundToInt()
                            )
                            webSearchManager.saveConfig(newConfig)
                            Toast.makeText(context, "Web Search configuration saved", Toast.LENGTH_SHORT).show()
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) {
                        Text("Save Config", fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
