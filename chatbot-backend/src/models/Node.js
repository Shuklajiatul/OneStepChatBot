/**
 * Node Types and Structures
 * Defines all node types and their data structures
 */

const { NODE_TYPES } = require('../config/constants');

/**
 * @typedef {Object} MessageNode
 * @property {string} id - Node ID
 * @property {string} type - 'message'
 * @property {Object} data - Node data
 * @property {string} data.message - Message text
 * @property {string} data.media_url - Optional media URL
 * @property {string} data.media_type - Optional media type (image, video, audio, document)
 * @property {string} next - Next node ID
 */

/**
 * @typedef {Object} QuestionNode
 * @property {string} id - Node ID
 * @property {string} type - 'question'
 * @property {Object} data - Node data
 * @property {string} data.question - Question text
 * @property {string} data.variable_name - Variable name to store answer
 * @property {string} data.validation_type - Optional validation (email, phone, number, text)
 * @property {string} next - Next node ID
 */

/**
 * @typedef {Object} ButtonNode
 * @property {string} id - Node ID
 * @property {string} type - 'buttons'
 * @property {Object} data - Node data
 * @property {string} data.message - Message text
 * @property {Array<{id: string, title: string, next: string}>} data.buttons - Button options (max 3)
 */

/**
 * @typedef {Object} ListNode
 * @property {string} id - Node ID
 * @property {string} type - 'list'
 * @property {Object} data - Node data
 * @property {string} data.message - Message text
 * @property {string} data.button_text - List button text
 * @property {Array<{title: string, rows: Array<{id: string, title: string, description: string, next: string}>}>} data.sections - List sections
 */

/**
 * @typedef {Object} ConditionNode
 * @property {string} id - Node ID
 * @property {string} type - 'condition'
 * @property {Object} data - Node data
 * @property {Array<{variable: string, operator: string, value: string, next: string}>} data.conditions - Conditions to evaluate
 * @property {string} data.default_next - Default next node if no condition matches
 */

/**
 * @typedef {Object} WebhookNode
 * @property {string} id - Node ID
 * @property {string} type - 'webhook'
 * @property {Object} data - Node data
 * @property {string} data.url - Webhook URL
 * @property {string} data.method - HTTP method (GET, POST, PUT, DELETE)
 * @property {Object} data.headers - Request headers
 * @property {Object} data.body - Request body
 * @property {string} data.response_variable - Variable name to store response
 * @property {string} next - Next node ID
 */

/**
 * @typedef {Object} DelayNode
 * @property {string} id - Node ID
 * @property {string} type - 'delay'
 * @property {Object} data - Node data
 * @property {number} data.delay_seconds - Delay in seconds
 * @property {string} next - Next node ID
 */

/**
 * @typedef {Object} EndNode
 * @property {string} id - Node ID
 * @property {string} type - 'end'
 * @property {Object} data - Node data
 * @property {string} data.message - Optional final message
 */

/**
 * Validate node structure
 * @param {Object} node - Node to validate
 * @returns {Object} {isValid, errors}
 */
const validateNode = (node) => {
    const errors = [];

    if (!node.id) {
        errors.push('Node must have an id');
    }

    if (!node.type) {
        errors.push('Node must have a type');
    }

    if (!Object.values(NODE_TYPES).includes(node.type)) {
        errors.push(`Invalid node type: ${node.type}`);
    }

    if (!node.data) {
        errors.push('Node must have data');
    }

    // Type-specific validation
    switch (node.type) {
        case NODE_TYPES.MESSAGE:
            if (!node.data.message) {
                errors.push('Message node must have a message');
            }
            if (!node.next) {
                errors.push('Message node must have a next node');
            }
            break;

        case NODE_TYPES.QUESTION:
            if (!node.data.question) {
                errors.push('Question node must have a question');
            }
            if (!node.data.variable_name) {
                errors.push('Question node must have a variable_name');
            }
            if (!node.next) {
                errors.push('Question node must have a next node');
            }
            break;

        case NODE_TYPES.BUTTONS:
            if (!node.data.message) {
                errors.push('Button node must have a message');
            }
            if (!node.data.buttons || !Array.isArray(node.data.buttons)) {
                errors.push('Button node must have a buttons array');
            } else if (node.data.buttons.length === 0 || node.data.buttons.length > 3) {
                errors.push('Button node must have 1-3 buttons');
            }
            break;

        case NODE_TYPES.LIST:
            if (!node.data.message) {
                errors.push('List node must have a message');
            }
            if (!node.data.button_text) {
                errors.push('List node must have button_text');
            }
            if (!node.data.sections || !Array.isArray(node.data.sections)) {
                errors.push('List node must have a sections array');
            }
            break;

        case NODE_TYPES.CONDITION:
            if (!node.data.conditions || !Array.isArray(node.data.conditions)) {
                errors.push('Condition node must have a conditions array');
            }
            if (!node.data.default_next) {
                errors.push('Condition node must have a default_next');
            }
            break;

        case NODE_TYPES.WEBHOOK:
            if (!node.data.url) {
                errors.push('Webhook node must have a url');
            }
            if (!node.data.method) {
                errors.push('Webhook node must have a method');
            }
            if (!node.next) {
                errors.push('Webhook node must have a next node');
            }
            break;

        case NODE_TYPES.DELAY:
            if (!node.data.delay_seconds || node.data.delay_seconds <= 0) {
                errors.push('Delay node must have a positive delay_seconds');
            }
            if (!node.next) {
                errors.push('Delay node must have a next node');
            }
            break;

        case NODE_TYPES.END:
            // End nodes don't need validation beyond basic structure
            break;

        default:
            errors.push(`Unknown node type: ${node.type}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

module.exports = {
    NODE_TYPES,
    validateNode,
};
