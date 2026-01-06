/**
 * User Model
 * Represents a platform user
 */

const { USER_PLANS } = require('../config/constants');

/**
 * typedef {Object} User
 * property {string} user_id - Unique user identifier
 * property {string} email - User email
 * property {string} password_hash - Hashed password
 * property {string} company_name - Company name
 * property {string} whatsapp_api_key - WhatsApp API key
 * property {string} whatsapp_phone_number_id - WhatsApp phone number ID
 * property {string} whatsapp_business_account_id - WhatsApp business account ID
 * property {string} instagram_access_token - Instagram access token
 * property {string} instagram_page_id - Instagram page ID
 * property {string} plan - User plan (free, starter, professional, enterprise)
 * property {Date} plan_expires_at - Plan expiration date
 * property {number} total_flows - Total flows count
 * property {number} total_conversations - Total conversations count
 * property {Date} created_at - Account creation timestamp
 * property {Date} updated_at - Last update timestamp
 */

/**
 * Create a new user object
 * param {Object} data - User data
 * returns {Object} User object
 */
const createUser = (data) => {
    return {
        user_id: data.user_id || null,
        email: data.email,
        password_hash: data.password_hash,
        company_name: data.company_name || '',
        whatsapp_api_key: data.whatsapp_api_key || null,
        whatsapp_phone_number_id: data.whatsapp_phone_number_id || null,
        whatsapp_business_account_id: data.whatsapp_business_account_id || null,
        instagram_access_token: data.instagram_access_token || null,
        instagram_page_id: data.instagram_page_id || null,
        plan: data.plan || USER_PLANS.FREE,
        plan_expires_at: data.plan_expires_at || null,
        total_flows: data.total_flows || 0,
        total_conversations: data.total_conversations || 0,
        created_at: data.created_at || new Date(),
        updated_at: data.updated_at || new Date(),
    };
};

// Get safe user object (without sensitive data)
const getSafeUser = (user) => {
    const { password_hash, whatsapp_api_key, instagram_access_token, ...safeUser } = user;
    // return safeUser;
    return user;
};

// Check if user has WhatsApp configured
const hasWhatsAppConfigured = (user) => {
    return !!(user.whatsapp_api_key && user.whatsapp_phone_number_id);
};

// Check if user has Instagram configured
const hasInstagramConfigured = (user) => {
    return !!(user.instagram_access_token && user.instagram_page_id);
};

// Check if user's plan is active
const isPlanActive = (user) => {
    if (user.plan === USER_PLANS.FREE) {
        return true;
    }
    if (!user.plan_expires_at) {
        return false;
    }
    return new Date(user.plan_expires_at) > new Date();
};

module.exports = {
    createUser,
    getSafeUser,
    hasWhatsAppConfigured,
    hasInstagramConfigured,
    isPlanActive,
};
