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
import ai.mechon.companion.ui.theme.*

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
    val safeModels = remember(models) { models.filterNotNull() }
    var selectedProviderFilter by remember { mutableStateOf<String?>(null) }

    // Distinct list of provider names for filter chips
    val providerNames = remember(safeModels) {
        safeModels.map { it.providerName }.distinct().sorted()
    }

    // Filter models based on search query and provider chip filter
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

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = MechonBlueLight,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Remote Model Catalog",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }
                IconButton(
                    onClick = onRefresh,
                    enabled = !isLoading,
                    modifier = Modifier.size(28.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp),
                            color = MechonBlueLight
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp)
            ) {
                // Search Input
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchQueryChange,
                    placeholder = {
                        Text("Search models or providers...", color = TextMuted, fontSize = 13.sp)
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { onSearchQueryChange("") }) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Clear search",
                                    tint = TextMuted,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = MechonSurfaceVariant,
                        unfocusedContainerColor = MechonSurfaceVariant,
                        focusedBorderColor = MechonBlueLight,
                        unfocusedBorderColor = MechonBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                )

                // Provider Filter Chips
                if (providerNames.size > 1) {
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        item {
                            FilterChip(
                                selected = selectedProviderFilter == null,
                                onClick = { selectedProviderFilter = null },
                                label = { Text("All (${safeModels.size})", fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MechonBlueLight.copy(alpha = 0.2f),
                                    selectedLabelColor = MechonBlueLight
                                )
                            )
                        }
                        items(providerNames) { prov ->
                            val count = safeModels.count { it.providerName == prov }
                            FilterChip(
                                selected = selectedProviderFilter == prov,
                                onClick = {
                                    selectedProviderFilter = if (selectedProviderFilter == prov) null else prov
                                },
                                label = { Text("$prov ($count)", fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MechonBlueLight.copy(alpha = 0.2f),
                                    selectedLabelColor = MechonBlueLight
                                )
                            )
                        }
                    }
                }

                // Error Banner if present
                if (errorMessage != null && safeModels.isEmpty()) {
                    Surface(
                        color = MechonRed.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = errorMessage,
                                color = MechonRed,
                                style = MaterialTheme.typography.bodySmall
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Button(
                                onClick = onRefresh,
                                colors = ButtonDefaults.buttonColors(containerColor = MechonRed),
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Retry Connection", fontSize = 12.sp)
                            }
                        }
                    }
                } else if (isLoading && safeModels.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = MechonBlueLight)
                    }
                } else if (filteredModels.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (searchQuery.isNotEmpty()) {
                                "No models matching \"$searchQuery\""
                            } else {
                                "No active providers registered on Desktop.\nConfigure API keys in Mechon Desktop Settings."
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextMuted,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false)
                    ) {
                        items(filteredModels, key = { "${it.providerId}_${it.modelId}" }) { item ->
                            val isSelected = item.modelId == selectedModelId &&
                                (selectedProviderId.isEmpty() || item.providerId == selectedProviderId)

                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSelected) MechonSurfaceVariant else MechonSurface,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 3.dp)
                                    .clickable { onModelSelect(item) }
                                    .then(
                                        if (isSelected) Modifier.border(1.dp, MechonBlueLight, RoundedCornerShape(8.dp))
                                        else Modifier
                                    )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            // Availability status dot
                                            Box(
                                                modifier = Modifier
                                                    .size(7.dp)
                                                    .clip(CircleShape)
                                                    .background(if (item.isAvailable) MechonGreen else MechonYellow)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = item.modelName.ifBlank { item.modelId },
                                                style = MaterialTheme.typography.bodyMedium,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                                color = if (isSelected) MechonBlueLight else TextPrimary,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.padding(top = 4.dp)
                                        ) {
                                            Text(
                                                text = "${item.providerName} (${item.providerId})",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = TextMuted,
                                                fontSize = 11.sp
                                            )

                                            // Vision Badge
                                            if (item.supportsVision) {
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Surface(
                                                    shape = RoundedCornerShape(4.dp),
                                                    color = MechonCyan.copy(alpha = 0.15f)
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Default.Visibility,
                                                            contentDescription = null,
                                                            tint = MechonCyan,
                                                            modifier = Modifier.size(10.dp)
                                                        )
                                                        Spacer(modifier = Modifier.width(2.dp))
                                                        Text(
                                                            text = "Vision",
                                                            fontSize = 9.sp,
                                                            color = MechonCyan,
                                                            fontWeight = FontWeight.Bold
                                                        )
                                                    }
                                                }
                                            }

                                            // Context Window Badge
                                            if (item.contextLength > 0) {
                                                Spacer(modifier = Modifier.width(6.dp))
                                                val ctxLabel = if (item.contextLength >= 1000000) {
                                                    "${item.contextLength / 1000000}M ctx"
                                                } else {
                                                    "${item.contextLength / 1000}k ctx"
                                                }
                                                Surface(
                                                    shape = RoundedCornerShape(4.dp),
                                                    color = MechonPurple.copy(alpha = 0.15f)
                                                ) {
                                                    Text(
                                                        text = ctxLabel,
                                                        fontSize = 9.sp,
                                                        color = MechonPurple,
                                                        fontWeight = FontWeight.SemiBold,
                                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }

                                    if (isSelected) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = "Selected",
                                            tint = MechonBlueLight,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = MechonBlueLight)
            }
        },
        containerColor = MechonSurface,
        shape = RoundedCornerShape(12.dp)
    )
}
