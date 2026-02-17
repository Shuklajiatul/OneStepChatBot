/**
 * Conversation Model
 * Represents a conversation between a user and the chatbot
 */

const { CONVERSATION_STATUS, CHANNELS } = require('../config/constants');

/**
 * Create a new conversation object
*/
const createConversation = (data) => {
    return {
        conversation_id: data.conversation_id || null,
        flow_id: data.flow_id,
        user_phone: data.user_phone,
        user_name: data.user_name || '',
        platform_user_id: data.platform_user_id,
        current_node_id: data.current_node_id || null, // Should be UUID, not 'start'
        session_data: typeof data.session_data === 'string' ? data.session_data : JSON.stringify(data.session_data || {}),
        status: data.status || CONVERSATION_STATUS.ACTIVE,
        channel: data.channel || CHANNELS.WHATSAPP,
        started_at: data.started_at || new Date(),
        last_message_at: data.last_message_at || new Date(),
        completed_at: data.completed_at || null,
    };
};

/**
 * Parse session data from JSON string
*/
const parseSessionData = (conversation) => {
    if (typeof conversation.session_data === 'string') {
        try {
            return JSON.parse(conversation.session_data);
        } catch (error) {
            return {};
        }
    }
    return conversation.session_data || {};
};

/**
 * Update session data
*/
const updateSessionData = (conversation, updates) => {
    const currentData = parseSessionData(conversation);
    const updatedData = { ...currentData, ...updates };
    return JSON.stringify(updatedData);
};

/**
 * Get variable from session
*/
const getSessionVariable = (conversation, variableName) => {
    const sessionData = parseSessionData(conversation);

    // Support dot notation (e.g., "webhook.response.id")
    const parts = variableName.split('.');
    let value = sessionData;

    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            return null;
        }
    }

    return value;
};

/**
 * Set variable in session
*/
const setSessionVariable = (conversation, variableName, value) => {
    const sessionData = parseSessionData(conversation);
    sessionData[variableName] = value;
    return JSON.stringify(sessionData);
};

module.exports = {
    createConversation,
    parseSessionData,
    updateSessionData,
    getSessionVariable,
    setSessionVariable,
};
