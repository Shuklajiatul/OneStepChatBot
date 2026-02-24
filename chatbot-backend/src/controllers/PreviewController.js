const FlowRepository           = require('../repositories/FlowRepository');
const ConversationRepository   = require('../repositories/ConversationRepository');
const MessageRepository        = require('../repositories/MessageRepository');
const CollectedDataRepository  = require('../repositories/CollectedDataRepository');
const FlowExecutor             = require('../services/FlowExecutor');
const PreviewService           = require('../services/PreviewService');
const {stringify}              = require('uuid')
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');
const { CONVERSATION_STATUS, CHANNELS } = require('../config/constants');

/**
 * Preview Controller
 * Handles preview of chat flows
 */
class PreviewController {
    constructor() {
        this.flowRepository = new FlowRepository();
        this.conversationRepository = new ConversationRepository();
        this.messageRepository = new MessageRepository();
        this.collectedDataRepository = new CollectedDataRepository();
        this.flowExecutor = new FlowExecutor();
        
        // Store preview services by session ID
        this.previewSessions = new Map();
    }

    /**
     * Start a new preview session
     */
    async startPreview(req, res) {
        try {
            const { flow_id} = req.body;
            const userId = req.user.id || "d065df86-708c-46b3-999d-68e0e2e43643";
            
            global.slashLogs(`Starting preview session for flow: ${flow_id}`, true, true);

            // Get flow and verify ownership
            const flow = await this.flowRepository.findById(flow_id);
            if (!flow) {
                throw new NotFoundError('Flow', flow_id);
            }

            // Convert Uuid object to string
            const flowUserId = stringify(flow.user_id.buffer);

            if (flowUserId !== userId) {
                global.slashLogs(`User ${userId} does not have access to flow ${flow_id}`, true, true);
                throw new AuthorizationError('You do not have access to this flow');
            }

            // Create preview service instance
            const previewService = new PreviewService();

            // Parse flow data if it's a string
            const flowData = typeof flow.flow_data === 'string' ? JSON.parse(flow.flow_data) : flow.flow_data;

            // Determine start node: look for 'start' or use the first node
            const startNodeId = flowData.nodes.find(n => n.id === 'start')?.id || flowData.nodes[0]?.id;

            // Create a preview conversation
            const conversationData = {
                flow_id: flow_id,
                user_phone: `preview_${Date.now()}`,
                user_name: 'Preview User',
                platform_user_id: userId, // Must be a valid UUID for ScyllaDB
                current_node_id: startNodeId, 
                channel: CHANNELS.PREVIEW,
                status: CONVERSATION_STATUS.ACTIVE,
            };
            
            global.slashLogs(`Creating conversation with data: ${JSON.stringify(conversationData)}`, true, true);
            const conversation = await this.conversationRepository.createConversation(conversationData);

            // Store preview service for this session
            this.previewSessions.set(conversation.conversation_id, previewService);

            // Execute flow from start (this will send initial messages)
            await this.flowExecutor.executeFlow(
                conversation,
                flow_id,
                null,
                true, // isPreview flag
                previewService
            );

            // Get all messages sent during initialization
            const messages = await this.messageRepository.getByConversation(conversation.conversation_id);

            global.slashLogs(`Preview session started: ${conversation.conversation_id}`, true, true);

            res.status(201).json({
                success: true,
                session_id: conversation.conversation_id,
                messages: messages,
                conversation_status: conversation.status,
                current_node_id: conversation.current_node_id,
            });
        } catch (error) {
            global.slashLogs(`Error in startPreview: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Send a message in preview mode
     */
    async sendMessage(req, res) {
        try {
            const { sessionId } = req.params;
            const { message, type, interactive } = req.body;
            const userId = req.user.id;

            global.slashLogs(`Preview message received for session: ${sessionId}`, true, true);

            // Get conversation
            const conversation = await this.conversationRepository.findById(sessionId);
            if (!conversation) {
                throw new NotFoundError('Preview session', sessionId);
            }

            // Verify it's a preview conversation
            if (conversation.channel !== CHANNELS.PREVIEW) {
                throw new ValidationError('Invalid preview session');
            }

            // Verify ownership
            const flow = await this.flowRepository.findById(conversation.flow_id);
            // if (flow.user_id !== userId) {
            //     throw new AuthorizationError('You do not have access to this preview session');
            // }

            // Get or create preview service for this session
            let previewService = this.previewSessions.get(sessionId);
            if (!previewService) {
                previewService = new PreviewService();
                this.previewSessions.set(sessionId, previewService);
            }

            // Clear preview service messages before processing
            previewService.clearMessages();

            // Extract user input based on message type (similar to WhatsApp webhook handling)
            global.slashLogs(`Request payload - type: ${type}, message: ${message}, interactive: ${JSON.stringify(interactive)}`, true, true);
            
            let userInput = null;
            if (type === 'text' || !type) {
                // Regular text message
                userInput = message;
            } else if (type === 'interactive') {
                // Button or list selection - extract the ID
                userInput = interactive?.button_reply?.id || interactive?.list_reply?.id || message;
                global.slashLogs(`Interactive response detected: ${userInput}`, true, true);
            }

            global.slashLogs(`Final userInput to be processed: ${userInput}`, true, true);

            // Process message through flow executor
            await this.flowExecutor.processMessage(
                conversation.flow_id,
                conversation.user_phone,
                conversation.user_name,
                userInput || message,
                conversation.platform_user_id,
                CHANNELS.PREVIEW,
                true, // isPreview flag
                previewService
            );

            // Get updated conversation state
            const updatedConversation = await this.conversationRepository.findById(sessionId);

            // Get only the new messages (bot responses)
            const allMessages = await this.messageRepository.getByConversation(sessionId);
            const newNodesCount = previewService.getMessages().length;
            const newMessages = newNodesCount > 0 ? allMessages.slice(0, newNodesCount) : [];

            res.json({
                success: true,
                messages: newMessages,
                conversation_status: updatedConversation.status,
                current_node_id: updatedConversation.current_node_id,
            });
        } catch (error) {
            global.slashLogs(`Error in sendMessage: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Get all messages from a preview session
     */
    async getMessages(req, res) {
        try {
            const { sessionId } = req.params;
            const userId = req.user.id;

            global.slashLogs(`Fetching messages for preview session: ${sessionId}`, true, true);

            // Get conversation
            const conversation = await this.conversationRepository.findById(sessionId);
            if (!conversation) {
                throw new NotFoundError('Preview session', sessionId);
            }

            // Verify it's a preview conversation
            if (conversation.channel !== CHANNELS.PREVIEW) {
                throw new ValidationError('Invalid preview session');
            }

            // Verify ownership
            const flow = await this.flowRepository.findById(conversation.flow_id);
            // if (flow.user_id !== userId) {
            //     throw new AuthorizationError('You do not have access to this preview session');
            // }

            // Get all messages
            const messages = await this.messageRepository.getByConversation(sessionId);

            res.json({
                success: true,
                messages: messages,
                conversation_status: conversation.status,
                current_node_id: conversation.current_node_id,
            });
        } catch (error) {
            global.slashLogs(`Error in getMessages: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Reset a preview session (restart from beginning)
     */
    async resetPreview(req, res) {
        try {
            const { sessionId } = req.params;
            const userId = req.user.id;

            global.slashLogs(`Resetting preview session: ${sessionId}`, true, true);

            // Get conversation
            const conversation = await this.conversationRepository.findById(sessionId);
            if (!conversation) {
                throw new NotFoundError('Preview session', sessionId);
            }

            // Verify it's a preview conversation
            if (conversation.channel !== CHANNELS.PREVIEW) {
                throw new ValidationError('Invalid preview session');
            }

            // Verify ownership
            const flow = await this.flowRepository.findById(conversation.flow_id);
            if (flow.user_id !== userId) {
                throw new AuthorizationError('You do not have access to this preview session');
            }

            // Delete all messages
            await this.messageRepository.deleteByConversation(sessionId);

            // Delete collected data
            await this.collectedDataRepository.deleteByConversation(sessionId);

            // Reset conversation state
            await this.conversationRepository.updateCurrentNode(sessionId, 'start');
            await this.conversationRepository.updateSessionData(sessionId, {});
            await this.conversationRepository.updateStatus(sessionId, CONVERSATION_STATUS.ACTIVE);

            // Get or create preview service
            let previewService = this.previewSessions.get(sessionId);
            if (!previewService) {
                previewService = new PreviewService();
                this.previewSessions.set(sessionId, previewService);
            }
            previewService.clearMessages();

            // Re-execute flow from start
            const resetConversation = await this.conversationRepository.findById(sessionId);
            await this.flowExecutor.executeFlow(
                resetConversation,
                conversation.flow_id,
                null,
                true, // isPreview flag
                previewService
            );

            // Get initial messages
            const messages = await this.messageRepository.getByConversation(sessionId);

            global.slashLogs(`Preview session reset complete`, true, true);

            res.json({
                success: true,
                session_id: sessionId,
                messages: messages,
                conversation_status: CONVERSATION_STATUS.ACTIVE,
                current_node_id: 'start',
            });
        } catch (error) {
            global.slashLogs(`Error in resetPreview: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * End a preview session
     */
    async endPreview(req, res) {
        try {
            const { sessionId } = req.params;
            const userId = req.user.id;

            global.slashLogs(`Ending preview session: ${sessionId}`, true, true);

            // Get conversation
            const conversation = await this.conversationRepository.findById(sessionId);
            if (!conversation) {
                throw new NotFoundError('Preview session', sessionId);
            }

            // Verify it's a preview conversation
            if (conversation.channel !== CHANNELS.PREVIEW) {
                throw new ValidationError('Invalid preview session');
            }

            // Verify ownership
            const flow = await this.flowRepository.findById(conversation.flow_id);
            if (flow.user_id !== userId) {
                throw new AuthorizationError('You do not have access to this preview session');
            }

            // Mark conversation as completed
            await this.conversationRepository.completeConversation(sessionId);

            // Clean up preview service
            this.previewSessions.delete(sessionId);

            global.slashLogs(`Preview session ended`, true, true);

            res.json({
                success: true,
                message: 'Preview session ended',
            });
        } catch (error) {
            global.slashLogs(`Error in endPreview: ${error.message}`, true, true);
            throw error;
        }
    }
}

module.exports = PreviewController;
