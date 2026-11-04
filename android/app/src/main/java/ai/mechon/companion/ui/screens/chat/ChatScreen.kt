package ai.mechon.companion.ui.screens.chat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
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
import ai.mechon.companion.data.local.ConversationEntity
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    conversationId: String?,
    onNavigateToRoleplay: () -> Unit,
    onNavigateToPairing: () -> Unit,
    onNavigateToSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()
    var inputText by remember { mutableStateOf("") }
    var editDialogText by remember { mutableStateOf("") }
    var renameDialogTarget by remember { mutableStateOf<ConversationEntity?>(null) }
    var renameInputText by remember { mutableStateOf("") }
    val context = LocalContext.current

    LaunchedEffect(conversationId) {
        viewModel.loadConversation(conversationId)
    }

    LaunchedEffect(uiState.messages.size, uiState.isInferring) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    // File / Image Picker Launchers
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
                val name = uri.lastPathSegment ?: "file"

                viewModel.addAttachment(
                    AttachmentPayload(
                        name = name,
                        mimeType = mimeType,
                        dataBase64 = base64,
                        sizeBytes = bytes.size.toLong()
                    )
                )
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to load file: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = MechonSurface,
                modifier = Modifier.width(320.dp)
            ) {
                ConversationDrawerContent(
                    conversations = uiState.conversationsList,
                    activeConversationId = uiState.conversation?.id,
                    searchQuery = uiState.searchQuery,
                    selectedForSyncIds = uiState.selectedForSyncIds,
                    isSyncing = uiState.isSyncing,
                    onSearchQueryChange = { viewModel.updateSearchQuery(it) },
                    onSelectConversation = { id ->
                        viewModel.loadConversation(id)
                        coroutineScope.launch { drawerState.close() }
                    },
                    onNewConversation = {
                        viewModel.createNewConversation {
                            coroutineScope.launch { drawerState.close() }
                        }
                    },
                    onRename = { conv ->
                        renameDialogTarget = conv
                        renameInputText = conv.title
                    },
                    onDuplicate = { conv -> viewModel.duplicateConversation(conv.id) },
                    onArchive = { conv -> viewModel.archiveConversation(conv.id) },
                    onDelete = { conv -> viewModel.deleteConversation(conv.id) },
                    onToggleSyncSelection = { conv -> viewModel.toggleSyncSelection(conv.id) },
                    onSyncSelected = { viewModel.syncSelectedConversations() },
                    onNavigateToRoleplay = {
                        coroutineScope.launch { drawerState.close() }
                        onNavigateToRoleplay()
                    },
                    onNavigateToPairing = {
                        coroutineScope.launch { drawerState.close() }
                        onNavigateToPairing()
                    },
                    onNavigateToSettings = {
                        coroutineScope.launch { drawerState.close() }
                        onNavigateToSettings()
                    }
                )
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = uiState.conversation?.title ?: "Mechon Chat",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                maxLines = 1
                            )
                            // Model & Provider Pill
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
                                        text = "${uiState.conversation?.modelId ?: "Select Model"} • ${uiState.conversation?.providerId ?: "auto"}",
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
                        IconButton(onClick = { coroutineScope.launch { drawerState.open() } }) {
                            Icon(
                                imageVector = Icons.Default.Menu,
                                contentDescription = "Open Conversation Drawer",
                                tint = TextPrimary
                            )
                        }
                    },
                    actions = {
                        // Web Search Toggle Action
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
                // Feedback Banners (Error or Sync Success)
                if (uiState.syncSuccessMessage != null) {
                    Surface(
                        color = MechonGreen.copy(alpha = 0.2f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = uiState.syncSuccessMessage ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = MechonGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                            IconButton(
                                onClick = { viewModel.clearFeedback() },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = null, tint = MechonGreen, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

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
                            TextButton(onClick = { viewModel.regenerateLastResponse() }) {
                                Text("Retry", color = MechonRed, fontWeight = FontWeight.Bold)
                            }
                            IconButton(
                                onClick = { viewModel.clearError() },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = null, tint = MechonRed, modifier = Modifier.size(16.dp))
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
                                        modifier = Modifier.size(54.dp)
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text(
                                        text = "Mechon Conversational Companion",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = TextSecondary
                                    )
                                    Text(
                                        text = "Engage in multi-turn dialogue, experiment with roleplay, and send select sessions to Mechon Desktop for SFT engineering.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextMuted,
                                        modifier = Modifier.padding(horizontal = 32.dp, vertical = 6.dp),
                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                    )
                                }
                            }
                        }
                    }

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
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = MechonCyan
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Generating response...",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextMuted
                                    )
                                }
                                OutlinedButton(
                                    onClick = { viewModel.stopGeneration() },
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MechonRed),
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Text("Stop", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // Attachment Tray
                AttachmentTray(
                    attachments = uiState.selectedAttachments,
                    onRemoveAttachment = { viewModel.removeAttachment(it) }
                )

                // Composer Context Toolbar (Roleplay pill, search toggle, model pill)
                Surface(
                    color = MechonSurfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Roleplay Context Indicator Pill
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MechonPurple.copy(alpha = 0.2f),
                            modifier = Modifier.clickable { onNavigateToRoleplay() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.TheaterComedy, contentDescription = null, tint = MechonPurple, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Roleplay Context", color = MechonPurple, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }

                        // Web Search Pill Toggle
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (uiState.webSearchEnabled) MechonCyan.copy(alpha = 0.2f) else MechonSurface,
                            modifier = Modifier.clickable { viewModel.toggleWebSearch() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Language, contentDescription = null, tint = if (uiState.webSearchEnabled) MechonCyan else TextMuted, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (uiState.webSearchEnabled) "Search: ON" else "Search: OFF",
                                    color = if (uiState.webSearchEnabled) MechonCyan else TextMuted,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                // Expandable Composer Input Bar
                Surface(
                    color = MechonSurface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        // Attachment Action Button
                        IconButton(
                            onClick = { filePickerLauncher.launch("*/*") }
                        ) {
                            Icon(
                                imageVector = Icons.Default.AttachFile,
                                contentDescription = "Attach File",
                                tint = TextSecondary
                            )
                        }

                        // Multiline Auto-Expanding TextField
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
                                .heightIn(min = 44.dp, max = 130.dp)
                        )

                        Spacer(modifier = Modifier.width(6.dp))

                        // Send or Stop Generation Button
                        if (uiState.isInferring) {
                            IconButton(
                                onClick = { viewModel.stopGeneration() },
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(MechonRed)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Stop,
                                    contentDescription = "Stop generation",
                                    tint = TextPrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        } else {
                            val canSend = (inputText.isNotBlank() || uiState.selectedAttachments.isNotEmpty())
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
        }
    }

    // Message Actions Bottom Sheet / Dialog
    if (uiState.activeActionMessage != null && !uiState.isEditingMessage) {
        val msg = uiState.activeActionMessage!!
        AlertDialog(
            onDismissRequest = { viewModel.closeMessageAction() },
            title = {
                Text(
                    text = if (msg.role == "user") "Your Message" else "Assistant Response",
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Copy
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MechonSurfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("message", msg.content))
                                Toast.makeText(context, "Copied to clipboard", Toast.LENGTH_SHORT).show()
                                viewModel.closeMessageAction()
                            }
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.ContentCopy, contentDescription = null, tint = MechonBlueLight, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Copy Message Text", color = TextPrimary)
                        }
                    }

                    // Edit
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MechonSurfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                editDialogText = msg.content
                                viewModel.startEditingMessage(msg)
                            }
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Edit, contentDescription = null, tint = MechonCyan, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Edit Message Content", color = TextPrimary)
                        }
                    }

                    // Regenerate (if assistant or user)
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MechonSurfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                viewModel.closeMessageAction()
                                viewModel.regenerateLastResponse()
                            }
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Refresh, contentDescription = null, tint = MechonPurple, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Regenerate Response", color = TextPrimary)
                        }
                    }

                    // Delete
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MechonSurfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                viewModel.deleteMessage(msg.id)
                            }
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Delete, contentDescription = null, tint = MechonRed, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Delete Message", color = MechonRed)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.closeMessageAction() }) {
                    Text("Close", color = TextMuted)
                }
            },
            containerColor = MechonSurface
        )
    }

    // Edit Message Dialog
    if (uiState.isEditingMessage) {
        AlertDialog(
            onDismissRequest = { viewModel.closeMessageAction() },
            title = { Text("Edit Message", color = TextPrimary) },
            text = {
                OutlinedTextField(
                    value = editDialogText,
                    onValueChange = { editDialogText = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 100.dp, max = 220.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = MechonBlueLight,
                        unfocusedBorderColor = MechonBorder
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.saveEditedMessage(editDialogText) },
                    colors = ButtonDefaults.buttonColors(containerColor = MechonBlue)
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.closeMessageAction() }) {
                    Text("Cancel", color = TextMuted)
                }
            },
            containerColor = MechonSurface
        )
    }

    // Rename Conversation Dialog
    if (renameDialogTarget != null) {
        AlertDialog(
            onDismissRequest = { renameDialogTarget = null },
            title = { Text("Rename Conversation", color = TextPrimary) },
            text = {
                OutlinedTextField(
                    value = renameInputText,
                    onValueChange = { renameInputText = it },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = MechonBlueLight,
                        unfocusedBorderColor = MechonBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val target = renameDialogTarget
                        if (target != null && renameInputText.isNotBlank()) {
                            viewModel.renameConversation(target.id, renameInputText.trim())
                        }
                        renameDialogTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MechonBlue)
                ) {
                    Text("Rename")
                }
            },
            dismissButton = {
                TextButton(onClick = { renameDialogTarget = null }) {
                    Text("Cancel", color = TextMuted)
                }
            },
            containerColor = MechonSurface
        )
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

