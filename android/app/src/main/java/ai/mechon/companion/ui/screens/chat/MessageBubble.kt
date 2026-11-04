package ai.mechon.companion.ui.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Attachment
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.local.MessageEntity
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.data.remote.SearchResultItem
import ai.mechon.companion.ui.theme.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MessageBubble(
    message: MessageEntity,
    onActionClick: (MessageEntity) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val isUser = message.role == "user"
    val timeStr = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(message.timestamp))

    // Parse attachments if any
    val attachments: List<AttachmentPayload> = try {
        if (message.attachmentsJson.isNotBlank() && message.attachmentsJson != "[]") {
            val listType = object : TypeToken<List<AttachmentPayload>>() {}.type
            Gson().fromJson(message.attachmentsJson, listType) ?: emptyList()
        } else emptyList()
    } catch (e: Exception) {
        emptyList()
    }

    // Parse search results if any
    val searchResults: List<SearchResultItem> = try {
        if (!message.searchMetadataJson.isNullOrBlank()) {
            val listType = object : TypeToken<List<SearchResultItem>>() {}.type
            Gson().fromJson(message.searchMetadataJson, listType) ?: emptyList()
        } else emptyList()
    } catch (e: Exception) {
        emptyList()
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 320.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (isUser) 16.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else 16.dp
                    )
                )
                .background(if (isUser) UserBubbleBg else AssistantBubbleBg)
                .padding(12.dp)
        ) {
            // Role & Time Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isUser) "You" else "Mechon AI",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isUser) MechonBlueLight else MechonCyan
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = timeStr,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted,
                        fontSize = 10.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = { onActionClick(message) },
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Options",
                            tint = TextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Attachment Pills if any
            if (attachments.isNotEmpty()) {
                Column(modifier = Modifier.padding(bottom = 6.dp)) {
                    attachments.forEach { att ->
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = MechonSurfaceVariant,
                            modifier = Modifier.padding(vertical = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Attachment,
                                    contentDescription = null,
                                    tint = MechonBlueLight,
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${att.name} (${att.mimeType})",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextSecondary,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            // Web Search Grounding Citation Header
            if (searchResults.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = MechonBlueDark.copy(alpha = 0.5f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                ) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = MechonCyan,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Web Search Grounding (${searchResults.size} sources)",
                                style = MaterialTheme.typography.labelSmall,
                                color = MechonCyan,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        searchResults.take(2).forEach { s ->
                            Text(
                                text = "• ${s.title}",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                fontSize = 11.sp,
                                maxLines = 1
                            )
                        }
                    }
                }
            }

            // Render Body with Parsed Code Blocks
            RenderMessageContent(message.content)
        }
    }
}

@Composable
private fun RenderMessageContent(content: String) {
    val segments = parseMarkdownCodeBlocks(content)

    for (segment in segments) {
        when (segment) {
            is ContentSegment.Text -> {
                if (segment.text.isNotBlank()) {
                    Text(
                        text = segment.text.trim(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary,
                        lineHeight = 20.sp
                    )
                }
            }
            is ContentSegment.Code -> {
                CodeBlockView(language = segment.lang, code = segment.code)
            }
        }
    }
}

sealed class ContentSegment {
    data class Text(val text: String) : ContentSegment()
    data class Code(val lang: String, val code: String) : ContentSegment()
}

private fun parseMarkdownCodeBlocks(raw: String): List<ContentSegment> {
    val segments = mutableListOf<ContentSegment>()
    val regex = Regex("```([a-zA-Z0-9_-]*)\n([\\s\\S]*?)```")

    var lastIndex = 0
    val matches = regex.findAll(raw)

    for (match in matches) {
        if (match.range.first > lastIndex) {
            val textPart = raw.substring(lastIndex, match.range.first)
            if (textPart.isNotBlank()) {
                segments.add(ContentSegment.Text(textPart))
            }
        }
        val lang = match.groupValues[1]
        val code = match.groupValues[2]
        segments.add(ContentSegment.Code(lang, code))
        lastIndex = match.range.last + 1
    }

    if (lastIndex < raw.length) {
        val remaining = raw.substring(lastIndex)
        if (remaining.isNotBlank()) {
            segments.add(ContentSegment.Text(remaining))
        }
    }

    if (segments.isEmpty() && raw.isNotBlank()) {
        segments.add(ContentSegment.Text(raw))
    }

    return segments
}
