package ai.mechon.companion.ui.screens.roleplay

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.repository.RoleplaySection
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
    var newCharName by remember { mutableStateOf("") }
    var newCharAvatar by remember { mutableStateOf("🎭") }
    var newCharDesc by remember { mutableStateOf("") }
    var customSectionTitle by remember { mutableStateOf("") }
    var customSectionContent by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Roleplay Studio",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = if (uiState.activeCharacter != null) "${uiState.activeCharacter?.avatar} ${uiState.activeCharacter?.name}" else if (uiState.activePreset != null) "Preset: ${uiState.activePreset?.name}" else "10 Modular Sections",
                            style = MaterialTheme.typography.labelSmall,
                            color = MechonPurple,
                            fontSize = 11.sp
                        )
                    }
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
                actions = {
                    // Character Library
                    IconButton(onClick = { viewModel.setCharacterLibraryOpen(true) }) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Character Library",
                            tint = MechonCyan
                        )
                    }
                    // Presets List
                    IconButton(onClick = { viewModel.setPresetListOpen(true) }) {
                        Icon(
                            imageVector = Icons.Default.Bookmarks,
                            contentDescription = "Presets",
                            tint = MechonPurple
                        )
                    }
                    // Save Preset
                    IconButton(onClick = { viewModel.setSaveDialogOpen(true) }) {
                        Icon(
                            imageVector = Icons.Default.Save,
                            contentDescription = "Save Preset",
                            tint = MechonBlueLight
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
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                // Live Preview Summary Card
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MechonSurfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.setPreviewExpanded(!uiState.isPreviewExpanded) }
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Visibility,
                                        contentDescription = null,
                                        tint = MechonCyan,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Live Assembled System Prompt",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                }
                                Icon(
                                    imageVector = if (uiState.isPreviewExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = null,
                                    tint = TextMuted
                                )
                            }

                            AnimatedVisibility(visible = uiState.isPreviewExpanded) {
                                Column(modifier = Modifier.padding(top = 10.dp)) {
                                    Surface(
                                        color = CodeBlockBg,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = uiState.composedPromptPreview,
                                            style = MaterialTheme.typography.bodySmall,
                                            fontFamily = FontFamily.Monospace,
                                            color = TextSecondary,
                                            fontSize = 11.sp,
                                            modifier = Modifier.padding(10.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 10 Modular Sections + Custom Sections
                val sections = uiState.config.toList()
                items(sections, key = { it.id }) { section ->
                    SectionCard(
                        section = section,
                        onContentChanged = { content -> viewModel.updateSectionContent(section.id, content) },
                        onToggle = { viewModel.toggleSectionEnabled(section.id) },
                        onDeleteCustom = if (section.isCustom) { { viewModel.deleteCustomSection(section.id) } } else null
                    )
                }

                // Add Custom Section Button
                item {
                    OutlinedButton(
                        onClick = { viewModel.setAddCustomSectionOpen(true) },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MechonPurple),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth().height(42.dp)
                    ) {
                        Icon(Icons.Default.AddCircleOutline, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Add Custom Section", fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Bottom Action Bar: "Start Roleplay Session"
            Surface(
                color = MechonSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Button(
                        onClick = {
                            viewModel.createChatWithCurrentRoleplay { convId ->
                                onNavigateToChat(convId)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MechonPurple),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = TextPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Start Roleplay Session",
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }
                }
            }
        }
    }

    // Add Custom Section Dialog
    if (uiState.isAddCustomSectionOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setAddCustomSectionOpen(false) },
            title = { Text("Add Custom Roleplay Section", color = TextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = customSectionTitle,
                        onValueChange = { customSectionTitle = it },
                        label = { Text("Section Title") },
                        placeholder = { Text("e.g. Magic System Constraints") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = MechonPurple,
                            unfocusedBorderColor = MechonBorder
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = customSectionContent,
                        onValueChange = { customSectionContent = it },
                        label = { Text("Initial Directives") },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = MechonPurple,
                            unfocusedBorderColor = MechonBorder
                        ),
                        modifier = Modifier.fillMaxWidth().height(100.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.addCustomSection(customSectionTitle, customSectionContent)
                        customSectionTitle = ""
                        customSectionContent = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MechonPurple)
                ) {
                    Text("Add Section")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setAddCustomSectionOpen(false) }) {
                    Text("Cancel", color = TextMuted)
                }
            },
            containerColor = MechonSurface
        )
    }

    // Character Library Dialog
    if (uiState.isCharacterLibraryOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setCharacterLibraryOpen(false) },
            title = {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Character Library", color = TextPrimary, fontWeight = FontWeight.Bold)
                    TextButton(onClick = {
                        newCharName = ""
                        newCharAvatar = "🎭"
                        newCharDesc = ""
                        viewModel.saveAsCharacter("Elena Vance", "🧭", "Arcane Cartographer")
                    }) {
                        Text("+ Quick Save", color = MechonCyan, fontSize = 12.sp)
                    }
                }
            },
            text = {
                if (uiState.characters.isEmpty()) {
                    Text("No saved characters. Configure the 10 sections and save a character.", color = TextMuted)
                } else {
                    LazyColumn(modifier = Modifier.heightIn(max = 340.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(uiState.characters) { char ->
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (uiState.activeCharacter?.id == char.id) MechonPurple.copy(alpha = 0.2f) else MechonSurfaceVariant,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { viewModel.loadCharacter(char) }
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(char.avatar, fontSize = 22.sp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(char.name, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            if (char.description.isNotBlank()) {
                                                Text(char.description, color = TextMuted, fontSize = 11.sp)
                                            }
                                        }
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        IconButton(onClick = { viewModel.duplicateCharacter(char.id) }, modifier = Modifier.size(22.dp)) {
                                            Icon(Icons.Default.ContentCopy, contentDescription = "Duplicate", tint = TextMuted, modifier = Modifier.size(14.dp))
                                        }
                                        IconButton(onClick = { viewModel.deleteCharacter(char.id) }, modifier = Modifier.size(22.dp)) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MechonRed, modifier = Modifier.size(14.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.setCharacterLibraryOpen(false) }) {
                    Text("Done", color = MechonPurple)
                }
            },
            containerColor = MechonSurface
        )
    }

    // Save Preset Dialog
    if (uiState.isSaveDialogOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setSaveDialogOpen(false) },
            title = { Text("Save Prompt Preset", color = TextPrimary) },
            text = {
                OutlinedTextField(
                    value = newPresetName,
                    onValueChange = { newPresetName = it },
                    label = { Text("Preset Name") },
                    placeholder = { Text("e.g. Arcane Cartographer Elena") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = MechonPurple,
                        unfocusedBorderColor = MechonBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.savePreset(newPresetName)
                        newPresetName = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MechonPurple)
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.setSaveDialogOpen(false) }) {
                    Text("Cancel", color = TextMuted)
                }
            },
            containerColor = MechonSurface
        )
    }

    // Presets List Dialog
    if (uiState.isPresetListOpen) {
        AlertDialog(
            onDismissRequest = { viewModel.setPresetListOpen(false) },
            title = { Text("Saved Roleplay Presets", color = TextPrimary) },
            text = {
                if (uiState.presets.isEmpty()) {
                    Text("No saved presets found. Customize sections and tap Save.", color = TextMuted)
                } else {
                    LazyColumn(modifier = Modifier.heightIn(max = 300.dp)) {
                        items(uiState.presets) { preset ->
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (preset.isActive) MechonPurple.copy(alpha = 0.2f) else MechonSurfaceVariant,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clickable { viewModel.loadPreset(preset) }
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = preset.name,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = if (preset.isActive) MechonPurple else TextPrimary,
                                        fontWeight = if (preset.isActive) FontWeight.Bold else FontWeight.Normal
                                    )
                                    IconButton(
                                        onClick = { viewModel.deletePreset(preset.id) },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Delete",
                                            tint = TextMuted,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.setPresetListOpen(false) }) {
                    Text("Close", color = MechonPurple)
                }
            },
            containerColor = MechonSurface
        )
    }
}

