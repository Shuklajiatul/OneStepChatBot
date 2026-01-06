const BaseRepository = require('../database/base/BaseRepository');
const { createFlow } = require('../models/Flow');
const { FLOW_STATUS } = require('../config/constants');
const logger = require('../config/logger');

/**
 * Flow Repository
 * Handles all database operations for flows
 */
class FlowRepository extends BaseRepository {
    constructor() {
        super('flows');
    }

    /**
     * Get primary key column name
     * returns {string}
     */
    getPrimaryKey() {
        return 'flow_id';
    }

    /**
     * Create a new flow
     */
    async createFlow(flowData) {
        const flow = createFlow(flowData);
        return this.create(flow);
    }

    /**
     * Get all flows for a user
     */
    async getFlowsByUser(userId, limit = 100) {
        return this.findMany({ user_id: userId }, limit);
    }

    /**
     * Get flow by WhatsApp number
     */
    async getFlowByWhatsAppNumber(whatsappNumber) {
        try {
            const query = `
        SELECT * FROM ${this.tableName} 
        WHERE whatsapp_number = ? 
        AND status = ? 
        AND is_published = true 
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [whatsappNumber, FLOW_STATUS.ACTIVE]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRow(result.rows[0]);
        } catch (error) {
            logger.error('Error getting flow by WhatsApp number', {
                error: error.message,
                whatsappNumber,
            });
            throw error;
        }
    }

    /**
     * Get flow by Instagram username
     * param {string} instagramUsername - Instagram username
     * returns {Promise<Object|null>} Flow or null
     */
    async getFlowByInstagramUsername(instagramUsername) {
        try {
            const query = `
        SELECT * FROM ${this.tableName} 
        WHERE instagram_username = ? 
        AND status = ? 
        AND is_published = true 
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [instagramUsername, FLOW_STATUS.ACTIVE]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRow(result.rows[0]);
        } catch (error) {
            logger.error('Error getting flow by Instagram username', {
                error: error.message,
                instagramUsername,
            });
            throw error;
        }
    }

    /**
     * Publish a flow
     * param {string} flowId - Flow ID
     * returns {Promise<Object>} Updated flow
     */
    async publishFlow(flowId) {
        return this.update(flowId, {
            is_published: true,
            status: FLOW_STATUS.ACTIVE,
            published_at: new Date(),
        });
    }

    /**
     * Unpublish a flow
     * param {string} flowId - Flow ID
     * returns {Promise<Object>} Updated flow
     */
    async unpublishFlow(flowId) {
        return this.update(flowId, {
            is_published: false,
            status: FLOW_STATUS.PAUSED,
        });
    }

    /**
     * Increment conversation count
     * param {string} flowId - Flow ID
     * returns {Promise<void>}
     */
    async incrementConversationCount(flowId) {
        try {
            const flow = await this.findById(flowId);
            if (flow) {
                await this.update(flowId, {
                    total_conversations: (flow.total_conversations || 0) + 1,
                });
            }
        } catch (error) {
            logger.error('Error incrementing conversation count', {
                error: error.message,
                flowId,
            });
        }
    }

    /**
     * Increment message count
     * param {string} flowId - Flow ID
     * returns {Promise<void>}
     */
    async incrementMessageCount(flowId) {
        try {
            const flow = await this.findById(flowId);
            if (flow) {
                await this.update(flowId, {
                    total_messages: (flow.total_messages || 0) + 1,
                });
            }
        } catch (error) {
            logger.error('Error incrementing message count', {
                error: error.message,
                flowId,
            });
        }
    }

    /**
     * Get flows by status
     * param {string} status - Flow status
     * param {number} limit - Maximum number of flows
     * returns {Promise<Object[]>} Array of flows
     */
    async getFlowsByStatus(status, limit = 100) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE status = ? LIMIT ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [status, limit]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            logger.error('Error getting flows by status', {
                error: error.message,
                status,
            });
            throw error;
        }
    }
}

module.exports = FlowRepository;
