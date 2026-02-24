const BaseRepository = require('../database/base/BaseRepository');
const { createUser, getSafeUser } = require('../models/User');
const logger = require('../config/logger');

/**
 * User Repository
 * Handles all database operations for users
 */
class UserRepository extends BaseRepository {
    constructor() {
        super('users');
    }

    /**
     * Get primary key column name
     * @returns {string}
     */
    getPrimaryKey() {
        return 'user_id';
    }

    /**
     * Create a new user
     * param {Object} userData - User data
     * returns {Promise<Object>} Created user (without sensitive data)
     */
    async createUser(userData) {
        const user = createUser(userData);
        const createdUser = await this.create(user);
        return getSafeUser(createdUser);
    }

    /**
     * Find user by email
     * param {string} email - User email
     * returns {Promise<Object|null>} User or null
     */
    async findByEmail(email) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE email = ? ALLOW FILTERING`;
            const result = await this.db.execute(query, [email]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRow(result.rows[0]);
        } catch (error) {
            global.slashLogs(`Error finding user by email ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Update user WhatsApp configuration
     * @param {string} userId - User ID
     * @param {Object} whatsappConfig - WhatsApp configuration
     * @returns {Promise<Object>} Updated user
     */
    async updateWhatsAppConfig(userId, whatsappConfig) {
        const updateData = {};

        if (whatsappConfig.api_key) {
            updateData.whatsapp_api_key = whatsappConfig.api_key;
        }
        if (whatsappConfig.phone_number_id) {
            updateData.whatsapp_phone_number_id = whatsappConfig.phone_number_id;
        }
        if (whatsappConfig.business_account_id) {
            updateData.whatsapp_business_account_id = whatsappConfig.business_account_id;
        }

        const updatedUser = await this.update(userId, updateData);
        return getSafeUser(updatedUser);
    }

    /**
     * Update user Instagram configuration
     * @param {string} userId - User ID
     * @param {Object} instagramConfig - Instagram configuration
     * @returns {Promise<Object>} Updated user
     */
    async updateInstagramConfig(userId, instagramConfig) {
        const updateData = {};

        if (instagramConfig.access_token) {
            updateData.instagram_access_token = instagramConfig.access_token;
        }
        if (instagramConfig.page_id) {
            updateData.instagram_page_id = instagramConfig.page_id;
        }

        const updatedUser = await this.update(userId, updateData);
        return getSafeUser(updatedUser);
    }

    /**
     * Update user plan
     * @param {string} userId - User ID
     * @param {string} plan - Plan name
     * @param {Date} expiresAt - Plan expiration date
     * @returns {Promise<Object>} Updated user
     */
    async updatePlan(userId, plan, expiresAt) {
        const updatedUser = await this.update(userId, {
            plan,
            plan_expires_at: expiresAt,
        });
        return getSafeUser(updatedUser);
    }

    /**
     * Increment flow count
     * param {string} userId - User ID
     * returns {Promise<void>}
     */
    async incrementFlowCount(userId) {
        try {
            const user = await this.findById(userId);
            if (user) {
                await this.update(userId, {
                    total_flows: (user.total_flows || 0) + 1,
                });
            }
        } catch (error) {
            console.log("Error incrementing flow count", error);
        }
    }

    /**
     * Decrement flow count
     * param {string} userId - User ID
     * returns {Promise<void>}
     */
    async decrementFlowCount(userId) {
        try {
            const user = await this.findById(userId);
            if (user && user.total_flows > 0) {
                await this.update(userId, {
                    total_flows: user.total_flows - 1,
                });
            }
        } catch (error) {
            global.slashLogs(`Error decrementing flow count ${error.message}`, true, true);
        }
    }

    /**
     * Increment conversation count
     * param {string} userId - User ID
     * returns {Promise<void>}
     */
    async incrementConversationCount(userId) {
        try {
            const user = await this.findById(userId);
            if (user) {
                await this.update(userId, {
                    total_conversations: (user.total_conversations || 0) + 1,
                });
            }
        } catch (error) {
            global.slashLogs(`Error incrementing conversation count ${error.message}`, true, true);
        }
    }

    /**
     * Get user with safe data (override to return safe user by default)
     */
    async findById(id) {
        const user = await super.findById(id);
        return user ? user : null; // Return full user for internal operations
    }

    /**
     * Get safe user by ID (for API responses)
     */
    async getSafeUserById(id) {
        const user = await this.findById(id);
        return user ? getSafeUser(user) : null;
    }
}

module.exports = UserRepository;
