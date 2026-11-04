package ai.mechon.companion.ui.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.mechon.companion.data.local.MessageEntity
import ai.mechon.companion.data.remote.AttachmentPayload
import ai.mechon.companion.data.remote.SearchResultItem
import ai.mechon.companion.ui.components.MechonLogoMark
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
    val attachments: List<AttachmentPayload> = remember(message.attachmentsJson) {
        try {
            if (message.attachmentsJson.isNotBlank() && message.attachmentsJson != "[]") {
                val listType = object : TypeToken<List<AttachmentPayload>>() {}.type
                Gson().fromJson(message.attachmentsJson, listType) ?: emptyList()
            } else emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    // Parse search results if any
    val searchResults: List<SearchResultItem> = remember(message.searchMetadataJson) {
        try {
            if (!message.searchMetadataJson.isNullOrBlank()) {
                val listType = object : TypeToken<List<SearchResultItem>>() {}.type
                Gson().fromJson(message.searchMetadataJson, listType) ?: emptyList()
            } else emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    if (isUser) {
        // User Message: Elegant rounded bubble on right
        Row(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.End
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .clip(
                        RoundedCornerShape(
                            topStart = 20.dp,
                            topEnd = 20.dp,
                            bottomStart = 20.dp,
                            bottomEnd = 4.dp
                        )
                    )
                    .background(UserBubbleBg)
                    .border(
                        width = 1.dp,
                        color = UserBubbleBorder,
                        shape = RoundedCornerShape(
                            topStart = 20.dp,
                            topEnd = 20.dp,
                            bottomStart = 20.dp,
                            bottomEnd = 4.dp
                        )
                    )
                    .clickable { onActionClick(message) }
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Header (You • Time • Action)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "You",
                        color = SoftLavender,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.5.sp
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = timeStr,
                            color = TextMuted,
                            fontSize = 10.sp
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.MoreHoriz,
                            contentDescription = "Options",
                            tint = TextMuted,
                            modifier = Modifier
                                .size(16.dp)
                                .clickable { onActionClick(message) }
                        )
                    }
                }

                // Attachments if any
                if (attachments.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    attachments.forEach { att ->
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(ElevatedSurfaceHighlight)
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Attachment,
                                contentDescription = null,
                                tint = SoftLavender,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = att.name,
                                color = TextPrimary,
                                fontSize = 11.sp,
                                maxLines = 1
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // User Content
                Text(
                    text = message.content,
                    color = TextPrimary,
                    fontSize = 14.sp,
                    lineHeight = 21.sp
                )
            }
        }
    } else {
        // Assistant Message: Clean, readable conversational typography without boxy cards
        Column(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp)
        ) {
            // Assistant Brand Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MechonLogoMark(
                        size = 20.dp,
                        animated = false
                    )
                    Text(
                        text = "MECHON",
                        color = SoftLavender,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.2.sp
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = timeStr,
                        color = TextMuted,
                        fontSize = 10.sp
                    )
                    IconButton(
                        onClick = { onActionClick(message) },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreHoriz,
                            contentDescription = "Options",
                            tint = TextMuted,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Web Search Grounding Citation Header
            if (searchResults.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(ElevatedSurface)
                        .border(1.dp, GlassBorder, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = SoftLavender,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = "Grounded via ${searchResults.size} web sources",
                        color = SoftLavender,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Assistant Body (Readable typography with syntax-highlighted code blocks)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 28.dp)
            ) {
                RenderMessageContent(message.content)
            }
        }
    }
}

@Composable
private fun RenderMessageContent(content: String) {
    val segments = remember(content) { parseMarkdownCodeBlocks(content) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        for (segment in segments) {
            when (segment) {
                is ContentSegment.Text -> {
                    if (segment.text.isNotBlank()) {
                        Text(
                            text = segment.text.trim(),
                            color = TextPrimary,
                            fontSize = 14.5.sp,
                            lineHeight = 22.sp,
                            fontWeight = FontWeight.Normal
                        )
                    }
                }
                is ContentSegment.Code -> {
                    CodeBlockView(language = segment.lang, code = segment.code)
                }
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
