const axios = require('axios');
const logger = require('../config/logger');
const { retryWithBackoff } = require('../utils/helpers');
const { ExternalAPIError } = require('../utils/errors');

//   Handles external webhook calls with retry logic

class WebhookService {
    // Call a webhook
    static async callWebhook(webhookConfig, conversation, additionalData = {}) {
        const { url, method = 'POST', headers = {}, body = {}, params = {}, path_variables = {} } = webhookConfig;

        const resolvedUrl = Object.keys(path_variables).length > 0
            ? Object.entries(path_variables).reduce(
                (acc, [key, value]) => acc.replace(`:${key}`, encodeURIComponent(value)),
                url
              )
            : url;

        try {
            global.slashLogs(`Calling webhook ${resolvedUrl}: ${JSON.stringify({ webhookConfig, conversation, additionalData })}`, true, true);
            global.slashLogs(`Webhook body: ${JSON.stringify({ ...body, ...additionalData })}`, true, true);

            const response = await retryWithBackoff(
                async () => {
                    return await axios({
                        method,
                        url: resolvedUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        data: method !== 'GET' ? { ...body, ...additionalData } : undefined,
                        params: Object.keys(params).length > 0 ? params : undefined,
                        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '30000', 10),
                        validateStatus: (status) => status >= 200 && status < 300,
                    });
                },
                parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10)
            );

            global.slashLogs(`Webhook call successful ${resolvedUrl}`, true, true);

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

    // Call webhook with conversation context
    static async callWithContext(webhookConfig, conversation, collectedData = {}) {
        const contextData = {
            conversation_id: conversation.conversation_id,
            flow_id: conversation.flow_id,
            user_phone: conversation.user_phone,
            user_name: conversation.user_name,
            channel: conversation.channel,
            // collected_data: collectedData,
            field_values: collectedData,
            started_at: conversation.started_at,
        };

        return this.callWebhook(webhookConfig, conversation, contextData);
    }

    // Validate webhook configuration
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

    // Test webhook connection
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
