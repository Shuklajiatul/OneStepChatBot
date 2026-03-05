const logger = require('../config/logger');
const { parseSessionData, getSessionVariable } = require('../models/Conversation');
const { safeJSONParse } = require('../utils/helpers');

/**
 * Variable Resolver Service
 * Resolves variable placeholders in messages
 */
class VariableResolver {
    // Replace variables in text
    static resolve(text, conversation, additionalData = {}) {
        if (!text || typeof text !== 'string') {
            return text;
        }

        const sessionData = parseSessionData(conversation);
        global.slashLogs(`Session Data: ${JSON.stringify(sessionData)}`, true, true);
        // Expose session data under the 'session' key so that {{session.xxx}} paths resolve correctly.
        // Both {{user_name}} and {{session.user_name}} will work.
        // old logic ::  const allData = { ...sessionData, ...additionalData };
        const allData = { ...sessionData, ...additionalData, session: { ...sessionData, ...additionalData } };

        // Find all {{variable}} patterns
        const variablePattern = /\{\{([^}]+)\}\}/g;

        return text.replace(variablePattern, (match, variablePath) => {
            const trimmedPath = variablePath.trim();
            const value = this.getNestedValue(allData, trimmedPath);

            if (value === null || value === undefined) {
                global.slashLogs(`Variable not found: ${trimmedPath}`, true, true);
                return match; // Keep original placeholder if not found
            }

            return String(value);
        });
    }

    // Get nested value from object using dot notation
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

    // Extract all variable names from text
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

    // Check if text contains variables
    static hasVariables(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }

        return /\{\{([^}]+)\}\}/.test(text);
    }

    // Resolve variables in an object (recursively)
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