@Composable
fun SectionCard(
    section: RoleplaySection,
    onContentChanged: (String) -> Unit,
    onToggle: () -> Unit,
    onDeleteCustom: (() -> Unit)? = null
) {
    var expanded by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MechonSurface,
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = androidx.compose.ui.graphics.SolidColor(if (section.isEnabled) MechonBorder else MechonDarkBg)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { expanded = !expanded }
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = section.title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = if (section.isEnabled) TextPrimary else TextMuted
                        )
                        if (section.isCustom) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(color = MechonPurple.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                Text("Custom", color = MechonPurple, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                            }
                        }
                    }
                    Text(
                        text = section.description,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (onDeleteCustom != null) {
                        IconButton(onClick = onDeleteCustom, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete Section", tint = MechonRed, modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Switch(
                        checked = section.isEnabled,
                        onCheckedChange = { onToggle() },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = TextPrimary,
                            checkedTrackColor = MechonPurple,
                            uncheckedThumbColor = TextMuted,
                            uncheckedTrackColor = MechonSurfaceVariant
                        )
                    )
                }
            }

            AnimatedVisibility(visible = expanded || section.isEnabled) {
                OutlinedTextField(
                    value = section.content,
                    onValueChange = onContentChanged,
                    enabled = section.isEnabled,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        disabledTextColor = TextMuted,
                        focusedBorderColor = MechonPurple,
                        unfocusedBorderColor = MechonBorder,
                        disabledBorderColor = MechonSurfaceVariant
                    ),
                    shape = RoundedCornerShape(8.dp)
                )
            }
        }
    }
}
