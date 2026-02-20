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

            global.slashLogs(`List message sent ${to} for messageId: ${response.messages?.[0]?.id}`, true, true);
            return response;
        } catch (error) {
            global.slashLogs(`Failed to send list message ${to} for error: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Send an image message
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

            global.slashLogs(`Image message sent ${to} for messageId: ${response.messages?.[0]?.id}`, true, true);
            return response;
        } catch (error) {
            global.slashLogs(`Failed to send image message ${to} for error: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Send a document message
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

            global.slashLogs(`Document message sent ${to} for messageId: ${response.messages?.[0]?.id}`, true, true);
            return response;
        } catch (error) {
            global.slashLogs(`Failed to send document message ${to} for error: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Mark message as read
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
            global.slashLogs(`Failed to mark message as read ${messageId} for error: ${error.message}`, true, true);
            // Don't throw, this is not critical
        }
    }

    /**
     * Make API request to WhatsApp
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
