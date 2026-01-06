const axios = require('axios');
const logger = require('../config/logger');
const { MESSAGE_TYPES } = require('../config/constants');
const { ExternalAPIError } = require('../utils/errors');

/**
 * WhatsApp Service
 * Handles WhatsApp Business API integration
 */
class WhatsAppService {
    constructor(apiKey, phoneNumberId) {
        this.apiKey = apiKey;
        this.phoneNumberId = phoneNumberId;
        this.baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    }

    /**
     * Send a text message
     * param to - Recipient phone number
     * param text - Message text
     * returns API response
     */
    async sendTextMessage(to, text) {
        try {
            const response = await this.makeRequest('POST', `/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: { body: text },
            });

            global.slashLogs(`Text message sent: ${to} for messageId: ${response.messages?.[0]?.id}`, true, true);
            return response;
        } catch (error) {
            global.slashLogs(`Failed to send text message: ${to} for error: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Send an interactive button message
     * param {string} to - Recipient phone number
     * param {string} bodyText - Message body text
     * param {Array} buttons - Array of button objects {id, title}
     * returns {Promise<Object>} API response
     */
    async sendButtonMessage(to, bodyText, buttons) {
        try {
            if (buttons.length > 3) {
                throw new Error('WhatsApp supports maximum 3 buttons');
            }

            const formattedButtons = buttons.map((btn) => ({
                type: 'reply',
                reply: {
                    id: btn.id,
                    title: btn.title.substring(0, 20), // Max 20 characters
                },
            }));

            const response = await this.makeRequest('POST', `/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: bodyText },
                    action: {
                        buttons: formattedButtons,
                    },
                },
            });

            global.slashLogs(`Button message sent: ${to} for messageId: ${response.messages?.[0]?.id}`, true, true);
            return response;
        } catch (error) {
            global.slashLogs(`Failed to send button message: ${to} for error: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Send an interactive list message
     *  to - Recipient phone number
     *  bodyText - Message body text
     *  buttonText - List button text
     *  sections - Array of section objects
     *  API response
     */
    async sendListMessage(to, bodyText, buttonText, sections) {
        try {
            const formattedSections = sections.map((section) => ({
                title: section.title,
                rows: section.rows.map((row) => ({
                    id: row.id,
                    title: row.title.substring(0, 24), // Max 24 characters
                    description: row.description?.substring(0, 72) || '', // Max 72 characters
                })),
            }));

            const response = await this.makeRequest('POST', `/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: bodyText },
                    action: {
                        button: buttonText.substring(0, 20), // Max 20 characters
                        sections: formattedSections,
                    },
                },
            });

            logger.info('List message sent', { to, messageId: response.messages?.[0]?.id });
            return response;
        } catch (error) {
            logger.error('Failed to send list message', { error: error.message, to });
            throw error;
        }
    }

    /**
     * Send an image message
     * param {string} to - Recipient phone number
     * param {string} imageUrl - Image URL
     * param {string} caption - Optional caption
     * returns {Promise<Object>} API response
     */
    async sendImageMessage(to, imageUrl, caption = '') {
        try {
            const response = await this.makeRequest('POST', `/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'image',
                image: {
                    link: imageUrl,
                    caption,
                },
            });

            logger.info('Image message sent', { to, messageId: response.messages?.[0]?.id });
            return response;
        } catch (error) {
            logger.error('Failed to send image message', { error: error.message, to });
            throw error;
        }
    }

    /**
     * Send a document message
     * to - Recipient phone number
     * documentUrl - Document URL
     * filename - Filename
     * caption - Optional caption
     * returns API response
     */
    async sendDocumentMessage(to, documentUrl, filename, caption = '') {
        try {
            const response = await this.makeRequest('POST', `/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'document',
                document: {
                    link: documentUrl,
                    filename,
                    caption,
                },
            });

            logger.info('Document message sent', { to, messageId: response.messages?.[0]?.id });
            return response;
        } catch (error) {
            logger.error('Failed to send document message', { error: error.message, to });
            throw error;
        }
    }

    /**
     * Mark message as read
     *  {string} messageId - Message ID to mark as read
     *  {Promise<Object>} API response
     */
    async markAsRead(messageId) {
        try {
            const response = await this.makeRequest('POST', `/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            });

            return response;
        } catch (error) {
            logger.error('Failed to mark message as read', { error: error.message, messageId });
            // Don't throw, this is not critical
        }
    }

    /**
     * Make API request to WhatsApp
     * param {string} method - HTTP method
     * param {string} endpoint - API endpoint
     * param {Object} data - Request data
     * returns {Promise<Object>} API response
     * private
     */
    async makeRequest(method, endpoint, data) {
        try {
            const url = `${this.baseUrl}/${this.phoneNumberId}${endpoint}`;

            const response = await axios({
                method,
                url,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                data,
            });

            return response.data;
        } catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message;
            const errorCode = error.response?.data?.error?.code;

            global.slashLogs(`WhatsApp API error: ${errorMessage} for code: ${errorCode} and endpoint: ${endpoint}`, true, true);

            throw new ExternalAPIError('WhatsApp', errorMessage, error.response?.status);
        }
    }

    /**
     * Verify webhook signature
     */
    static verifyWebhookSignature(signature, body, appSecret) {
        const crypto = require('crypto');

        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', appSecret)
            .update(body)
            .digest('hex');

        return signature === expectedSignature;
    }

    /**
     * Parse incoming webhook message
     */
    static parseIncomingMessage(webhookData) {
        try {
            global.slashLogs('Incoming webhook message parsing', true, true);
            const entry = webhookData.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;

            if (!value?.messages || value.messages.length === 0) {
                return null;
            }

            const message = value.messages[0];
            const contact = value.contacts?.[0];

            return {
                messageId    : message.id,
                from         : message.from,
                name         : contact?.profile?.name || '',
                timestamp    : new Date(parseInt(message.timestamp, 10) * 1000),
                type         : message.type,
                text         : message.text?.body || '',
                interactive  : message.interactive,
                image        : message.image,
                video        : message.video,
                audio        : message.audio,
                document     : message.document,
                location     : message.location,
                contacts     : message.contacts,
            };
        } catch (error) {
            global.slashLogs('Error parsing incoming message', true, true);
            return null;
        }
    }

    /**
     * Parse status update
     * webhookData - Webhook payload
     * Parsed status data
     */
    static parseStatusUpdate(webhookData) {
        try {
            const entry = webhookData.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;

            if (!value?.statuses || value.statuses.length === 0) {
                return null;
            }

            const status = value.statuses[0];

            return {
                messageId: status.id,
                status: status.status, // sent, delivered, read, failed
                timestamp: new Date(parseInt(status.timestamp, 10) * 1000),
                recipientId: status.recipient_id,
                errors: status.errors,
            };
        } catch (error) {
            global.slashLogs('Error parsing status update', true, true);
            return null;
        }
    }
}

module.exports = WhatsAppService;
