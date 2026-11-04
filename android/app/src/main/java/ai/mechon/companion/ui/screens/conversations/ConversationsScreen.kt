package ai.mechon.companion.ui.screens.conversations

import android.text.format.DateUtils
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.local.ConversationEntity
import ai.mechon.companion.ui.components.*
import ai.mechon.companion.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationsScreen(
    viewModel: ConversationsViewModel,
    onConversationSelected: (String) -> Unit,
    onNavigateToChat: () -> Unit,
    onNavigateToPairing: () -> Unit,
    onNavigateToSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    var isSearchVisible by remember { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<ConversationEntity?>(null) }
    var renameText by remember { mutableStateOf("") }

    // Date Grouping logic: Today, Yesterday, Previous 7 Days, Older
    val groupedConversations = remember(uiState.filteredConversations) {
        val now = System.currentTimeMillis()
        val calendar = Calendar.getInstance()

        calendar.timeInMillis = now
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val todayStart = calendar.timeInMillis

        calendar.add(Calendar.DAY_OF_YEAR, -1)
        val yesterdayStart = calendar.timeInMillis

        calendar.add(Calendar.DAY_OF_YEAR, -6)
        val weekStart = calendar.timeInMillis

        val groups = linkedMapOf<String, MutableList<ConversationEntity>>()

        uiState.filteredConversations.sortedByDescending { it.updatedAt }.forEach { conv ->
            val groupKey = when {
                conv.updatedAt >= todayStart -> "Today"
                conv.updatedAt >= yesterdayStart -> "Yesterday"
                conv.updatedAt >= weekStart -> "Previous 7 Days"
                else -> "Older"
            }
            groups.getOrPut(groupKey) { mutableListOf() }.add(conv)
        }
        groups
    }

    Scaffold(
        topBar = {
            if (uiState.isSelectionMode) {
                TopAppBar(
                    title = {
                        Text(
                            text = "${uiState.selectedIds.size} Selected",
                            color = SoftLavender,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { viewModel.clearSelection() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = TextPrimary)
                        }
                    },
                    actions = {
                        IconButton(onClick = { viewModel.selectAll() }) {
                            Icon(Icons.Default.SelectAll, contentDescription = "Select All", tint = SoftLavender)
                        }
                        IconButton(onClick = { viewModel.sendSelectedToDesktop() }) {
                            Icon(Icons.Default.CloudUpload, contentDescription = "Send to Desktop", tint = ElectricViolet)
                        }
                        IconButton(onClick = { viewModel.deleteSelected() }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusError)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = ObsidianBlack)
                )
            } else {
                TopAppBar(
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            MechonLogoMark(size = 24.dp)
                            Text(
                                text = "Conversation History",
                                color = TextPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    },
                    actions = {
                        IconButton(onClick = { isSearchVisible = !isSearchVisible }) {
                            Icon(Icons.Default.Search, contentDescription = "Search", tint = SoftLavender)
                        }
                        IconButton(onClick = {
                            viewModel.createNewConversation { newId ->
                                onConversationSelected(newId)
                            }
                        }) {
                            Icon(Icons.Default.Add, contentDescription = "New Chat", tint = TextPrimary)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = ObsidianBlack)
                )
            }
        },
        bottomBar = {
            if (!uiState.isSelectionMode) {
                MechonFloatingBottomNav(
                    currentTab = NavTab.HISTORY,
                    onTabSelected = { tab ->
                        when (tab) {
                            NavTab.CHAT -> onNavigateToChat()
                            NavTab.HISTORY -> {} // Already on History
                            NavTab.SETTINGS -> onNavigateToSettings()
                        }
                    }
                )
            }
        },
        containerColor = ObsidianBlack
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(ObsidianBlack)
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Search Field (Animated Visibility)
                AnimatedVisibility(
                    visible = isSearchVisible && !uiState.isSelectionMode,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        TextField(
                            value = uiState.searchQuery,
                            onValueChange = { viewModel.setSearchQuery(it) },
                            placeholder = { Text("Search conversations...", color = TextMuted, fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(18.dp)) },
                            trailingIcon = {
                                if (uiState.searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { viewModel.setSearchQuery("") }, modifier = Modifier.size(20.dp)) {
                                        Icon(Icons.Default.Clear, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
                                    }
                                }
                            },
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = ElevatedSurface,
                                unfocusedContainerColor = ElevatedSurface,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                cursorColor = ElectricViolet,
                                focusedIndicatorColor = Color.Transparent,
                                unfocusedIndicatorColor = Color.Transparent
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .border(1.dp, GlassBorder, RoundedCornerShape(16.dp))
                        )
                    }
                }

                // Feedback Banners (Sync / Error)
                AnimatedVisibility(
                    visible = uiState.syncSuccessMessage != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Surface(
                        color = StatusConnected.copy(alpha = 0.15f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, StatusConnected.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = uiState.syncSuccessMessage ?: "",
                                color = StatusConnected,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            IconButton(onClick = { viewModel.clearFeedback() }, modifier = Modifier.size(18.dp)) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = StatusConnected, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }

                AnimatedVisibility(
                    visible = uiState.errorMessage != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Surface(
                        color = StatusError.copy(alpha = 0.15f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, StatusError.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = uiState.errorMessage ?: "",
                                color = StatusError,
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = { viewModel.clearFeedback() }, modifier = Modifier.size(18.dp)) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = StatusError, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }

                // History List
                if (groupedConversations.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ChatBubbleOutline,
                                contentDescription = null,
                                tint = TextMuted,
                                modifier = Modifier.size(44.dp)
                            )
                            Text(
                                text = "No conversation history",
                                color = TextSecondary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "Start a chat or roleplay session to begin.",
                                color = TextMuted,
                                fontSize = 12.sp
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 16.dp),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 80.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        groupedConversations.forEach { (dateHeader, convs) ->
                            item(key = "header_$dateHeader") {
                                Text(
                                    text = dateHeader.uppercase(),
                                    color = SoftLavender,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.2.sp,
                                    modifier = Modifier.padding(start = 4.dp, top = 12.dp, bottom = 4.dp)
                                )
                            }

                            items(convs, key = { it.id }) { conv ->
                                val isSelected = uiState.selectedIds.contains(conv.id)
                                val timeFormatted = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(conv.updatedAt))

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(if (isSelected) ElectricViolet.copy(alpha = 0.2f) else ElevatedSurface)
                                        .border(1.dp, if (isSelected) ElectricViolet else GlassBorder, RoundedCornerShape(16.dp))
                                        .clickable {
                                            if (uiState.isSelectionMode) {
                                                viewModel.toggleSelection(conv.id)
                                            } else {
                                                onConversationSelected(conv.id)
                                            }
                                        }
                                        .padding(horizontal = 14.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        if (uiState.isSelectionMode) {
                                            Checkbox(
                                                checked = isSelected,
                                                onCheckedChange = { viewModel.toggleSelection(conv.id) },
                                                colors = CheckboxDefaults.colors(
                                                    checkedColor = ElectricViolet,
                                                    uncheckedColor = TextMuted
                                                ),
                                                modifier = Modifier.size(20.dp)
                                            )
                                        } else {
                                            Box(
                                                modifier = Modifier
                                                    .size(34.dp)
                                                    .clip(CircleShape)
                                                    .background(ElevatedSurfaceHighlight),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.ChatBubble,
                                                    contentDescription = null,
                                                    tint = SoftLavender,
                                                    modifier = Modifier.size(15.dp)
                                                )
                                            }
                                        }

                                        Column {
                                            Text(
                                                text = conv.title.ifBlank { "New Conversation" },
                                                color = TextPrimary,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )

                                            Spacer(modifier = Modifier.height(2.dp))

                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                Text(
                                                    text = conv.modelId,
                                                    color = SoftLavender,
                                                    fontSize = 11.sp,
                                                    maxLines = 1
                                                )
                                                Text(text = "•", color = TextMuted, fontSize = 10.sp)
                                                Text(
                                                    text = timeFormatted,
                                                    color = TextMuted,
                                                    fontSize = 11.sp
                                                )
                                            }
                                        }
                                    }

                                    // Context Actions Menu
                                    if (!uiState.isSelectionMode) {
                                        var menuOpen by remember { mutableStateOf(false) }

                                        Box {
                                            IconButton(
                                                onClick = { menuOpen = true },
                                                modifier = Modifier.size(28.dp)
                                            ) {
                                                Icon(Icons.Default.MoreVert, contentDescription = "Options", tint = TextMuted, modifier = Modifier.size(16.dp))
                                            }

                                            DropdownMenu(
                                                expanded = menuOpen,
                                                onDismissRequest = { menuOpen = false },
                                                modifier = Modifier
                                                    .background(ElevatedSurface)
                                                    .border(1.dp, GlassBorder, RoundedCornerShape(8.dp))
                                            ) {
                                                DropdownMenuItem(
                                                    text = { Text("Rename", color = TextPrimary, fontSize = 13.sp) },
                                                    leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null, tint = SoftLavender, modifier = Modifier.size(16.dp)) },
                                                    onClick = {
                                                        menuOpen = false
                                                        renameTarget = conv
                                                        renameText = conv.title
                                                    }
                                                )
                                                DropdownMenuItem(
                                                    text = { Text("Select for Export", color = TextPrimary, fontSize = 13.sp) },
                                                    leadingIcon = { Icon(Icons.Default.CheckCircle, contentDescription = null, tint = ElectricViolet, modifier = Modifier.size(16.dp)) },
                                                    onClick = {
                                                        menuOpen = false
                                                        viewModel.toggleSelection(conv.id)
                                                    }
                                                )
                                                DropdownMenuItem(
                                                    text = { Text("Delete", color = StatusError, fontSize = 13.sp) },
                                                    leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = StatusError, modifier = Modifier.size(16.dp)) },
                                                    onClick = {
                                                        menuOpen = false
                                                        viewModel.deleteConversation(conv.id)
                                                    }
                                                )
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

    // Rename Dialog
    if (renameTarget != null) {
        val target = renameTarget!!
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            containerColor = ElevatedSurface,
            title = { Text("Rename Conversation", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = ElectricViolet,
                        unfocusedBorderColor = GlassBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.renameConversation(target.id, renameText)
                        renameTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet)
                ) {
                    Text("Save", color = TextPrimary)
                }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) {
                    Text("Cancel", color = TextMuted)
                }
            }
        )
    }
}
