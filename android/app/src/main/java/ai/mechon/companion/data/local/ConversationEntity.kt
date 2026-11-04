package ai.mechon.companion.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val title: String = "New Conversation",
    val modelId: String = "gemini-2.5-flash",
    val providerId: String = "google",
    val systemPrompt: String = "",
    val characterId: String? = null,
    val characterName: String? = null,
    val characterAvatar: String? = null,
    val isArchived: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isSynced: Boolean = false,
    val syncTransferId: String? = null,
    val tags: String = "mobile,chat"
)
