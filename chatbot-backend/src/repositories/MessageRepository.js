const BaseRepository = require('../database/base/BaseRepository');
const { createMessage } = require('../models/Message');
const { DELIVERY_STATUS } = require('../config/constants');
const logger = require('../config/logger');

/**
 * Message Repository
 * Handles all database operations for messages
 */
class MessageRepository extends BaseRepository {
    constructor() {
        super('messages');
    }

    /**
     * Get primary key column name
     */
    getPrimaryKey() {
        return 'message_id';
    }

    /**
     * Create a new message
     */
    async createMessage(messageData) {
        const message = createMessage(messageData);
        const createdMessage = await this.create(message);

        // Also insert into messages_by_conversation for efficient querying
        await this.insertIntoConversationIndex(createdMessage);

        return createdMessage;
    }

    /**
     * Insert message into conversation index table
     */
    async insertIntoConversationIndex(message) {
        try {
            const query = `
        INSERT INTO messages_by_conversation 
        (conversation_id, timestamp, message_id, sender, message_text, message_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
            await this.db.execute(query, [
                message.conversation_id,
                message.timestamp,
                message.message_id,
                message.sender,
                message.message_text,
                message.message_type,
            ]);
        } catch (error) {
            logger.error('Error inserting into conversation index', {
                error: error.message,
                messageId: message.message_id,
            });
        }
    }

    /**
     * Get messages by conversation
     */
    async getMessagesByConversation(conversationId, limit = 100) {
        try {
            const query = `
        SELECT * FROM messages_by_conversation 
        WHERE conversation_id = ? 
        LIMIT ?
      `;
            const result = await this.db.execute(query, [conversationId, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            logger.error('Error getting messages by conversation', {
                error: error.message,
                conversationId,
            });
            throw error;
        }
    }

    /**
     * Get messages by flow
     */
    async getMessagesByFlow(flowId, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE flow_id = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [flowId, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            logger.error('Error getting messages by flow', {
                error: error.message,
                flowId,
            });
            throw error;
        }
    }

    /**
     * Update message delivery status
     */
    async updateDeliveryStatus(messageId, status) {
        return this.update(messageId, {
            delivery_status: status,
        });
    }

    /**
     * Update message by WhatsApp message ID
     */
    async updateByWhatsAppMessageId(whatsappMessageId, status) {
        try {
            const query = `
        SELECT message_id FROM ${this.tableName} 
        WHERE whatsapp_message_id = ? 
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [whatsappMessageId]);

            if (result.rows.length > 0) {
                const messageId = result.rows[0].message_id;
                await this.updateDeliveryStatus(messageId, status);
            }
        } catch (error) {
            logger.error('Error updating message by WhatsApp ID', {
                error: error.message,
                whatsappMessageId,
            });
        }
    }

    /**
     * Get last message in conversation
     */
    async getLastMessage(conversationId) {
        try {
            const query = `
        SELECT * FROM messages_by_conversation 
        WHERE conversation_id = ? 
        LIMIT 1
      `;
            const result = await this.db.execute(query, [conversationId]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRow(result.rows[0]);
        } catch (error) {
            logger.error('Error getting last message', {
                error: error.message,
                conversationId,
            });
            throw error;
        }
    }

    /**
     * Count messages in conversation
     */
    async countByConversation(conversationId) {
        try {
            const query = `
        SELECT COUNT(*) as count FROM messages_by_conversation 
        WHERE conversation_id = ?
      `;
            const result = await this.db.execute(query, [conversationId]);
            return parseInt(result.rows[0].count, 10);
        } catch (error) {
            logger.error('Error counting messages', {
                error: error.message,
                conversationId,
            });
            return 0;
        }
    }

    /**
     * Get messages by conversation (alias for getMessagesByConversation)
     */
    async getByConversation(conversationId, limit = 100) {
        // First, get the IDs and order from the index table
        const indexMessages = await this.getMessagesByConversation(conversationId, limit);

        if (indexMessages.length === 0) {
            return [];
        }

        // Extract message IDs
        const messageIds = indexMessages.map(m => m.message_id);

        // Fetch full details from the main messages table
        try {
            const placeholders = messageIds.map(() => '?').join(',');
            const query = `SELECT * FROM ${this.tableName} WHERE message_id IN (${placeholders})`;
            const result = await this.db.execute(query, messageIds);
            
            const fullMessages = result.rows.map(row => this.mapRow(row));
            
            // Map full messages back to the sorted order from the index table
            const messageMap = new Map(fullMessages.map(m => [m.message_id.toString(), m]));
            
            return indexMessages.map(indexMsg => {
                const fullMsg = messageMap.get(indexMsg.message_id.toString());
                // If full message exists, use it (parsed), otherwise fallback to index data
                if (fullMsg && typeof fullMsg.message_data === 'string') {
                    try {
                        fullMsg.message_data = JSON.parse(fullMsg.message_data);
                    } catch (e) {
                        // Keep as string if parse fails
                    }
                    return fullMsg;
                }
                return fullMsg || indexMsg;
            });

        } catch (error) {
            logger.error('Error fetching full message details', { error: error.message, conversationId });
            // Fallback to index messages if main fetch fails
            return indexMessages;
        }
    }

    /**
     * Delete all messages for a conversation (for preview reset)
     */
    async deleteByConversation(conversationId) {
        try {
            // Delete from main table
            const deleteMainQuery = `
        DELETE FROM ${this.tableName} 
        WHERE conversation_id = ?
      `;
            await this.db.execute(deleteMainQuery, [conversationId]);

            // Delete from conversation index
            const deleteIndexQuery = `
        DELETE FROM messages_by_conversation 
        WHERE conversation_id = ?
      `;
            await this.db.execute(deleteIndexQuery, [conversationId]);

            global.slashLogs(`Deleted all messages for conversation: ${conversationId}`, true, true);
        } catch (error) {
            logger.error('Error deleting messages by conversation', {
                error: error.message,
                conversationId,
            });
            throw error;
        }
    }
}

module.exports = MessageRepository;
