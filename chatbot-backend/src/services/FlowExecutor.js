const logger = require('../config/logger');
const FlowRepository = require('../repositories/FlowRepository');
const ConversationRepository = require('../repositories/ConversationRepository');
const MessageRepository = require('../repositories/MessageRepository');
const CollectedDataRepository = require('../repositories/CollectedDataRepository');
const AnalyticsRepository = require('../repositories/AnalyticsRepository');
const NodeProcessor = require('./NodeProcessor');
const WhatsAppService = require('./WhatsAppService');
const { parseFlowData } = require('../models/Flow');
const { CONVERSATION_STATUS, MESSAGE_SENDER } = require('../config/constants');

/**
 * Flow Executor Service
 * Core engine that executes chatbot flows
 */

class FlowExecutor {
    constructor() {
        this.flowRepository = new FlowRepository();
        this.conversationRepository = new ConversationRepository();
        this.messageRepository = new MessageRepository();
        this.collectedDataRepository = new CollectedDataRepository();
        this.analyticsRepository = new AnalyticsRepository();
    }

    /**
     * Process incoming message
     * param {string} flowId - Flow ID
     * param {string} userPhone - User phone number
     * param {string} userName - User name
     * param {string} messageText - Message text
     * param {string} platformUserId - Platform user ID
     * param {string} channel - Channel (whatsapp, instagram, web)
     * returns {Promise<void>}
     */
    async processMessage(flowId, userPhone, userName, messageText, platformUserId, channel = 'whatsapp') {
        try {
            global.slashLogs(`Processing message: ${JSON.stringify({ flowId, userPhone, messageText })}`, true, true);

            // Get or create conversation
            let conversation = await this.conversationRepository.getActiveConversation(userPhone, flowId);

            if (!conversation) {
                conversation = await this.startConversation(
                    flowId,
                    userPhone,
                    userName,
                    platformUserId,
                    channel
                );
            }

            // Save user message
            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flowId,
                sender: MESSAGE_SENDER.USER,
                message_type: 'text',
                message_text: messageText,
            });

            // Track analytics
            await this.analyticsRepository.trackMessageReceived(flowId);

            // Execute flow
            await this.executeFlow(conversation, flowId, messageText);

        } catch (error) {
            logger.error('Error processing message', {
                error: error.message,
                stack: error.stack,
                flowId,
                userPhone,
            });
            throw error;
        }
    }

    /**
     * Start a new conversation
     * param {string} flowId - Flow ID
     * param {string} userPhone - User phone number
     * param {string} userName - User name
     * param {string} platformUserId - Platform user ID
     * param {string} channel - Channel
     * returns {Promise<Object>} Created conversation
     * private
     */
    async startConversation(flowId, userPhone, userName, platformUserId, channel) {
        global.slashLogs(`Starting new conversation: ${flowId} for userPhone: ${userPhone}`, true, true);

        const conversation = await this.conversationRepository.createConversation({
            flow_id: flowId,
            user_phone: userPhone,
            user_name: userName,
            platform_user_id: platformUserId,
            current_node_id: 'start',
            channel,
            status: CONVERSATION_STATUS.ACTIVE,
        });

        // Track analytics
        await this.analyticsRepository.trackConversationStarted(flowId);
        await this.flowRepository.incrementConversationCount(flowId);

        return conversation;
    }

    /**
     * Execute flow from current node
     */
    async executeFlow(conversation, flowId, userInput = null) {
        try {
            // Get flow
            const flow = await this.flowRepository.findById(flowId);
            if (!flow) {
                global.slashLogs(`Flow not found: ${flowId}`, true, true);
                return;
            }

            // Parse flow data
            const flowData = parseFlowData(flow);

            // Get user configuration for WhatsApp service
            const UserRepository = require('../repositories/UserRepository');
            const userRepository = new UserRepository();
            const user = await userRepository.findById(flow.user_id);

            if (!user || !user.whatsapp_api_key || !user.whatsapp_phone_number_id) {
                global.slashLogs(`User WhatsApp configuration missing: ${flow.user_id}`, true, true);
                return;
            }

            // Initialize WhatsApp service
            const whatsappService = new WhatsAppService(
                user.whatsapp_api_key,
                user.whatsapp_phone_number_id
            );

            // Initialize node processor
            const nodeProcessor = new NodeProcessor(
                whatsappService,
                this.messageRepository,
                this.collectedDataRepository
            );

            // Get current node
            let currentNodeId = conversation.current_node_id;
            let shouldContinue = true;
            let iterationCount = 0;
            const maxIterations = 50; // Prevent infinite loops

            while (shouldContinue && iterationCount < maxIterations) {
                iterationCount++;

                // Find current node in flow
                const currentNode = flowData.nodes.find((n) => n.id === currentNodeId);

                if (!currentNode) {
                    global.slashLogs(`Node not found in flow: ${currentNodeId} for flowId: ${flowId}`, true, true);
                    break;
                }

                // Track node visit
                await this.analyticsRepository.trackNodeVisited(flowId, currentNodeId);

                // Process node
                const result = await nodeProcessor.processNode(
                    currentNode,
                    conversation,
                    flow,
                    userInput
                );

                // Update session data if changed
                if (result.updatedSessionData) {
                    conversation = await this.conversationRepository.updateSessionData(
                        conversation.conversation_id,
                        result.updatedSessionData
                    );
                }

                // Update current node
                if (result.nextNodeId) {
                    currentNodeId = result.nextNodeId;
                    await this.conversationRepository.updateCurrentNode(
                        conversation.conversation_id,
                        currentNodeId
                    );
                } else {
                    // End of flow
                    await this.completeConversation(conversation.conversation_id, flowId);
                    shouldContinue = false;
                    break;
                }

                // If node requires user input, stop execution
                if (result.shouldWaitForInput) {
                    shouldContinue = false;
                    break;
                }

                // Clear user input after first node (only use it once)
                userInput = null;
            }

            if (iterationCount >= maxIterations) {
                logger.error('Flow execution exceeded max iterations', {
                    flowId,
                    conversationId: conversation.conversation_id,
                });
            }

        } catch (error) {
            logger.error('Error executing flow', {
                error: error.message,
                stack: error.stack,
                flowId,
                conversationId: conversation.conversation_id,
            });
            throw error;
        }
    }

    /**
     * Complete a conversation
     */
    async completeConversation(conversationId, flowId) {
        logger.info('Completing conversation', { conversationId });

        await this.conversationRepository.completeConversation(conversationId);
        await this.analyticsRepository.trackConversationCompleted(flowId);
    }

    /**
     * Abandon a conversation (timeout or error)
     */
    async abandonConversation(conversationId, flowId) {
        logger.info('Abandoning conversation', { conversationId });

        await this.conversationRepository.abandonConversation(conversationId);
        await this.analyticsRepository.trackConversationAbandoned(flowId);
    }

    /**
     * Handle human takeover
     */
    async handleHumanTakeover(conversationId) {
        
        global.slashLogs(`Human takeover initiated for conversationId: ${conversationId}`, true, true);
    
        await this.conversationRepository.setHumanTakeover(conversationId);
    }

}

module.exports = FlowExecutor;
