const BaseRepository = require('../database/base/BaseRepository');
const { generateUUID } = require('../utils/uuid');
const logger = require('../config/logger');

/**
 * Collected Data Repository
 * Handles storage and retrieval of collected variables from conversations
 */
class CollectedDataRepository extends BaseRepository {
    constructor() {
        super('collected_data');
    }

    // Get primary key column name
     
    getPrimaryKey() {
        return 'conversation_id';
    }

    // Save collected variable
     
    async saveVariable(conversationId, variableName, variableValue, nodeId = null) {
        try {
            const query = `
        INSERT INTO ${this.tableName} 
        (conversation_id, variable_name, variable_value, collected_at, node_id)
        VALUES (?, ?, ?, ?, ?)
      `;

            const collectedAt = new Date();

            await this.db.execute(query, [
                conversationId,
                variableName,
                variableValue,
                collectedAt,
                nodeId,
            ]);

            return {
                conversation_id: conversationId,
                variable_name: variableName,
                variable_value: variableValue,
                collected_at: collectedAt,
                node_id: nodeId,
            };
        } catch (error) {
            global.slashLogs(`Error saving collected variable ${error.message}`, true, true);
            throw error;
        }
    }

    // Get all collected data for a conversation
    
    async getByConversation(conversationId) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE conversation_id = ?`;
            const result = await this.db.execute(query, [conversationId]);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error getting collected data ${error.message}`, true, true);
            throw error;
        }
    }

    // Get specific variable value
     
    async getVariable(conversationId, variableName) {
        try {
            const query = `
        SELECT variable_value FROM ${this.tableName} 
        WHERE conversation_id = ? AND variable_name = ?
      `;
            const result = await this.db.execute(query, [conversationId, variableName]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].variable_value;
        } catch (error) {
            global.slashLogs(`Error getting variable ${error.message}`, true, true);
            throw error;
        }
    }

    // Get collected data as key-value object
    async getAsObject(conversationId) {
        try {
            const data = await this.getByConversation(conversationId);
            const result = {};

            data.forEach((item) => {
                result[item.variable_name] = item.variable_value;
            });

            return result;
        } catch (error) {
            global.slashLogs(`Error getting collected data as object ${error.message}`, true, true);
            throw error;
        }
    }

    //Delete all collected data for a conversation
    async deleteByConversation(conversationId) {
        try {
            const query = `DELETE FROM ${this.tableName} WHERE conversation_id = ?`;
            await this.db.execute(query, [conversationId]);
            global.slashLogs(`Deleted collected data for conversation ${conversationId}`, true, true);
        } catch (error) {
            global.slashLogs(`Error deleting collected data ${error.message}`, true, true);
            throw error;
        }
    }
}

module.exports = CollectedDataRepository;
