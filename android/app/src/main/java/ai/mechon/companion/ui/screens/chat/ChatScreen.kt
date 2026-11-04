package ai.mechon.companion.ui.screens.chat

import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    conversationId: String?,
    onNavigateToRoleplay: () -> Unit,
    onNavigateToConversations: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    var inputText by remember { mutableStateOf("") }
    val context = LocalContext.current

    LaunchedEffect(conversationId) {
        viewModel.loadConversation(conversationId)
    }

    // Scroll to bottom on new messages
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
                // Ignore or show error
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = uiState.conversation?.title ?: "Chat",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            maxLines = 1
                        )
                        // Model Selector Pill
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MechonSurfaceVariant,
                            modifier = Modifier
                                .padding(top = 2.dp)
                                .clickable { viewModel.setModelDialogOpen(true) }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = uiState.conversation?.modelId ?: "Select Model",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MechonBlueLight,
                                    fontSize = 11.sp
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.Default.ArrowDropDown,
                                    contentDescription = null,
                                    tint = MechonBlueLight,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateToConversations) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Conversations",
                            tint = TextPrimary
                        )
                    }
                },
                actions = {
                    // Web Search Toggle
                    IconButton(onClick = { viewModel.toggleWebSearch() }) {
                        Icon(
                            imageVector = Icons.Default.Language,
                            contentDescription = "Toggle Web Search",
                            tint = if (uiState.webSearchEnabled) MechonCyan else TextMuted
                        )
                    }
                    // Roleplay Studio Shortcut
                    IconButton(onClick = onNavigateToRoleplay) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = "Roleplay Studio",
                            tint = MechonPurple
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
        ) {
            // Error Banner if any
            if (uiState.error != null) {
                Surface(
                    color = MechonRed.copy(alpha = 0.2f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = uiState.error ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MechonRed,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = { viewModel.clearError() },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Dismiss",
                                tint = MechonRed,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            // Messages Viewport
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                if (uiState.messages.isEmpty() && !uiState.isInferring) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 80.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Default.ChatBubbleOutline,
                                    contentDescription = null,
                                    tint = TextMuted,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "Ready to Chat",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = TextSecondary
                                )
                                Text(
                                    text = "Send a prompt, attach an image, or configure Roleplay Studio.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextMuted,
                                    modifier = Modifier.padding(horizontal = 32.dp, vertical = 4.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                    }
                }

                items(uiState.messages, key = { it.id }) { msg ->
                    MessageBubble(message = msg)
                }

                if (uiState.isInferring) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MechonCyan
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Mechon is generating response...",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextMuted
                            )
                        }
                    }
                }
            }

            // Attachment Tray
            AttachmentTray(
                attachments = uiState.selectedAttachments,
                onRemoveAttachment = { viewModel.removeAttachment(it) }
            )

            // Input Bar
            Surface(
                color = MechonSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Attachment Picker Button
                    IconButton(
                        onClick = { filePickerLauncher.launch("*/*") }
                    ) {
                        Icon(
                            imageVector = Icons.Default.AttachFile,
                            contentDescription = "Attach File",
                            tint = TextSecondary
                        )
                    }

                    // Input Field
                    TextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                text = if (uiState.webSearchEnabled) "Ask with web search..." else "Write a message...",
                                color = TextMuted,
                                fontSize = 14.sp
                            )
                        },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = MechonDarkBg,
                            unfocusedContainerColor = MechonDarkBg,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            cursorColor = MechonBlueLight,
                            focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                            unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent
                        ),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 44.dp, max = 120.dp)
                    )

                    Spacer(modifier = Modifier.width(6.dp))

                    // Send Button
                    val canSend = (inputText.isNotBlank() || uiState.selectedAttachments.isNotEmpty()) && !uiState.isInferring
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
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(if (canSend) MechonBlue else MechonSurfaceVariant)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = "Send",
                            tint = if (canSend) TextPrimary else TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }

    // Model Selector Dialog
    if (uiState.isModelDialogOpen) {
        ModelSelectorDialog(
            models = uiState.availableModels,
            selectedModelId = uiState.conversation?.modelId ?: "",
            onModelSelect = { item -> viewModel.selectModel(item) },
            onDismiss = { viewModel.setModelDialogOpen(false) }
        )
    }
}
