const logger = require('../config/logger');

/**
 * Preview Service
 */
class PreviewService {
    constructor() {
        // Store messages in memory for this preview session
        this.messages = [];
    }

    /**
     * Send a text message (simulated)
     */
    async sendTextMessage(to, text) {
        global.slashLogs(`[PREVIEW] Sending text message: ${text}`, true, true);

        const message = {
            type: 'text',
            text,
            timestamp: new Date().toISOString(),
        };

        this.messages.push(message);

        return {
            success: true,
            message_id: `preview_msg_${Date.now()}`,
        };
    }

    /**
     * Send a button message (simulated)
     */
    async sendButtonMessage(to, text, buttons) {
        global.slashLogs(`[PREVIEW] Sending button message with ${buttons.length} buttons`, true, true);

        const message = {
            type: 'interactive',
            subtype: 'button',
            text,
            buttons,
            timestamp: new Date().toISOString(),
        };

        this.messages.push(message);

        return {
            success: true,
            message_id: `preview_msg_${Date.now()}`,
        };
    }

    /**
     * Send a list message (simulated)
     */
    async sendListMessage(to, text, buttonText, sections) {
        global.slashLogs(`[PREVIEW] Sending list message with ${sections.length} sections`, true, true);

        const message = {
            type: 'interactive',
            subtype: 'list',
            text,
            buttonText,
            sections,
            timestamp: new Date().toISOString(),
        };

        this.messages.push(message);

        return {
            success: true,
            message_id: `preview_msg_${Date.now()}`,
        };
    }

    /**
     * Send an image message (simulated)
     * Recipient phone number (ignored in preview)
     */
    async sendImageMessage(to, imageUrl, caption = '') {
        global.slashLogs(`[PREVIEW] Sending image message: ${imageUrl}`, true, true);

        const message = {
            type: 'image',
            imageUrl,
            caption,
            timestamp: new Date().toISOString(),
        };

        this.messages.push(message);

        return {
            success: true,
            message_id: `preview_msg_${Date.now()}`,
        };
    }

    /**
    * Send a document message (simulated)
    */
    async sendDocumentMessage(to, documentUrl, filename, caption = '') {
        global.slashLogs(`[PREVIEW] Sending document message: ${filename}`, true, true);

        const message = {
            type: 'document',
            documentUrl,
            filename,
            caption,
            timestamp: new Date().toISOString(),
        };

        this.messages.push(message);

        return {
            success: true,
            message_id: `preview_msg_${Date.now()}`,
        };
    }

    /**
     * Get all messages sent in this preview session
     * returns
     */
    getMessages() {
        return this.messages;
    }

    /**
     * Clear all messages (for reset functionality)
     */
    clearMessages() {
        this.messages = [];
    }
}

module.exports = PreviewService;
