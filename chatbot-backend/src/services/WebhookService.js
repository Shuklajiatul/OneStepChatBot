const axios = require('axios');
const logger = require('../config/logger');
const { retryWithBackoff } = require('../utils/helpers');
const { ExternalAPIError } = require('../utils/errors');

/**
 * Webhook Service
 * Handles external webhook calls with retry logic
 */
class WebhookService {
    /**
     * Call a webhook
     * @param {Object} webhookConfig - Webhook configuration
     * @param {Object} conversation - Conversation object
     * @param {Object} additionalData - Additional data to send
     * @returns {Promise<Object>} Webhook response
     */
    static async callWebhook(webhookConfig, conversation, additionalData = {}) {
        const { url, method = 'POST', headers = {}, body = {} } = webhookConfig;

        try {
            global.slashLogs(`Calling webhook ${url}`, true, true);

            const response = await retryWithBackoff(
                async () => {
                    return await axios({
                        method,
                        url,
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        data: method !== 'GET' ? { ...body, ...additionalData } : undefined,
                        params: method === 'GET' ? { ...body, ...additionalData } : undefined,
                        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '30000', 10),
                        validateStatus: (status) => status >= 200 && status < 300,
                    });
                },
                parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10)
            );

            global.slashLogs(`Webhook call successful ${url}`, true, true);

            return {
                success: true,
                status: response.status,
                data: response.data,
                headers: response.headers,
            };
        } catch (error) {
            global.slashLogs(`Webhook call failed ${url}`, true, true);

            throw new ExternalAPIError('Webhook', error.message, error.response?.status);
        }
    }

    /**
     * Call webhook with conversation context
     * @param {Object} webhookConfig - Webhook configuration
     * @param {Object} conversation - Conversation object
     * @param {Object} collectedData - Collected data from conversation
     * @returns {Promise<Object>} Webhook response
     */
    static async callWithContext(webhookConfig, conversation, collectedData = {}) {
        const contextData = {
            conversation_id: conversation.conversation_id,
            flow_id: conversation.flow_id,
            user_phone: conversation.user_phone,
            user_name: conversation.user_name,
            channel: conversation.channel,
            collected_data: collectedData,
            started_at: conversation.started_at,
        };

        return this.callWebhook(webhookConfig, conversation, contextData);
    }

    /**
     * Validate webhook configuration
     * @param {Object} webhookConfig - Webhook configuration
     * @returns {Object} {isValid, errors}
     */
    static validateConfig(webhookConfig) {
        const errors = [];

        if (!webhookConfig.url) {
            errors.push('Webhook URL is required');
        } else {
            try {
                new URL(webhookConfig.url);
            } catch (error) {
                errors.push('Invalid webhook URL');
            }
        }

        if (webhookConfig.method) {
            const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
            if (!validMethods.includes(webhookConfig.method.toUpperCase())) {
                errors.push(`Invalid HTTP method: ${webhookConfig.method}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Test webhook connection
     * @param {string} url - Webhook URL
     * @param {string} method - HTTP method
     * @returns {Promise<boolean>} True if webhook is reachable
     */
    static async testConnection(url, method = 'POST') {
        try {
            const response = await axios({
                method,
                url,
                timeout: 5000,
                validateStatus: () => true, // Accept any status
            });

            return response.status < 500;
        } catch (error) {
            global.slashLogs(`Webhook connection test failed ${url}`, true, true);
            return false;
        }
    }
}

module.exports = WebhookService;
