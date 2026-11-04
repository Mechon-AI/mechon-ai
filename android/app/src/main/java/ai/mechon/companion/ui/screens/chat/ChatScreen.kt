package ai.mechon.companion.ui.screens.chat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.local.ConversationEntity
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.ui.components.*
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    conversationId: String?,
    onNavigateToRoleplay: () -> Unit,
    onNavigateToPairing: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToHistory: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    var inputText by remember { mutableStateOf("") }
    var editDialogText by remember { mutableStateOf("") }
    val context = LocalContext.current

    LaunchedEffect(conversationId) {
        viewModel.loadConversation(conversationId)
    }

    LaunchedEffect(uiState.messages.size, uiState.isInferring) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    // File / Image Picker Launcher
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                val contentResolver = context.contentResolver
                val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                val inputStream = contentResolver.openInputStream(uri)
                val bytes = inputStream?.readBytes() ?: ByteArray(0)
                inputStream?.close()

                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val name = uri.lastPathSegment ?: "attachment"

                viewModel.addAttachment(
                    AttachmentPayload(
                        name = name,
                        mimeType = mimeType,
                        dataBase64 = base64,
                        sizeBytes = bytes.size.toLong()
                    )
                )
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to load attachment: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Scaffold(
        topBar = {
            MechonMobileHeader(
                isPaired = uiState.isPaired,
                workstationName = "Mechon Workstation",
                onPairingClick = onNavigateToPairing
            )
        },
        bottomBar = {
            MechonFloatingBottomNav(
                currentTab = NavTab.CHAT,
                onTabSelected = { tab ->
                    when (tab) {
                        NavTab.CHAT -> {
                            // Already on chat; if not on blank chat, can start new
                            if (uiState.messages.isNotEmpty()) {
                                viewModel.createNewConversation()
                            }
                        }
                        NavTab.HISTORY -> onNavigateToHistory()
                        NavTab.SETTINGS -> onNavigateToSettings()
                    }
                }
            )
        },
        containerColor = ObsidianBlack
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(ObsidianBlack)
                .padding(paddingValues)
        ) {
            // Subtle Ambient Top Violet Glow
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp)
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                AmbientGlowDeep,
                                Color.Transparent
                            )
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .imePadding()
            ) {
                // Feedback Banners (Error or Sync Success)
                AnimatedVisibility(
                    visible = uiState.syncSuccessMessage != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Surface(
                        color = StatusConnected.copy(alpha = 0.15f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, StatusConnected.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = uiState.syncSuccessMessage ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = StatusConnected,
                                fontWeight = FontWeight.SemiBold
                            )
                            IconButton(
                                onClick = { viewModel.clearFeedback() },
                                modifier = Modifier.size(18.dp)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = StatusConnected, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }

                AnimatedVisibility(
                    visible = uiState.error != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Surface(
                        color = StatusError.copy(alpha = 0.15f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, StatusError.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = uiState.error ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = StatusError,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.weight(1f)
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                TextButton(
                                    onClick = { viewModel.regenerateLastResponse() },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text("Retry", color = StatusError, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                IconButton(
                                    onClick = { viewModel.clearFeedback() },
                                    modifier = Modifier.size(20.dp)
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = StatusError, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }

                // Chat Message Stream or Minimalist Welcome Center
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    if (uiState.messages.isEmpty() && !uiState.isInferring) {
                        MechonAtmosphericWelcome(
                            onPromptClick = { prompt ->
                                inputText = prompt
                            },
                            modifier = Modifier.align(Alignment.Center)
                        )
                    } else {
                        LazyColumn(
                            state = listState,
                            contentPadding = PaddingValues(top = 12.dp, bottom = 12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(uiState.messages, key = { it.id }) { msg ->
                                MessageBubble(
                                    message = msg,
                                    onActionClick = { viewModel.openMessageAction(it) }
                                )
                            }

                            if (uiState.isInferring) {
                                item {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 20.dp, vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(14.dp),
                                                strokeWidth = 2.dp,
                                                color = ElectricViolet
                                            )
                                            Text(
                                                text = "Mechon is generating...",
                                                color = TextSecondary,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }

                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(ElevatedSurface)
                                                .border(1.dp, GlassBorder, RoundedCornerShape(12.dp))
                                                .clickable { viewModel.stopGeneration() }
                                                .padding(horizontal = 10.dp, vertical = 4.dp)
                                        ) {
                                            Text(
                                                text = "Stop",
                                                color = StatusError,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Attachment Preview Tray
                if (uiState.selectedAttachments.isNotEmpty()) {
                    AttachmentTray(
                        attachments = uiState.selectedAttachments,
                        onRemoveAttachment = { viewModel.removeAttachment(it) }
                    )
                }

                // Floating Glass Composer
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .shadow(16.dp, shape = RoundedCornerShape(26.dp), spotColor = ElectricViolet.copy(alpha = 0.2f))
                            .clip(RoundedCornerShape(26.dp))
                            .background(GlassSurface)
                            .border(1.dp, GlassBorder, RoundedCornerShape(26.dp))
                            .padding(horizontal = 14.dp, vertical = 10.dp)
                    ) {
                        // Top Context Toolbar inside Composer: Model Selector & Capabilities
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Model Selector Chip (Displays actual remote desktop model)
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(ElevatedSurfaceHighlight)
                                    .border(1.dp, GlassBorder, RoundedCornerShape(14.dp))
                                    .clickable { viewModel.setModelDialogOpen(true) }
                                    .padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(ElectricViolet)
                                )
                                Text(
                                    text = (uiState.conversation?.modelId ?: "gemini-2.5-flash"),
                                    color = TextPrimary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "• ${uiState.conversation?.providerId ?: "gemini"}",
                                    color = TextMuted,
                                    fontSize = 10.sp
                                )
                                Icon(
                                    imageVector = Icons.Default.ArrowDropDown,
                                    contentDescription = "Select Model",
                                    tint = SoftLavender,
                                    modifier = Modifier.size(14.dp)
                                )
                            }

                            // Secondary Controls: Roleplay Studio & Web Search Pills
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Roleplay Studio Pill
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(ElevatedSurfaceHighlight)
                                        .clickable { onNavigateToRoleplay() }
                                        .padding(horizontal = 8.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AutoAwesome,
                                        contentDescription = "Roleplay Context",
                                        tint = SoftLavender,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Text(
                                        text = "Roleplay",
                                        color = SoftLavender,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                // Web Search Toggle Pill
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(if (uiState.webSearchEnabled) ElectricViolet.copy(alpha = 0.25f) else ElevatedSurfaceHighlight)
                                        .clickable { viewModel.toggleWebSearch() }
                                        .padding(horizontal = 8.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Language,
                                        contentDescription = "Web Search",
                                        tint = if (uiState.webSearchEnabled) SoftLavender else TextMuted,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Text(
                                        text = if (uiState.webSearchEnabled) "Search ON" else "Search",
                                        color = if (uiState.webSearchEnabled) TextPrimary else TextMuted,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }

                        // Input Field Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            // Attachment Button
                            IconButton(
                                onClick = { filePickerLauncher.launch("*/*") },
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(ElevatedSurfaceHighlight)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AttachFile,
                                    contentDescription = "Attach File",
                                    tint = SoftLavender,
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            // Multiline Message Input
                            TextField(
                                value = inputText,
                                onValueChange = { inputText = it },
                                placeholder = {
                                    Text(
                                        text = if (uiState.webSearchEnabled) "Search the web and ask..." else "Message MECHON...",
                                        color = TextMuted,
                                        fontSize = 14.sp
                                    )
                                },
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary,
                                    cursorColor = ElectricViolet,
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 40.dp, max = 120.dp)
                            )

                            Spacer(modifier = Modifier.width(8.dp))

                            // Send or Stop Generation Button
                            if (uiState.isInferring) {
                                IconButton(
                                    onClick = { viewModel.stopGeneration() },
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(CircleShape)
                                        .background(StatusError)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Stop,
                                        contentDescription = "Stop generation",
                                        tint = TextPrimary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            } else {
                                val canSend = (inputText.isNotBlank() || uiState.selectedAttachments.isNotEmpty())
                                val sendBrush = if (canSend) VioletGlowBrush else Brush.linearGradient(listOf(ElevatedSurfaceHighlight, ElevatedSurfaceHighlight))

                                IconButton(
                                    onClick = {
                                        if (canSend) {
                                            val text = inputText
                                            inputText = ""
                                            viewModel.sendMessage(text)
                                        }
                                    },
                                    enabled = canSend,
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(CircleShape)
                                        .background(sendBrush)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ArrowUpward,
                                        contentDescription = "Send",
                                        tint = if (canSend) Color.White else TextMuted,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Message Actions Sheet / Dialog
    if (uiState.activeActionMessage != null && !uiState.isEditingMessage) {
        val msg = uiState.activeActionMessage!!
        AlertDialog(
            onDismissRequest = { viewModel.closeMessageAction() },
            containerColor = ElevatedSurface,
            title = {
                Text(
                    text = if (msg.role == "user") "Your Message" else "Mechon Response",
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Copy
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(ElevatedSurfaceHighlight)
                            .clickable {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("message", msg.content))
                                Toast.makeText(context, "Copied to clipboard", Toast.LENGTH_SHORT).show()
                                viewModel.closeMessageAction()
                            }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Copy Text", color = TextPrimary, fontSize = 14.sp)
                    }

                    // Edit (User only)
                    if (msg.role == "user") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(ElevatedSurfaceHighlight)
                                .clickable {
                                    editDialogText = msg.content
                                    viewModel.startEditingMessage(msg)
                                }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Edit Message", color = TextPrimary, fontSize = 14.sp)
                        }
                    }

                    // Regenerate (Assistant only)
                    if (msg.role == "assistant") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(ElevatedSurfaceHighlight)
                                .clickable {
                                    viewModel.regenerateLastResponse()
                                    viewModel.closeMessageAction()
                                }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, tint = ElectricViolet, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Regenerate Response", color = TextPrimary, fontSize = 14.sp)
                        }
                    }

                    // Delete
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(ElevatedSurfaceHighlight)
                            .clickable {
                                viewModel.deleteMessage(msg.id)
                                viewModel.closeMessageAction()
                            }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, tint = StatusError, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Delete Message", color = StatusError, fontSize = 14.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.closeMessageAction() }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }

    // Edit User Message Dialog
    if (uiState.isEditingMessage && uiState.activeActionMessage != null) {
        val targetMsg = uiState.activeActionMessage!!
        AlertDialog(
            onDismissRequest = { viewModel.closeMessageAction() },
            containerColor = ElevatedSurface,
            title = { Text("Edit Message", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                TextField(
                    value = editDialogText,
                    onValueChange = { editDialogText = it },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = ObsidianBlack,
                        unfocusedContainerColor = ObsidianBlack,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        cursorColor = ElectricViolet
                    ),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 100.dp, max = 200.dp)
                )
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.saveEditedMessage(editDialogText) },
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet)
                ) {
                    Text("Save & Branch", color = TextPrimary)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.closeMessageAction() }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // Searchable Remote Model Selector Dialog
    if (uiState.isModelDialogOpen) {
        ModelSelectorDialog(
            models = uiState.availableModels,
            selectedModelId = uiState.conversation?.modelId ?: "",
            selectedProviderId = uiState.conversation?.providerId ?: "",
            isLoading = uiState.isModelLoading,
            errorMessage = uiState.modelFetchError,
            searchQuery = uiState.modelSearchQuery,
            onSearchQueryChange = { viewModel.setModelSearchQuery(it) },
            onRefresh = { viewModel.fetchAvailableModels(forceRefresh = true) },
            onModelSelect = { item ->
                viewModel.selectModel(item)
                viewModel.setModelDialogOpen(false)
            },
            onDismiss = {
                viewModel.setModelDialogOpen(false)
            }
        )
    }
}
