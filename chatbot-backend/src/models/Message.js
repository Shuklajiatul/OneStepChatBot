/**
 * Message Model
 * Represents a message in a conversation
 */

const { MESSAGE_SENDER, MESSAGE_TYPES, DELIVERY_STATUS } = require('../config/constants');

/**
 * typedef {Object} Message
 * property {string} message_id - Unique message identifier
 * property {string} conversation_id - Associated conversation ID
 * property {string} flow_id - Associated flow ID
 * property {string} sender - Message sender (bot, user, system)
 * property {string} message_type - Message type (text, image, button, etc.)
 * property {string} message_text - Message text content
 * property {string} message_data - JSON string of additional message data
 * property {string} node_id - Node that generated this message
 * property {string} whatsapp_message_id - WhatsApp message ID
 * property {string} delivery_status - Delivery status
 * property {Date} timestamp - Message timestamp
 */

/**
 * Create a new message object
 * param {Object} data - Message data
 * returns {Object} Message object
 */
const createMessage = (data) => {
    return {
        message_id: data.message_id || null,
        conversation_id: data.conversation_id,
        flow_id: data.flow_id,
        sender: data.sender || MESSAGE_SENDER.BOT,
        message_type: data.message_type || MESSAGE_TYPES.TEXT,
        message_text: data.message_text || '',
        message_data: typeof data.message_data === 'string' ? data.message_data : JSON.stringify(data.message_data || {}),
        node_id: data.node_id || null,
        whatsapp_message_id: data.whatsapp_message_id || null,
        delivery_status: data.delivery_status || DELIVERY_STATUS.PENDING,
        timestamp: data.timestamp || new Date(),
    };
};

/**
 * Parse message data from JSON string
 * param {Message} message - Message object
 * returns {Object} Parsed message data
 */
const parseMessageData = (message) => {
    if (typeof message.message_data === 'string') {
        try {
            return JSON.parse(message.message_data);
        } catch (error) {
            return {};
        }
    }
    return message.message_data || {};
};

/**
 * Create a text message
 * param {string} conversationId - Conversation ID
 * param {string} flowId - Flow ID
 * param {string} text - Message text
 * param {string} sender - Sender (bot or user)
 * param {string} nodeId - Node ID
 * returns {Object} Message object
 */
const createTextMessage = (conversationId, flowId, text, sender = MESSAGE_SENDER.BOT, nodeId = null) => {
    return createMessage({
        conversation_id: conversationId,
        flow_id: flowId,
        sender,
        message_type: MESSAGE_TYPES.TEXT,
        message_text: text,
        node_id: nodeId,
    });
};

/**
 * Create an interactive button message
 * param {string} conversationId - Conversation ID
 * param {string} flowId - Flow ID
 * param {string} text - Message text
 * param {Array} buttons - Array of button objects
 * param {string} nodeId - Node ID
 * returns {Object} Message object
 */
const createButtonMessage = (conversationId, flowId, text, buttons, nodeId = null) => {
    return createMessage({
        conversation_id: conversationId,
        flow_id: flowId,
        sender: MESSAGE_SENDER.BOT,
        message_type: MESSAGE_TYPES.INTERACTIVE,
        message_text: text,
        message_data: {
            type: 'button',
            buttons,
        },
        node_id: nodeId,
    });
};

/**
 * Create an interactive list message
 * param {string} conversationId - Conversation ID
 * param {string} flowId - Flow ID
 * param {string} text - Message text
 * param {string} buttonText - List button text
 * param {Array} sections - Array of section objects
 * param {string} nodeId - Node ID
 * returns {Object} Message object
 */
const createListMessage = (conversationId, flowId, text, buttonText, sections, nodeId = null) => {
    return createMessage({
        conversation_id: conversationId,
        flow_id: flowId,
        sender: MESSAGE_SENDER.BOT,
        message_type: MESSAGE_TYPES.INTERACTIVE,
        message_text: text,
        message_data: {
            type: 'list',
            button: buttonText,
            sections,
        },
        node_id: nodeId,
    });
};

module.exports = {
    createMessage,
    parseMessageData,
    createTextMessage,
    createButtonMessage,
    createListMessage,
};
