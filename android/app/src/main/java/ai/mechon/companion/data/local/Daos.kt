package ai.mechon.companion.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ConversationDao {
    @Query("SELECT * FROM conversations WHERE isArchived = 0 ORDER BY updatedAt DESC")
    fun getAllConversationsFlow(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations ORDER BY updatedAt DESC")
    suspend fun getAllConversations(): List<ConversationEntity>

    @Query("SELECT * FROM conversations WHERE id = :id")
    suspend fun getConversationById(id: String): ConversationEntity?

    @Query("SELECT * FROM conversations WHERE id = :id")
    fun getConversationFlow(id: String): Flow<ConversationEntity?>

    @Query("SELECT * FROM conversations WHERE isArchived = 0 AND (title LIKE '%' || :query || '%' OR tags LIKE '%' || :query || '%') ORDER BY updatedAt DESC")
    fun searchConversationsFlow(query: String): Flow<List<ConversationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConversation(conversation: ConversationEntity)

    @Update
    suspend fun updateConversation(conversation: ConversationEntity)

    @Query("UPDATE conversations SET title = :newTitle, updatedAt = :timestamp WHERE id = :id")
    suspend fun renameConversation(id: String, newTitle: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE conversations SET isArchived = :archived, updatedAt = :timestamp WHERE id = :id")
    suspend fun setArchived(id: String, archived: Boolean, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE conversations SET isSynced = 1, syncTransferId = :transferId, updatedAt = :timestamp WHERE id IN (:ids)")
    suspend fun markAsSynced(ids: List<String>, transferId: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM conversations WHERE id = :id")
    suspend fun deleteConversation(id: String)

    @Query("DELETE FROM conversations WHERE id IN (:ids)")
    suspend fun deleteConversations(ids: List<String>)
}

@Dao
interface CharacterDao {
    @Query("SELECT * FROM characters ORDER BY updatedAt DESC")
    fun getAllCharactersFlow(): Flow<List<CharacterEntity>>

    @Query("SELECT * FROM characters WHERE id = :id")
    suspend fun getCharacterById(id: String): CharacterEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCharacter(character: CharacterEntity)

    @Update
    suspend fun updateCharacter(character: CharacterEntity)

    @Query("DELETE FROM characters WHERE id = :id")
    suspend fun deleteCharacter(id: String)
}

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY timestamp ASC")
    fun getMessagesFlow(conversationId: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY timestamp ASC")
    suspend fun getMessages(conversationId: String): List<MessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("UPDATE messages SET content = :content WHERE id = :messageId")
    suspend fun updateMessageContent(messageId: String, content: String)

    @Query("DELETE FROM messages WHERE id = :id")
    suspend fun deleteMessage(id: String)
}

@Dao
interface PromptPresetDao {
    @Query("SELECT * FROM prompt_presets ORDER BY updatedAt DESC")
    fun getAllPresetsFlow(): Flow<List<PromptPresetEntity>>

    @Query("SELECT * FROM prompt_presets WHERE isActive = 1 LIMIT 1")
    suspend fun getActivePreset(): PromptPresetEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPreset(preset: PromptPresetEntity)

    @Query("UPDATE prompt_presets SET isActive = 0")
    suspend fun clearActivePresets()

    @Query("UPDATE prompt_presets SET isActive = 1 WHERE id = :id")
    suspend fun setActivePreset(id: String)

    @Query("DELETE FROM prompt_presets WHERE id = :id")
    suspend fun deletePreset(id: String)
}
