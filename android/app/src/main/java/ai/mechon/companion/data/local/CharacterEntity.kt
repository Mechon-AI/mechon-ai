package ai.mechon.companion.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "characters")
data class CharacterEntity(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val avatar: String = "🎭",
    val description: String = "",
    val sectionsJson: String = "[]",
    val composedPrompt: String = "",
    val defaultModelId: String = "gemini-2.5-flash",
    val defaultProviderId: String = "gemini",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
