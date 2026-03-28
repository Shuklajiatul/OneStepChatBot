const BaseRepository = require('../database/base/BaseRepository');
const { createConversation } = require('../models/Conversation');
const { CONVERSATION_STATUS, DEFAULTS } = require('../config/constants');
const logger = require('../config/logger');

/**
 * Conversation Repository
 * Handles all database operations for conversations
 */
class ConversationRepository extends BaseRepository {
    constructor() {
        super('conversations');
    }

    // Get primary key column name
    
    getPrimaryKey() {
        return 'conversation_id';
    }

    // Create a new conversation
    
    async createConversation(conversationData) {
        const conversation = createConversation(conversationData);
        return this.create(conversation);
    }

    // Get active conversation by user phone and flow
    
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
            const conversation = this.mapRow(result.rows[0]);

            // Session timeout check
            // If the user has been inactive longer than SESSION_TIMEOUT, mark the
            // conversation as ABANDONED so a fresh one starts on next message.
            const lastActivity = conversation.last_message_at
                ? new Date(conversation.last_message_at).getTime()
                : new Date(conversation.created_at).getTime();

            const idleMs = Date.now() - lastActivity;

            if (idleMs > DEFAULTS.SESSION_TIMEOUT) {
                global.slashLogs(
                    `Session timed out for conversationId: ${conversation.conversation_id} ` +
                    `(idle ${Math.round(idleMs / 60000)} min). Marking as ABANDONED.`,
                    true, true
                );
                await this.abandonConversation(conversation.conversation_id);
                return null; // Caller will start a fresh conversation
            }

            return conversation;
        } catch (error) {
            global.slashLogs(`Error getting active conversation ${error.message}`, true, true);
            throw error;
        }
    }

    // Get conversations by flow
    
    async getConversationsByFlow(flowId, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE flow_id = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [flowId, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error getting conversations by flow ${error.message}`, true, true);
            throw error;
        }
    }

    // Get conversations by user phone
    
    async getConversationsByPhone(userPhone, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE user_phone = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [userPhone, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error getting conversations by phone ${error.message}`, true, true);
            throw error;
        }
    }

    // Update conversation node
     
    async updateCurrentNode(conversationId, nodeId) {
        return this.update(conversationId, {
            current_node_id: nodeId,
            last_message_at: new Date(),
        });
    }

    // Update session data
     
    async updateSessionData(conversationId, sessionData) {
        return this.update(conversationId, {
            session_data: sessionData,
            last_message_at: new Date(),
        });
    }

    // Complete a conversation
     
    async completeConversation(conversationId) {
        return this.update(conversationId, {
            status: CONVERSATION_STATUS.COMPLETED,
            completed_at: new Date(),
            last_message_at: new Date(),
        });
    }

    // Abandon a conversation
     
    async abandonConversation(conversationId) {
        return this.update(conversationId, {
            status: CONVERSATION_STATUS.ABANDONED,
            last_message_at: new Date(),
        });
    }

    // Set conversation to human takeover
     
    async setHumanTakeover(conversationId) {
        return this.update(conversationId, {
            status: CONVERSATION_STATUS.HUMAN_TAKEOVER,
            last_message_at: new Date(),
        });
    }

    // Update conversation status
     
    async updateStatus(conversationId, status) {
        return this.update(conversationId, {
            status,
            last_message_at: new Date(),
        });
    }

    // Get conversations by status
    
    async getConversationsByStatus(status, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE status = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [status, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error getting conversations by status ${error.message}`, true, true);
            throw error;
        }
    }

    // Get all active, human_takeover, or pending_agent conversations for a flow (admin live panel)
    async getActiveByFlow(flowId, limit = 100) {
        try {
            const statuses = [
                CONVERSATION_STATUS.ACTIVE,
                CONVERSATION_STATUS.HUMAN_TAKEOVER,
                CONVERSATION_STATUS.PENDING_AGENT,
            ];
            const rows = [];
            for (const status of statuses) {
                const result = await this.db.execute(
                    `SELECT * FROM ${this.tableName} WHERE flow_id = ? AND status = ? LIMIT ? ALLOW FILTERING`,
                    [flowId, status, limit]
                );
                rows.push(...result.rows);
            }
            return rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error getting active conversations by flow ${error.message}`, true, true);
            throw error;
        }
    }

    // Find a conversation currently in human_takeover for a specific user+flow
    async findHumanTakeoverByPhone(userPhone, flowId) {
        try {
            const query = `
        SELECT * FROM ${this.tableName}
        WHERE user_phone = ?
        AND flow_id = ?
        AND status = ?
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [userPhone, flowId, CONVERSATION_STATUS.HUMAN_TAKEOVER]);
            if (result.rows.length === 0) return null;
            return this.mapRow(result.rows[0]);
        } catch (error) {
            global.slashLogs(`Error finding human takeover conversation ${error.message}`, true, true);
            return null;
        }
    }

    // Find a conversation currently waiting for an agent (PENDING_AGENT) for a specific user+flow
    async findPendingAgentByPhone(userPhone, flowId) {
        try {
            const query = `
        SELECT * FROM ${this.tableName}
        WHERE user_phone = ?
        AND flow_id = ?
        AND status = ?
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [userPhone, flowId, CONVERSATION_STATUS.PENDING_AGENT]);
            if (result.rows.length === 0) return null;
            return this.mapRow(result.rows[0]);
        } catch (error) {
            global.slashLogs(`Error finding pending agent conversation ${error.message}`, true, true);
            return null;
        }
    }

    // Set conversation to PENDING_AGENT and store the fallbackNodeId for timeout use
    async setPendingAgent(conversationId, fallbackNodeId = null) {
        return this.update(conversationId, {
            status:           CONVERSATION_STATUS.PENDING_AGENT,
            // Reuse current_node_id to store fallbackNodeId temporarily — it is
            // overwritten by updateCurrentNode() if the agent accepts or fallback fires.
            // We store it in session_data under a reserved key to keep current_node_id clean.
            last_message_at:  new Date(),
        });
    }

    // Generic updateStatus helper — used by socketHandlers for accept/reject/handback
    async updateStatus(conversationId, status) {
        return this.update(conversationId, {
            status,
            last_message_at: new Date(),
        });
    }
}

module.exports = ConversationRepository;
