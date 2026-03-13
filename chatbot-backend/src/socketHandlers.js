const FlowExecutor             = require('./services/FlowExecutor');
const WhatsAppService          = require('./services/WhatsAppService');
const ConversationRepository   = require('./repositories/ConversationRepository');
const MessageRepository        = require('./repositories/MessageRepository');
const { CONVERSATION_STATUS, MESSAGE_SENDER } = require('./config/constants');

/**
 * Socket.IO Event Handlers
 * Handles all real-time events for:
 *   - Admin live WhatsApp chat monitor
 *   - Human takeover of bot conversations
 */
module.exports = (io) => {
    const conversationRepo = new ConversationRepository();
    const messageRepo      = new MessageRepository();
    const flowExecutor     = new FlowExecutor();

    io.on('connection', (socket) => {
        global.slashLogs(`[Socket.IO] Admin connected: ${socket.id}`, true, true);

        //LIVE MONITOR Admin joins a "room" for a specific flow to receive all live messages
        
        // Admin subscribes to all live conversations for a given flow.
        // On join, we also send the current list of active/takeover conversations
        // so the admin panel can populate immediately without a separate REST call.
        socket.on('admin:join_live', async ({ flowId }) => {
            try {
                socket.join(`admin:live:${flowId}`);
                global.slashLogs(`[Socket.IO] Admin ${socket.id} joined live room for flow: ${flowId}`, true, true);

                // Load current active conversations so panel populates immediately
                const activeConversations = await conversationRepo.getActiveByFlow(flowId);

                socket.emit('admin:joined', {
                    flowId,
                    activeConversations,
                });
            } catch (error) {
                global.slashLogs(`[Socket.IO] Error in admin:join_live: ${error.message}`, true, true);
                socket.emit('admin:error', { message: 'Failed to join live room', details: error.message });
            }
        });

        // HUMAN TAKEOVER Admin takes over a conversation from the bot
        
        /**
         * admin:takeover
         * Admin clicks "Take Over" on a conversation.
         * Sets conversation status to HUMAN_TAKEOVER, joins a private room,
         * and sends back the full chat history.
         *
         * Payload:  { conversationId: string }
         * Response: admin:takeover_confirmed → { conversationId, customerPhone, customerName, chatHistory }
         */
        socket.on('admin:takeover', async ({ conversationId }) => {
            try {
                global.slashLogs(`[Socket.IO] Admin ${socket.id} taking over conversation: ${conversationId}`, true, true);

                // Verify conversation exists
                const conversation = await conversationRepo.findById(conversationId);
                if (!conversation) {
                    return socket.emit('admin:error', { message: 'Conversation not found', conversationId });
                }

                // Update status to HUMAN_TAKEOVER
                await flowExecutor.handleHumanTakeover(conversationId);

                // Admin joins a private room for this specific conversation
                socket.join(`admin:takeover:${conversationId}`);

                // Load full chat history from DB
                const chatHistory = await messageRepo.getByConversation(conversationId);

                global.slashLogs(`[Socket.IO] Takeover confirmed for conversation: ${conversationId}`, true, true);

                socket.emit('admin:takeover_confirmed', {
                    conversationId,
                    customerPhone: conversation.user_phone,
                    customerName:  conversation.user_name,
                    chatHistory,
                });

                // Notify other admins in the live room that this convo is now taken over
                socket.to(`admin:live:${conversation.flow_id}`).emit('admin:conversation_status_changed', {
                    conversationId,
                    status: CONVERSATION_STATUS.HUMAN_TAKEOVER,
                });

            } catch (error) {
                global.slashLogs(`[Socket.IO] Error in admin:takeover: ${error.message}`, true, true);
                socket.emit('admin:error', { message: 'Failed to take over conversation', details: error.message });
            }
        });

        /**
         * admin:send_message
         * Admin sends a message to the customer during takeover.
         * The message is sent via WhatsApp API and saved to DB with sender = "agent"
         */
        socket.on('admin:send_message', async ({ conversationId, text }) => {
            try {
                if (!text || !text.trim()) {
                    return socket.emit('admin:error', { message: 'Message text is required' });
                }

                global.slashLogs(`[Socket.IO] Agent sending message to conversation: ${conversationId}`, true, true);

                // Get conversation details
                const conversation = await conversationRepo.findById(conversationId);
                if (!conversation) {
                    return socket.emit('admin:error', { message: 'Conversation not found', conversationId });
                }

                // Verify still in takeover mode
                if (conversation.status !== CONVERSATION_STATUS.HUMAN_TAKEOVER) {
                    return socket.emit('admin:error', { message: 'Conversation is not in takeover mode. Cannot send agent message.' });
                }

                // Send message to customer via WhatsApp API
                const whatsappService = new WhatsAppService(
                    process.env.WHATSAPP_ACCESS_TOKEN,
                    process.env.WHATSAPP_PHONE_NUMBER_ID
                );
                await whatsappService.sendTextMessage(conversation.user_phone, text.trim());

                // Save agent message to DB
                const savedMessage = await messageRepo.createMessage({
                    conversation_id: conversationId,
                    flow_id:         conversation.flow_id,
                    sender:          MESSAGE_SENDER.AGENT,
                    message_type:    'text',
                    message_text:    text.trim(),
                });

                const timestamp = new Date().toISOString();

                // Confirm to the sending admin
                socket.emit('admin:message_sent', {
                    conversationId,
                    text: text.trim(),
                    timestamp,
                    message: savedMessage,
                });

                global.slashLogs(`[Socket.IO] Agent message sent to ${conversation.user_phone}`, true, true);

            } catch (error) {
                global.slashLogs(`[Socket.IO] Error in admin:send_message: ${error.message}`, true, true);
                socket.emit('admin:error', { message: 'Failed to send message', details: error.message });
            }
        });

        /**
         * admin:handback
         * Admin returns control of the conversation back to the bot.
         * Conversation status is reset to ACTIVE.
         *
         * Payload:  { conversationId: string }
         * Response: admin:handback_confirmed → { conversationId }
         */
        socket.on('admin:handback', async ({ conversationId }) => {
            try {
                global.slashLogs(`[Socket.IO] Admin handing back conversation: ${conversationId}`, true, true);

                const conversation = await conversationRepo.findById(conversationId);
                if (!conversation) {
                    return socket.emit('admin:error', { message: 'Conversation not found', conversationId });
                }

                // Reset status back to active so bot resumes
                await conversationRepo.updateStatus(conversationId, CONVERSATION_STATUS.ACTIVE);

                // Leave the private takeover room
                socket.leave(`admin:takeover:${conversationId}`);

                socket.emit('admin:handback_confirmed', { conversationId });

                // Notify other admins in the live room
                socket.to(`admin:live:${conversation.flow_id}`).emit('admin:conversation_status_changed', {
                    conversationId,
                    status: CONVERSATION_STATUS.ACTIVE,
                });

                global.slashLogs(`[Socket.IO] Bot resumed for conversation: ${conversationId}`, true, true);

            } catch (error) {
                global.slashLogs(`[Socket.IO] Error in admin:handback: ${error.message}`, true, true);
                socket.emit('admin:error', { message: 'Failed to handback conversation', details: error.message });
            }
        });

        // ──────────────────────────────────────────────────────────────────────
        // DISCONNECT
        // ──────────────────────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            global.slashLogs(`[Socket.IO] Admin disconnected: ${socket.id}. Reason: ${reason}`, true, true);
            // Socket.IO automatically removes the socket from all rooms on disconnect
        });
    });
};
