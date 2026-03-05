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

    //Get primary key column name
    getPrimaryKey() {
        return 'flow_id';
    }

    // Create a new flow
    async createFlow(flowData) {
        const flow = createFlow(flowData);
        return this.create(flow);
    }

    // Get all flows for a user
     
    async getFlowsByUser(userId, limit = 100) {
        return this.findMany({ user_id: userId }, limit);
    }

    // Get flow by WhatsApp number
     
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
            global.slashLogs(`Error getting flow by WhatsApp number ${error.message}`, true, true);
            throw error;
        }
    }

    // Check if a WhatsApp number is already mapped to another published flow
    async isWhatsAppNumberTaken(whatsappNumber, excludeFlowId) {
        try {
            const query = `
        SELECT flow_id FROM ${this.tableName} 
        WHERE whatsapp_number = ? 
        AND is_published = true 
        ALLOW FILTERING
      `;
            const result = await this.db.execute(query, [whatsappNumber]);

            // Filter out the current flow being published
            const otherFlows = result.rows.filter(
                (row) => row.flow_id.toString() !== excludeFlowId.toString()
            );

            return otherFlows.length > 0;
        } catch (error) {
            global.slashLogs(`Error checking WhatsApp number ${error.message}`, true, true);
            throw error;
        }
    }

    // Get flow by Instagram username
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
            global.slashLogs(`Error getting flow by Instagram username ${error.message}`, true, true);
            throw error;
        }
    }

    // Publish a flow
    async publishFlow(flowId, whatsapp_number) {
        return this.update(flowId, {
            is_published: true,
            status: FLOW_STATUS.ACTIVE,
            whatsapp_number: whatsapp_number,
            published_at: new Date(),
        });
    }

    // Unpublish a flow
    async unpublishFlow(flowId) {
        return this.update(flowId, {
            is_published: false,
            status: FLOW_STATUS.PAUSED,
            whatsapp_number: null,
        });
    }

    // Increment conversation count
    async incrementConversationCount(flowId) {
        try {
            const flow = await this.findById(flowId);
            if (flow) {
                await this.update(flowId, {
                    total_conversations: (flow.total_conversations || 0) + 1,
                });
            }
        } catch (error) {
            global.slashLogs(`Error incrementing conversation count ${error.message}`, true, true);
        }
    }

    //Increment message count
    async incrementMessageCount(flowId) {
        try {
            const flow = await this.findById(flowId);
            if (flow) {
                await this.update(flowId, {
                    total_messages: (flow.total_messages || 0) + 1,
                });
            }
        } catch (error) {
            global.slashLogs(`Error incrementing message count ${error.message}`, true, true);
        }
    }

    // Get flows by status
    async getFlowsByStatus(query, params = []) {
        try {
            const result = await this.db.execute(query, params);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error getting flows by status ${error.message}`, true, true);
            throw error;
        }
    }
}

module.exports = FlowRepository;
