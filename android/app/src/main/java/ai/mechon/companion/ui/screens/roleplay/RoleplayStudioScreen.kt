package ai.mechon.companion.ui.screens.roleplay

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.repository.RoleplaySection
import ai.mechon.companion.ui.components.MechonLogoMark
import ai.mechon.companion.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoleplayStudioScreen(
    viewModel: RoleplayViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToChat: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    var newPresetName by remember { mutableStateOf("") }
    var customSectionTitle by remember { mutableStateOf("") }
    var customSectionContent by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MechonLogoMark(size = 24.dp)
                        Column {
                            Text(
                                text = "Roleplay Context",
                                color = TextPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (uiState.activeCharacter != null) {
                                    "${uiState.activeCharacter?.avatar} ${uiState.activeCharacter?.name}"
                                } else if (uiState.activePreset != null) {
                                    "Preset: ${uiState.activePreset?.name}"
                                } else {
                                    "10 Modular Directive Sections"
                                },
                                color = SoftLavender,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
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
                    // Character Library
                    IconButton(onClick = { viewModel.setCharacterLibraryOpen(true) }) {
                        Icon(
                            imageVector = Icons.Default.Face,
                            contentDescription = "Character Library",
                            tint = SoftLavender
                        )
                    }
                    // Presets List
                    IconButton(onClick = { viewModel.setPresetListOpen(true) }) {
                        Icon(
                            imageVector = Icons.Default.Bookmarks,
                            contentDescription = "Presets",
                            tint = ElectricViolet
                        )
                    }
                    // Save Preset
                    IconButton(onClick = { viewModel.setSaveDialogOpen(true) }) {
                        Icon(
                            imageVector = Icons.Default.Save,
                            contentDescription = "Save Preset",
                            tint = TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ObsidianBlack
                )
            )
        },
        containerColor = ObsidianBlack
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(ObsidianBlack)
                .padding(paddingValues)
        ) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                // Live Assembled System Prompt Preview Accordion
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(ElevatedSurface)
                            .border(1.dp, GlassBorder, RoundedCornerShape(18.dp))
                            .clickable { viewModel.setPreviewExpanded(!uiState.isPreviewExpanded) }
                            .padding(16.dp)
                    ) {
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
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .background(ElectricViolet.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Terminal,
                                        contentDescription = null,
                                        tint = ElectricViolet,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                Column {
                                    Text(
                                        text = "Assembled System Prompt",
                                        color = TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        text = "Preview generated directives before inference",
                                        color = TextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            Icon(
                                imageVector = if (uiState.isPreviewExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                tint = SoftLavender
                            )
                        }

                        AnimatedVisibility(
                            visible = uiState.isPreviewExpanded,
                            enter = fadeIn() + expandVertically(),
                            exit = fadeOut() + shrinkVertically()
                        ) {
                            Column(modifier = Modifier.padding(top = 12.dp)) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(CodeBlockBg)
                                        .border(1.dp, CodeBlockBorder, RoundedCornerShape(12.dp))
                                        .padding(12.dp)
                                ) {
                                    Text(
                                        text = uiState.composedPromptPreview,
                                        fontFamily = FontFamily.Monospace,
                                        color = TextSecondary,
                                        fontSize = 11.5.sp,
                                        lineHeight = 17.sp
                                    )
                                }
                            }
                        }
                    }
                }

                // 10 Modular Sections
                val sections = uiState.config.toList()
                items(sections, key = { it.id }) { section ->
                    ObsidianSectionCard(
                        section = section,
                        onContentChanged = { content -> viewModel.updateSectionContent(section.id, content) },
                        onToggle = { viewModel.toggleSectionEnabled(section.id) },
                        onDeleteCustom = if (section.isCustom) { { viewModel.deleteCustomSection(section.id) } } else null
                    )
                }

                // Add Custom Section Action
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(ElevatedSurfaceHighlight)
                            .border(1.dp, GlassBorder, RoundedCornerShape(16.dp))
                            .clickable { viewModel.setAddCustomSectionOpen(true) }
                            .padding(vertical = 14.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            tint = SoftLavender,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Add Custom Section",
                            color = SoftLavender,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // Bottom Floating Bar: Start Session
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .navigationBarsPadding()
            ) {
                Button(
                    onClick = {
                        viewModel.createChatWithCurrentRoleplay { convId ->
                            onNavigateToChat(convId)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .clip(RoundedCornerShape(25.dp))
                        .background(VioletGlowBrush),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent)
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Start Roleplay Session",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }

    // Save Preset Dialog
    if (uiState.isSaveDialogOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setSaveDialogOpen(false) },
            containerColor = ElevatedSurface,
            title = {
                Text("Save Roleplay Preset", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                OutlinedTextField(
                    value = newPresetName,
                    onValueChange = { newPresetName = it },
                    placeholder = { Text("Preset Name (e.g. Cyberpunk Detective)", color = TextMuted) },
                    singleLine = true,
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
                        if (newPresetName.isNotBlank()) {
                            viewModel.savePreset(newPresetName.trim())
                            newPresetName = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet)
                ) {
                    Text("Save Preset", color = TextPrimary)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setSaveDialogOpen(false) }) {
                    Text("Cancel", color = TextMuted)
                }
            }
        )
    }

    // Character Library Dialog
    if (uiState.isCharacterLibraryOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setCharacterLibraryOpen(false) },
            containerColor = ElevatedSurface,
            title = {
                Text("Character Library", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                if (uiState.characters.isEmpty()) {
                    Text("No saved characters. Configure your directives and save a character.", color = TextMuted)
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 320.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.characters) { char ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (uiState.activeCharacter?.id == char.id) ElectricViolet.copy(alpha = 0.2f) else ElevatedSurfaceHighlight)
                                    .border(1.dp, GlassBorder, RoundedCornerShape(12.dp))
                                    .clickable { viewModel.loadCharacter(char) }
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(char.avatar, fontSize = 20.sp)
                                    Column {
                                        Text(char.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        Text(char.description, color = TextMuted, fontSize = 11.sp, maxLines = 1)
                                    }
                                }
                                IconButton(
                                    onClick = { viewModel.deleteCharacter(char.id) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusError, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.setCharacterLibraryOpen(false) }) {
                    Text("Done", color = SoftLavender)
                }
            }
        )
    }

    // Preset List Dialog
    if (uiState.isPresetListOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setPresetListOpen(false) },
            containerColor = ElevatedSurface,
            title = {
                Text("Saved Presets", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                if (uiState.presets.isEmpty()) {
                    Text("No presets saved yet.", color = TextMuted)
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 320.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.presets) { preset ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (uiState.activePreset?.id == preset.id) ElectricViolet.copy(alpha = 0.2f) else ElevatedSurfaceHighlight)
                                    .border(1.dp, GlassBorder, RoundedCornerShape(12.dp))
                                    .clickable { viewModel.loadPreset(preset) }
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(preset.name, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                IconButton(
                                    onClick = { viewModel.deletePreset(preset.id) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusError, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.setPresetListOpen(false) }) {
                    Text("Done", color = SoftLavender)
                }
            }
        )
    }

    // Add Custom Section Dialog
    if (uiState.isAddCustomSectionOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setAddCustomSectionOpen(false) },
            containerColor = ElevatedSurface,
            title = { Text("Add Custom Roleplay Section", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = customSectionTitle,
                        onValueChange = { customSectionTitle = it },
                        placeholder = { Text("Section Title (e.g. Magic System Rules)", color = TextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = ElectricViolet,
                            unfocusedBorderColor = GlassBorder
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = customSectionContent,
                        onValueChange = { customSectionContent = it },
                        placeholder = { Text("Initial Directives...", color = TextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = ElectricViolet,
                            unfocusedBorderColor = GlassBorder
                        ),
                        modifier = Modifier.fillMaxWidth().height(100.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (customSectionTitle.isNotBlank()) {
                            viewModel.addCustomSection(customSectionTitle.trim(), customSectionContent.trim())
                            customSectionTitle = ""
                            customSectionContent = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricViolet)
                ) {
                    Text("Add", color = TextPrimary)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddCustomSectionOpen(false) }) {
                    Text("Cancel", color = TextMuted)
                }
            }
        )
    }
}

