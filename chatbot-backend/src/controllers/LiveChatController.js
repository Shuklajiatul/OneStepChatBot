const ConversationRepository  = require('../repositories/ConversationRepository');
const MessageRepository       = require('../repositories/MessageRepository');
const FlowExecutor            = require('../services/FlowExecutor');
const WhatsAppService         = require('../services/WhatsAppService');
const { CONVERSATION_STATUS, MESSAGE_SENDER } = require('../config/constants');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Live Chat Controller
 * These endpoints are used on page load / refresh to hydrate the UI from DB.
 * Real-time updates are delivered separately via Socket.IO (socketHandlers.js).
 */
class LiveChatController {
    constructor() {
        this.conversationRepo = new ConversationRepository();
        this.messageRepo      = new MessageRepository();
        this.flowExecutor     = new FlowExecutor();
    }

    /**
     * Returns all active (and optionally human_takeover) conversations for a flow.
     * Called on page load so the admin panel populates even without Socket.IO history.
     */
    async getConversations(req, res) {
        const { flowId, status } = req.query;

        if (!flowId) {
            throw new ValidationError('flowId query parameter is required');
        }

        let conversations;
        if (status) {
            conversations = await this.conversationRepo.getConversationsByStatus(status);
            conversations = conversations.filter(c => c.flow_id?.toString() === flowId);
        } else {
            conversations = await this.conversationRepo.getActiveByFlow(flowId);
        }

        res.json({ success: true, conversations });
    }

    /**
     * Returns full message history for one conversation.
     * Called when admin clicks on a conversation (or on page refresh).
     * This is the KEY endpoint that solves the "messages disappear on refresh" problem.
     */
    async getMessages(req, res) {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 200;

        const conversation = await this.conversationRepo.findById(id);
        if (!conversation) {
            throw new NotFoundError('Conversation', id);
        }

        const messages = await this.messageRepo.getByConversation(id, limit);

        res.json({
            success: true,
            conversation: {
                id: conversation.conversation_id,
                status: conversation.status,
                user_phone: conversation.user_phone,
                user_name: conversation.user_name,
                flow_id: conversation.flow_id,
                started_at: conversation.started_at,
                last_message_at: conversation.last_message_at,
            },
            messages,
        });
    }

    /**
     * fallback to trigger human takeover (in case Socket.IO is not available).
     */
    async takeover(req, res) {
        const { id } = req.params;

        const conversation = await this.conversationRepo.findById(id);
        if (!conversation) {
            throw new NotFoundError('Conversation', id);
        }

        await this.flowExecutor.handleHumanTakeover(id);

        // Notify admin dashboard via Socket.IO if connected
        if (global.io) {
            global.io
                .to(`admin:live:${conversation.flow_id}`)
                .emit('admin:conversation_status_changed', {
                    conversationId: id,
                    status: CONVERSATION_STATUS.HUMAN_TAKEOVER,
                });
        }

        const chatHistory = await this.messageRepo.getByConversation(id);

        res.json({
            success: true,
            conversationId: id,
            customerPhone: conversation.user_phone,
            customerName: conversation.user_name,
            chatHistory,
        });
    }

    /**
     * fallback to hand control back to the bot.
     */
    async handback(req, res) {
        const { id } = req.params;

        const conversation = await this.conversationRepo.findById(id);
        if (!conversation) {
            throw new NotFoundError('Conversation', id);
        }

        await this.conversationRepo.updateStatus(id, CONVERSATION_STATUS.ACTIVE);

        // Notify admin dashboard via Socket.IO
        if (global.io) {
            global.io
                .to(`admin:live:${conversation.flow_id}`)
                .emit('admin:conversation_status_changed', {
                    conversationId: id,
                    status: CONVERSATION_STATUS.ACTIVE,
                });
        }

        res.json({ success: true, conversationId: id, message: 'Bot has resumed control' });
    }

    /**
     * fallback for agent to send a message when Socket.IO is unavailable.
     */
    async sendAgentMessage(req, res) {
        const { id } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            throw new ValidationError('Message text is required');
        }

        const conversation = await this.conversationRepo.findById(id);
        if (!conversation) {
            throw new NotFoundError('Conversation', id);
        }

        if (conversation.status !== CONVERSATION_STATUS.HUMAN_TAKEOVER) {
            throw new ValidationError('Conversation is not in takeover mode');
        }

        // Send via WhatsApp API
        const whatsappService = new WhatsAppService(
            process.env.WHATSAPP_ACCESS_TOKEN,
            process.env.WHATSAPP_PHONE_NUMBER_ID
        );
        await whatsappService.sendTextMessage(conversation.user_phone, text.trim());

        // Save to DB
        const savedMessage = await this.messageRepo.createMessage({
            conversation_id: id,
            flow_id:         conversation.flow_id,
            sender:          MESSAGE_SENDER.AGENT,
            message_type:    'text',
            message_text:    text.trim(),
        });

        // Broadcast to admin socket room
        if (global.io) {
            global.io
                .to(`admin:takeover:${id}`)
                .emit('admin:message_sent', {
                    conversationId: id,
                    text: text.trim(),
                    timestamp: new Date().toISOString(),
                    message: savedMessage,
                });
        }

        res.json({ success: true, message: savedMessage });
    }
}

module.exports = LiveChatController;
