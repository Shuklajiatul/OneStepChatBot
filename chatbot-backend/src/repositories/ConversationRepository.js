const BaseRepository = require('../database/base/BaseRepository');
const { createConversation } = require('../models/Conversation');
const { CONVERSATION_STATUS } = require('../config/constants');
const logger = require('../config/logger');

/**
 * Conversation Repository
 * Handles all database operations for conversations
 */
class ConversationRepository extends BaseRepository {
    constructor() {
        super('conversations');
    }

    /**
     * Get primary key column name
     */
    getPrimaryKey() {
        return 'conversation_id';
    }

    /**
     * Create a new conversation
     */
    async createConversation(conversationData) {
        const conversation = createConversation(conversationData);
        return this.create(conversation);
    }

    /**
     * Get active conversation by user phone and flow
     */
    async getActiveConversation(userPhone, flowId) {
        try {
            const query = `
        SELECT * FROM ${this.tableName} 
        WHERE user_phone = ? 
        AND flow_id = ? 
        AND status = ? 
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [userPhone, flowId, CONVERSATION_STATUS.ACTIVE]);

            if (result.rows.length === 0) {
                return null;
            }

            // Return the most recent conversation
            return this.mapRow(result.rows[0]);
        } catch (error) {
            logger.error('Error getting active conversation', {
                error: error.message,
                userPhone,
                flowId,
            });
            throw error;
        }
    }

    /**
     * Get conversations by flow
     */
    async getConversationsByFlow(flowId, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE flow_id = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [flowId, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            logger.error('Error getting conversations by flow', {
                error: error.message,
                flowId,
            });
            throw error;
        }
    }

    /**
     * Get conversations by user phone
     */
    async getConversationsByPhone(userPhone, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE user_phone = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [userPhone, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            logger.error('Error getting conversations by phone', {
                error: error.message,
                userPhone,
            });
            throw error;
        }
    }

    /**
     * Update conversation node
     * @param {string} conversationId - Conversation ID
     * @param {string} nodeId - New current node ID
     * @returns {Promise<Object>} Updated conversation
     */
    async updateCurrentNode(conversationId, nodeId) {
        return this.update(conversationId, {
            current_node_id: nodeId,
            last_message_at: new Date(),
        });
    }

    /**
     * Update session data
     * @param {string} conversationId - Conversation ID
     * @param {string} sessionData - Session data as JSON string
     * @returns {Promise<Object>} Updated conversation
     */
    async updateSessionData(conversationId, sessionData) {
        return this.update(conversationId, {
            session_data: sessionData,
            last_message_at: new Date(),
        });
    }

    /**
     * Complete a conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<Object>} Updated conversation
     */
    async completeConversation(conversationId) {
        return this.update(conversationId, {
            status: CONVERSATION_STATUS.COMPLETED,
            completed_at: new Date(),
            last_message_at: new Date(),
        });
    }

    /**
     * Abandon a conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<Object>} Updated conversation
     */
    async abandonConversation(conversationId) {
        return this.update(conversationId, {
            status: CONVERSATION_STATUS.ABANDONED,
            last_message_at: new Date(),
        });
    }

    /**
     * Set conversation to human takeover
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<Object>} Updated conversation
     */
    async setHumanTakeover(conversationId) {
        return this.update(conversationId, {
            status: CONVERSATION_STATUS.HUMAN_TAKEOVER,
            last_message_at: new Date(),
        });
    }

    /**
     * Update conversation status
     * @param {string} conversationId - Conversation ID
     * @param {string} status - New status
     * @returns {Promise<Object>} Updated conversation
     */
    async updateStatus(conversationId, status) {
        return this.update(conversationId, {
            status,
            last_message_at: new Date(),
        });
    }

    /**
     * Get conversations by status
     * @param {string} status - Conversation status
     * @param {number} limit - Maximum number of conversations
     * @returns {Promise<Object[]>} Array of conversations
     */
    async getConversationsByStatus(status, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE status = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [status, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            logger.error('Error getting conversations by status', {
                error: error.message,
                status,
            });
            throw error;
        }
    }
}

module.exports = ConversationRepository;