@Composable
fun ConversationDrawerContent(
    conversations: List<ConversationEntity>,
    activeConversationId: String?,
    searchQuery: String,
    selectedForSyncIds: Set<String>,
    isSyncing: Boolean,
    onSearchQueryChange: (String) -> Unit,
    onSelectConversation: (String) -> Unit,
    onNewConversation: () -> Unit,
    onRename: (ConversationEntity) -> Unit,
    onDuplicate: (ConversationEntity) -> Unit,
    onArchive: (ConversationEntity) -> Unit,
    onDelete: (ConversationEntity) -> Unit,
    onToggleSyncSelection: (ConversationEntity) -> Unit,
    onSyncSelected: () -> Unit,
    onNavigateToRoleplay: () -> Unit,
    onNavigateToPairing: () -> Unit,
    onNavigateToSettings: () -> Unit
) {
    val dateFormat = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())

    Column(modifier = Modifier.fillMaxSize()) {
        // Drawer Header with "New Chat"
        Surface(
            color = MechonSurfaceVariant,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Conversations",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Button(
                        onClick = onNewConversation,
                        colors = ButtonDefaults.buttonColors(containerColor = MechonBlue),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("New Chat", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Search field
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchQueryChange,
                    placeholder = { Text("Search chats...", color = TextMuted, fontSize = 12.sp) },
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = MechonBlue,
                        unfocusedBorderColor = MechonBorder,
                        focusedContainerColor = MechonDarkBg,
                        unfocusedContainerColor = MechonDarkBg
                    ),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                )
            }
        }

        // Conversation List
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(conversations, key = { it.id }) { conv ->
                val isActive = conv.id == activeConversationId
                val isSelectedForSync = selectedForSyncIds.contains(conv.id)

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isActive) MechonSurfaceVariant else MechonSurface,
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        brush = androidx.compose.ui.graphics.SolidColor(
                            if (isActive) MechonBlue else MechonBorder
                        )
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectConversation(conv.id) }
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = conv.title,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                                color = if (isActive) MechonBlueLight else TextPrimary,
                                maxLines = 1,
                                modifier = Modifier.weight(1f)
                            )
                            Checkbox(
                                checked = isSelectedForSync,
                                onCheckedChange = { onToggleSyncSelection(conv) },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = MechonGreen,
                                    checkmarkColor = TextPrimary
                                ),
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${conv.modelId} • ${dateFormat.format(Date(conv.updatedAt))}",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextMuted,
                                fontSize = 10.sp
                            )

                            // Quick Actions: Rename, Duplicate, Archive, Delete
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = { onRename(conv) },
                                    modifier = Modifier.size(20.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = "Rename", tint = TextMuted, modifier = Modifier.size(12.dp))
                                }
                                IconButton(
                                    onClick = { onDuplicate(conv) },
                                    modifier = Modifier.size(20.dp)
                                ) {
                                    Icon(Icons.Default.ContentCopy, contentDescription = "Duplicate", tint = TextMuted, modifier = Modifier.size(12.dp))
                                }
                                IconButton(
                                    onClick = { onDelete(conv) },
                                    modifier = Modifier.size(20.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MechonRed, modifier = Modifier.size(12.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Batch Sync Bar if selected
        if (selectedForSyncIds.isNotEmpty()) {
            Surface(
                color = MechonSurfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Button(
                    onClick = onSyncSelected,
                    enabled = !isSyncing,
                    colors = ButtonDefaults.buttonColors(containerColor = MechonGreen),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp)
                        .height(40.dp)
                ) {
                    if (isSyncing) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = TextPrimary)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Sending to Desktop...")
                    } else {
                        Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Send to Desktop (${selectedForSyncIds.size})", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }

        // Drawer Bottom Links
        Surface(
            color = MechonDarkBg,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Surface(
                    color = MechonSurface,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToRoleplay() }
                ) {
                    Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.TheaterComedy, contentDescription = null, tint = MechonPurple, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Roleplay Configuration Studio", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Surface(
                    color = MechonSurface,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToPairing() }
                ) {
                    Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Lan, contentDescription = null, tint = MechonBlueLight, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Desktop Pairing & LAN Discovery", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Surface(
                    color = MechonSurface,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToSettings() }
                ) {
                    Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Settings, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Settings & Diagnostics", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
