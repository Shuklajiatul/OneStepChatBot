const FlowExecutor             = require('./services/FlowExecutor');
const WhatsAppService          = require('./services/WhatsAppService');
const ConversationRepository   = require('./repositories/ConversationRepository');
const MessageRepository        = require('./repositories/MessageRepository');
const { CONVERSATION_STATUS, MESSAGE_SENDER } = require('./config/constants');

/**
 * Socket.IO Event Handlers
 * Handles all real-time events for: Admin live WhatsApp chat monitor and  Human takeover of bot conversations
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

        
        // TALK-TO-AGENT (Flow-triggered agent requests)
        /**
         * admin:accept_agent_request
         * First admin to emit this wins — the conversation status is atomically
         * updated from PENDING_AGENT → HUMAN_TAKEOVER. Any subsequent accept for
         * the same conversationId is rejected with an error.
         */

        socket.on('admin:accept_agent_request', async ({ conversationId }) => {
            try {
                global.slashLogs(`[Socket.IO] Admin ${socket.id} accepting agent request: ${conversationId}`, true, true);

                const conversation = await conversationRepo.findById(conversationId);
                if (!conversation) {
                    return socket.emit('admin:error', { message: 'Conversation not found', conversationId });
                }

                // ── First-accept lock ──
                // If another admin already accepted (status changed), reject this one
                if (conversation.status !== CONVERSATION_STATUS.PENDING_AGENT) {
                    return socket.emit('admin:error', {
                        message: 'This request has already been accepted or expired.',
                        conversationId,
                    });
                }

                // Cancel the pending timeout timer
                const timer = global.pendingAgentTimers.get(conversationId);
                if (timer) {
                    clearTimeout(timer.timerId);
                    global.pendingAgentTimers.delete(conversationId);
                    global.slashLogs(`[Socket.IO] Timeout cancelled for conversation: ${conversationId}`, true, true);
                }

                // Atomically upgrade status to HUMAN_TAKEOVER
                await conversationRepo.updateStatus(conversationId, CONVERSATION_STATUS.HUMAN_TAKEOVER);

                // Admin joins private takeover room
                socket.join(`admin:takeover:${conversationId}`);

                // Load full chat history from DB
                const chatHistory = await messageRepo.getByConversation(conversationId);

                // Confirm to the accepting admin
                socket.emit('admin:takeover_confirmed', {
                    conversationId,
                    customerPhone: conversation.user_phone,
                    customerName:  conversation.user_name,
                    chatHistory,
                });

                // Notify ALL other admins: request is gone, conversation is now in takeover
                socket.to(`admin:live:${conversation.flow_id}`).emit('admin:agent_request_accepted', {
                    conversationId,
                    acceptedBySocketId: socket.id,
                });
                socket.to(`admin:live:${conversation.flow_id}`).emit('admin:conversation_status_changed', {
                    conversationId,
                    status: CONVERSATION_STATUS.HUMAN_TAKEOVER,
                });

                global.slashLogs(`[Socket.IO] Agent request accepted for conversation: ${conversationId}`, true, true);

            } catch (error) {
                global.slashLogs(`[Socket.IO] Error in admin:accept_agent_request: ${error.message}`, true, true);
                socket.emit('admin:error', { message: 'Failed to accept agent request', details: error.message });
            }
        });

        /**
         * admin:reject_agent_request
         * Admin declines the agent request. The timeout message is sent immediately
         * to the customer, the pending timer is cancelled, and the fallback node
         * (if defined) is executed by the bot.
         */
        socket.on('admin:reject_agent_request', async ({ conversationId }) => {
            try {
                global.slashLogs(`[Socket.IO] Admin ${socket.id} rejecting agent request: ${conversationId}`, true, true);

                const conversation = await conversationRepo.findById(conversationId);
                if (!conversation) {
                    return socket.emit('admin:error', { message: 'Conversation not found', conversationId });
                }

                if (conversation.status !== CONVERSATION_STATUS.PENDING_AGENT) {
                    return socket.emit('admin:error', {
                        message: 'Conversation is not in pending_agent state.',
                        conversationId,
                    });
                }

                // Cancel the running timeout timer
                const timer = global.pendingAgentTimers.get(conversationId);
                if (timer) {
                    clearTimeout(timer.timerId);
                    global.pendingAgentTimers.delete(conversationId);
                }

                // Load fallbackNodeId from session_data (stored by NodeProcessor)
                const sessionData = conversation.session_data
                    ? (typeof conversation.session_data === 'string'
                        ? JSON.parse(conversation.session_data)
                        : conversation.session_data)
                    : {};
                const fallbackNodeId = sessionData.__pendingAgentFallbackNodeId || null;

                const WhatsAppService = require('./services/WhatsAppService');
                const whatsappService = new WhatsAppService(
                    process.env.WHATSAPP_ACCESS_TOKEN,
                    process.env.WHATSAPP_PHONE_NUMBER_ID
                );
                const rejectMessage = 'Sorry, all agents are busy right now. Please try again later.';

                await whatsappService.sendTextMessage(conversation.user_phone, rejectMessage);
                await messageRepo.createMessage({
                    conversation_id: conversationId,
                    flow_id:         conversation.flow_id,
                    sender:          'bot',
                    message_type:    'text',
                    message_text:    rejectMessage,
                });

                if (fallbackNodeId) {
                    await conversationRepo.updateStatus(conversationId, CONVERSATION_STATUS.ACTIVE);
                    await conversationRepo.updateCurrentNode(conversationId, fallbackNodeId);

                    // Trigger the bot to continue from the fallback node
                    const FlowExecutor = require('./services/FlowExecutor');
                    const freshConvo   = await conversationRepo.findById(conversationId);
                    const executor     = new FlowExecutor();
                    await executor.executeFlow(
                        { ...freshConvo, status: CONVERSATION_STATUS.ACTIVE, current_node_id: fallbackNodeId },
                        conversation.flow_id,
                        null
                    );
                } else {
                    await conversationRepo.completeConversation(conversationId);
                }

                socket.emit('admin:agent_request_rejected', { conversationId });
                socket.to(`admin:live:${conversation.flow_id}`).emit('admin:agent_request_rejected', { conversationId });
                socket.to(`admin:live:${conversation.flow_id}`).emit('admin:conversation_status_changed', {
                    conversationId,
                    status: fallbackNodeId ? CONVERSATION_STATUS.ACTIVE : CONVERSATION_STATUS.COMPLETED,
                });

                // If no fallback, the conversation ended — tell the frontend to remove the card
                if (!fallbackNodeId) {
                    socket.emit('admin:conversation_completed', { conversationId, status: 'completed' });
                    socket.to(`admin:live:${conversation.flow_id}`).emit('admin:conversation_completed', { conversationId, status: 'completed' });
                }

                global.slashLogs(`[Socket.IO] Agent request rejected for conversation: ${conversationId}`, true, true);

            } catch (error) {
                global.slashLogs(`[Socket.IO] Error in admin:reject_agent_request: ${error.message}`, true, true);
                socket.emit('admin:error', { message: 'Failed to reject agent request', details: error.message });
            }
        });

        // DISCONNECT

        socket.on('disconnect', (reason) => {
            global.slashLogs(`[Socket.IO] Admin disconnected: ${socket.id}. Reason: ${reason}`, true, true);
            // Socket.IO automatically removes the socket from all rooms on disconnect
        });
    });
};