@Composable
private fun ObsidianSectionCard(
    section: RoleplaySection,
    onContentChanged: (String) -> Unit,
    onToggle: () -> Unit,
    onDeleteCustom: (() -> Unit)? = null
) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(ElevatedSurface)
            .border(1.dp, if (section.isEnabled) GlassBorder else SubtleBorder, RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { isExpanded = !isExpanded }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = section.title,
                        color = if (section.isEnabled) TextPrimary else TextMuted,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (section.isCustom) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(ElectricViolet.copy(alpha = 0.2f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text("Custom", color = SoftLavender, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Text(
                    text = section.description,
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (onDeleteCustom != null) {
                    IconButton(
                        onClick = onDeleteCustom,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusError, modifier = Modifier.size(16.dp))
                    }
                }

                Switch(
                    checked = section.isEnabled,
                    onCheckedChange = { onToggle() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = TextPrimary,
                        checkedTrackColor = ElectricViolet,
                        uncheckedThumbColor = TextMuted,
                        uncheckedTrackColor = ElevatedSurfaceHighlight
                    )
                )
            }
        }

        AnimatedVisibility(
            visible = isExpanded || section.isEnabled,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Column(modifier = Modifier.padding(top = 10.dp)) {
                OutlinedTextField(
                    value = section.content,
                    onValueChange = onContentChanged,
                    enabled = section.isEnabled,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        disabledTextColor = TextMuted,
                        focusedBorderColor = ElectricViolet,
                        unfocusedBorderColor = GlassBorder,
                        disabledBorderColor = Color.Transparent
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 60.dp, max = 180.dp)
                )
            }
        }
    }
}
