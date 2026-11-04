package ai.mechon.companion.ui.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.remote.ProviderModelItem
import ai.mechon.companion.ui.components.MechonLogoMark
import ai.mechon.companion.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSelectorDialog(
    models: List<ProviderModelItem>,
    selectedModelId: String,
    selectedProviderId: String = "",
    isLoading: Boolean = false,
    errorMessage: String? = null,
    searchQuery: String = "",
    onSearchQueryChange: (String) -> Unit = {},
    onRefresh: () -> Unit = {},
    onModelSelect: (ProviderModelItem) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val safeModels = remember(models) { models.filterNotNull() }
    var selectedProviderFilter by remember { mutableStateOf<String?>(null) }

    // Distinct sorted list of provider names for filter chips
    val providerNames = remember(safeModels) {
        safeModels.map { it.providerName }.distinct().sorted()
    }

    // Filter models based on search query and selected provider chip
    val filteredModels = remember(safeModels, searchQuery, selectedProviderFilter) {
        safeModels.filter { item ->
            val matchesProvider = selectedProviderFilter == null || item.providerName == selectedProviderFilter
            val query = searchQuery.trim().lowercase()
            val matchesSearch = query.isEmpty() ||
                item.modelId.lowercase().contains(query) ||
                item.modelName.lowercase().contains(query) ||
                item.providerName.lowercase().contains(query) ||
                item.providerId.lowercase().contains(query)
            matchesProvider && matchesSearch
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = ElevatedSurface,
        dragHandle = {
            BottomSheetDefaults.DragHandle(
                color = GlassBorder
            )
        },
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f)
                .padding(horizontal = 20.dp)
                .navigationBarsPadding()
        ) {
            // Header: Title & Desktop Status
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MechonLogoMark(size = 24.dp)
                    Column {
                        Text(
                            text = "Model Catalog",
                            color = TextPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Discovered via Mechon Desktop API",
                            color = SoftLavender,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    IconButton(
                        onClick = onRefresh,
                        enabled = !isLoading,
                        modifier = Modifier.size(32.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(16.dp),
                                color = ElectricViolet
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = SoftLavender,
                                modifier = Modifier.size(18.dp)
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
            }

            // Search Bar
            TextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = {
                    Text(
                        text = "Search models (e.g. gemini, llama, claude)...",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = SoftLavender,
                        modifier = Modifier.size(18.dp)
                    )
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(
                            onClick = { onSearchQueryChange("") },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Clear",
                                tint = TextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = ObsidianBlack,
                    unfocusedContainerColor = ObsidianBlack,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    cursorColor = ElectricViolet,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .border(1.dp, GlassBorder, RoundedCornerShape(16.dp))
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Provider Category Filter Chips
            if (providerNames.size > 1) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = selectedProviderFilter == null,
                            onClick = { selectedProviderFilter = null },
                            label = { Text("All (${safeModels.size})", fontSize = 11.5.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ElectricViolet.copy(alpha = 0.25f),
                                selectedLabelColor = TextPrimary,
                                containerColor = ElevatedSurfaceHighlight,
                                labelColor = TextSecondary
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selectedProviderFilter == null,
                                borderColor = GlassBorder,
                                selectedBorderColor = ElectricViolet
                            ),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }

                    items(providerNames) { providerName ->
                        val count = safeModels.count { it.providerName == providerName }
                        FilterChip(
                            selected = selectedProviderFilter == providerName,
                            onClick = {
                                selectedProviderFilter = if (selectedProviderFilter == providerName) null else providerName
                            },
                            label = { Text("$providerName ($count)", fontSize = 11.5.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ElectricViolet.copy(alpha = 0.25f),
                                selectedLabelColor = TextPrimary,
                                containerColor = ElevatedSurfaceHighlight,
                                labelColor = TextSecondary
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                enabled = true,
                                selected = selectedProviderFilter == providerName,
                                borderColor = GlassBorder,
                                selectedBorderColor = ElectricViolet
                            ),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            // Error Message Banner with Retry
            if (errorMessage != null) {
                Surface(
                    color = StatusError.copy(alpha = 0.15f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.dp, StatusError.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = errorMessage,
                            color = StatusError,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = onRefresh) {
                            Text("Retry", color = StatusError, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Model List or Empty State
            if (filteredModels.isEmpty() && !isLoading) {
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
                            imageVector = Icons.Default.SearchOff,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(40.dp)
                        )
                        Text(
                            text = if (safeModels.isEmpty()) "No remote models discovered" else "No models match your search",
                            color = TextSecondary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = if (safeModels.isEmpty()) "Ensure Mechon AI Desktop is running and providers are configured in Settings." else "Try a different search term or reset filter.",
                            color = TextMuted,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 32.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 4.dp)
                ) {
                    items(filteredModels, key = { "${it.providerId}:${it.modelId}" }) { item ->
                        val isSelected = item.modelId == selectedModelId

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (isSelected) ElectricViolet.copy(alpha = 0.16f) else ElevatedSurfaceHighlight)
                                .border(
                                    width = 1.dp,
                                    color = if (isSelected) ElectricViolet else GlassBorder,
                                    shape = RoundedCornerShape(16.dp)
                                )
                                .clickable { onModelSelect(item) }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    // Availability status dot
                                    Box(
                                        modifier = Modifier
                                            .size(7.dp)
                                            .clip(CircleShape)
                                            .background(if (item.isAvailable) StatusConnected else StatusWarning)
                                    )

                                    Text(
                                        text = item.modelName.ifBlank { item.modelId },
                                        color = TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = item.providerName,
                                        color = SoftLavender,
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.Medium
                                    )

                                    Text(
                                        text = "•",
                                        color = TextMuted,
                                        fontSize = 10.sp
                                    )

                                    Text(
                                        text = item.modelId,
                                        color = TextMuted,
                                        fontSize = 11.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Spacer(modifier = Modifier.height(6.dp))

                                // Capability badges
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (item.supportsVision) {
                                        CapabilityPill("Vision", ElectricViolet)
                                    }
                                    if (item.contextLength > 0) {
                                        val contextLabel = when {
                                            item.contextLength >= 1_000_000 -> "${item.contextLength / 1_000_000}M ctx"
                                            item.contextLength >= 1_000 -> "${item.contextLength / 1_000}K ctx"
                                            else -> "${item.contextLength} ctx"
                                        }
                                        CapabilityPill(contextLabel, SoftLavender)
                                    }
                                }
                            }

                            if (isSelected) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(ElectricViolet),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = "Selected",
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
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

@Composable
private fun CapabilityPill(text: String, accentColor: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(accentColor.copy(alpha = 0.12f))
            .border(1.dp, accentColor.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = text,
            color = accentColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium
        )
    }
}
