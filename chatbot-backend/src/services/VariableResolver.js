const logger = require('../config/logger');
const { parseSessionData, getSessionVariable } = require('../models/Conversation');
const { safeJSONParse } = require('../utils/helpers');

/**
 * Variable Resolver Service
 * Resolves variable placeholders in messages
 */
class VariableResolver {
    /**
     * Replace variables in text
     * param {string} text - Text with variable placeholders
     * param {Object} conversation - Conversation object
     * param {Object} additionalData - Additional data to use for resolution
     * returns {string} Text with variables replaced
     */
    static resolve(text, conversation, additionalData = {}) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        const sessionData = parseSessionData(conversation);
        const allData = { ...sessionData, ...additionalData };

        // Find all {{variable}} patterns
        const variablePattern = /\{\{([^}]+)\}\}/g;

        return text.replace(variablePattern, (match, variablePath) => {
            const trimmedPath = variablePath.trim();
            const value = this.getNestedValue(allData, trimmedPath);

            if (value === null || value === undefined) {
                global.slashLogs(`Variable not found ${error.message}`, true, true);
                return match; // Keep original placeholder if not found
            }

            return String(value);
        });
    }

    /**
     * Get nested value from object using dot notation
     * param {Object} obj - Object to search
     * param {string} path - Dot-notation path (e.g., "webhook.response.id")
     * returns {*} Value or null
     * private
     */
    static getNestedValue(obj, path) {
        const parts = path.split('.');
        let value = obj;

        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }

        return value;
    }

    /**
     * Extract all variable names from text
     * @param {string} text - Text with variable placeholders
     * @returns {string[]} Array of variable names
     */
    static extractVariables(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        const variablePattern = /\{\{([^}]+)\}\}/g;
        const variables = [];
        let match;

        while ((match = variablePattern.exec(text)) !== null) {
            variables.push(match[1].trim());
        }

        return variables;
    }

    /**
     * Check if text contains variables
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    static hasVariables(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        return /\{\{([^}]+)\}\}/.test(text);
    }

    /**
     * Resolve variables in an object (recursively)
     * @param {Object} obj - Object with potential variable placeholders
     * @param {Object} conversation - Conversation object
     * @param {Object} additionalData - Additional data
     * @returns {Object} Object with variables resolved
     */
    static resolveObject(obj, conversation, additionalData = {}) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.resolveObject(item, conversation, additionalData));
        }

        const resolved = {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                resolved[key] = this.resolve(value, conversation, additionalData);
            } else if (typeof value === 'object') {
                resolved[key] = this.resolveObject(value, conversation, additionalData);
            } else {
                resolved[key] = value;
            }
        }

        return resolved;
    }
}

module.exports = VariableResolver;
