const logger                                  = require('../config/logger');
const FlowRepository                          = require('../repositories/FlowRepository');
const ConversationRepository                  = require('../repositories/ConversationRepository');
const MessageRepository                       = require('../repositories/MessageRepository');
const CollectedDataRepository                 = require('../repositories/CollectedDataRepository');
const AnalyticsRepository                     = require('../repositories/AnalyticsRepository');
const NodeProcessor                           = require('./NodeProcessor');
const WhatsAppService                         = require('./WhatsAppService');
const { parseFlowData }                       = require('../models/Flow');
const { CONVERSATION_STATUS, MESSAGE_SENDER } = require('../config/constants');
const ProfanityService                        = require('./ProfanityService');

// Flow Executor Service
// Core engine that executes chatbot flows

class FlowExecutor {
    constructor() {
        this.flowRepository          = new FlowRepository();
        this.conversationRepository  = new ConversationRepository();
        this.messageRepository       = new MessageRepository();
        this.collectedDataRepository = new CollectedDataRepository();
        this.analyticsRepository     = new AnalyticsRepository();
    }

    // Process incoming message
    async processMessage(flowId, userPhone, userName, messageText, platformUserId, channel = 'whatsapp', isPreview = false, previewService = null, displayText = null) {
        try {
            global.slashLogs(`Processing message: ${JSON.stringify({ flowId, userPhone, messageText })}`, true, true);

            // Get or create conversation
            let conversation = await this.conversationRepository.getActiveConversation(userPhone, flowId);

            // ── Human Takeover Bypass ──────────────────────────────────────────
            // If no active conversation found, check if there's one in human_takeover state
            if (!conversation) {
                const takeoverConversation = await this.conversationRepository.findHumanTakeoverByPhone(userPhone, flowId);

                if (takeoverConversation) {
                    global.slashLogs(`[HUMAN TAKEOVER] Message from ${userPhone} forwarded to agent (conversationId: ${takeoverConversation.conversation_id})`, true, true);

                    // Save user message to DB so history is preserved
                    await this.messageRepository.createMessage({
                        conversation_id: takeoverConversation.conversation_id,
                        flow_id: flowId,
                        sender: MESSAGE_SENDER.USER,
                        message_type: 'text',
                        message_text: messageText,
                    });

                    // Forward to admin via Socket.IO — do NOT run bot flow
                    if (global.io) {
                        global.io
                            .to(`admin:takeover:${takeoverConversation.conversation_id}`)
                            .emit('admin:customer_reply', {
                                conversationId: takeoverConversation.conversation_id,
                                from: userPhone,
                                name: userName,
                                message: messageText,
                                timestamp: new Date().toISOString(),
                            });
                    }

                    return; // Stop here — agent handles response
                }
            }

            // ── Pending Agent Bypass ───────────────────────────────────────────
            // If no active conversation, check if the customer is waiting in the
            // agent request queue (PENDING_AGENT). Save the message but do NOT run bot.
            if (!conversation) {
                const pendingConversation = await this.conversationRepository.findPendingAgentByPhone(userPhone, flowId);

                if (pendingConversation) {
                    global.slashLogs(`[PENDING AGENT] Message from ${userPhone} received while waiting for agent. Saving silently.`, true, true);

                    // Save message so admin/agent sees it when they accept
                    await this.messageRepository.createMessage({
                        conversation_id: pendingConversation.conversation_id,
                        flow_id: flowId,
                        sender: MESSAGE_SENDER.USER,
                        message_type: 'text',
                        message_text: messageText,
                    });

                    // Also forward to admin live room so they see it in real-time
                    if (global.io) {
                        global.io
                            .to(`admin:live:${flowId}`)
                            .emit('admin:incoming_message', {
                                conversationId: pendingConversation.conversation_id,
                                from: userPhone,
                                name: userName,
                                message: messageText,
                                type: 'text',
                                timestamp: new Date().toISOString(),
                            });
                    }

                    return; // Bot does NOT run — wait for agent accept or timeout
                }
            }

            if (!conversation) {
                // First message — check for profanity before doing anything
                // Mode is controlled by PROFANITY_CHECK_MODE env var: 'local' (default) or 'ai'
                const isProfane = await ProfanityService.check(messageText);

                if (isProfane) {
                    global.slashLogs(`Profanity detected in first message from ${userPhone}: "${messageText}" — conversation blocked`, true, true);

                    // Send a warning back to the user
                    try {
                        const warningService = new WhatsAppService(
                            process.env.WHATSAPP_ACCESS_TOKEN,
                            process.env.WHATSAPP_PHONE_NUMBER_ID
                        );
                        await warningService.sendTextMessage(
                            userPhone,
                            '⚠️ Please do not use abusive or inappropriate language. Your message has not been processed.'
                        );
                    } catch (warnErr) {
                        global.slashLogs(`Failed to send profanity warning to ${userPhone}: ${warnErr.message}`, true, true);
                    }

                    return; // Do not create conversation and do not store message
                }

                conversation = await this.startConversation(
                    flowId,
                    userPhone,
                    userName,
                    platformUserId,
                    channel
                );
            }

            // Save user message
            const savedUserMessage = await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flowId,
                sender: MESSAGE_SENDER.USER,
                message_type: 'text',
                message_text: messageText,
            });

            // ── Broadcast incoming message to admin live panel
            // Use displayText (button/list title) when available, fall back to messageText (raw id or typed text)
            const adminDisplayMessage = displayText || messageText;
            if (global.io && !isPreview) {
                global.slashLogs(`Broadcasting incoming message to admin live panel for conversationId: ${conversation.conversation_id}`, true, true);
                global.io
                    .to(`admin:live:${flowId}`)
                    .emit('admin:incoming_message', {
                        conversationId: conversation.conversation_id,
                        from: userPhone,
                        name: userName || userPhone,
                        message: adminDisplayMessage,
                        type: 'text',
                        timestamp: new Date().toISOString(),
                    });
            }

            // Track analytics
            await this.analyticsRepository.trackMessageReceived(flowId);

            // Execute flow
            await this.executeFlow(conversation, flowId, messageText, isPreview, previewService);

        } catch (error) {
            global.slashLogs(`Error processing message: ${error.message}`, true, true);
            throw error;
        }
    }


    // Start a new conversation
    async startConversation(flowId, userPhone, userName, platformUserId, channel) {
        global.slashLogs(`Starting new conversation: ${flowId} for userPhone: ${userPhone}`, true, true);

        // Dynamically determine the start node from flow data
        const flow = await this.flowRepository.findById(flowId);
        const flowData = typeof flow.flow_data === 'string' ? JSON.parse(flow.flow_data) : flow.flow_data;
        const startNodeId = flowData.nodes.find(n => n.type === 'start')?.id || flowData.nodes[0]?.id;

        global.slashLogs(`Start node determined: ${startNodeId} for flowId: ${flowId}`, true, true);

        const conversation = await this.conversationRepository.createConversation({
            flow_id: flowId,
            user_phone: userPhone,
            user_name: userName,
            platform_user_id: platformUserId,
            current_node_id: startNodeId,
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
    async executeFlow(conversation, flowId, userInput = null, isPreview = false, previewService = null) {
        try {
            // Get flow
            const flow = await this.flowRepository.findById(flowId);
            if (!flow) {
                global.slashLogs(`Flow not found: ${flowId}`, true, true);
                return;
            }

            // Parse flow data
            const flowData = parseFlowData(flow);

            // Initialize messaging service (WhatsApp or Preview)
            let messagingService;

            if (isPreview && previewService) {
                // Use preview service for testing
                messagingService = previewService;
                global.slashLogs('[PREVIEW MODE] Using PreviewService', true, true);
            } else {
                // Get user configuration for WhatsApp service
                const UserRepository = require('../repositories/UserRepository');
                const userRepository = new UserRepository();
                const user = await userRepository.findById(flow.user_id);

                // if (!user || !user.whatsapp_api_key || !user.whatsapp_phone_number_id) {
                //     global.slashLogs(`User WhatsApp configuration missing: ${flow.user_id}`, true, true);
                //     return;
                // }

                // Initialize WhatsApp service
                messagingService = new WhatsAppService(
                    user.whatsapp_api_key || process.env.WHATSAPP_ACCESS_TOKEN,
                    user.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID
                );
            }

            // Initialize node processor
            const nodeProcessor = new NodeProcessor(
                messagingService,
                this.messageRepository,
                this.collectedDataRepository
            );

            // Get current node
            let currentNodeId = conversation.current_node_id ? conversation.current_node_id.toString() : null;
            let shouldContinue = true;
            let iterationCount = 0;
            const maxIterations = 50; // To prevent infinite loops

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


                global.slashLogs(`Node processed: ${currentNodeId} for flowId: ${flowId} also result ${result}`, true, true);

                // ── Broadcast bot response to admin live panel
                if (global.io && !isPreview) {
                    const lastMessage = await this.messageRepository.getLastMessage(conversation.conversation_id);
                    if (lastMessage && lastMessage.sender === 'bot') {
                        global.io
                            .to(`admin:live:${flowId}`)
                            .emit('admin:bot_response', {
                                conversationId: conversation.conversation_id,
                                userPhone: conversation.user_phone,
                                message: {
                                    type: lastMessage.message_type,
                                    text: lastMessage.message_text,
                                    data: lastMessage.message_data,
                                },
                                timestamp: lastMessage.timestamp,
                            });
                    }
                }

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
                    // nextNodeId is null — either end of flow OR a node that pauses execution
                    // (e.g. talk_to_agent). Only complete the conversation if we're NOT
                    // waiting for external input.
                    if (!result.shouldWaitForInput) {
                        await this.completeConversation(conversation.conversation_id, flowId);
                    }
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
                global.slashLogs(`Flow execution exceeded max iterations for flowId: ${flowId} and conversationId: ${conversation.conversation_id}`, true, true);
            }

        } catch (error) {
           global.slashLogs(`Error executing flow: ${error.message}`, true, true);
            throw error;
        }
    }

    // Complete a conversation
    async completeConversation(conversationId, flowId) {
        global.slashLogs(`Completing conversation for conversationId: ${conversationId} and flowId: ${flowId}`, true, true);

        await this.conversationRepository.completeConversation(conversationId);
        await this.analyticsRepository.trackConversationCompleted(flowId);

        // Notify admin live panel to remove the conversation card
        if (global.io && flowId) {
            global.io
                .to(`admin:live:${flowId}`)
                .emit('admin:conversation_completed', {
                    conversationId,
                    status: 'completed',
                });
        }
    }

    // Abandon a conversation (timeout or error)
    async abandonConversation(conversationId, flowId) {
        global.slashLogs(`Abandoning conversation for conversationId: ${conversationId} and flowId: ${flowId}`, true, true);

        await this.conversationRepository.abandonConversation(conversationId);
        await this.analyticsRepository.trackConversationAbandoned(flowId);

        // Notify admin live panel to remove the conversation card
        if (global.io && flowId) {
            global.io
                .to(`admin:live:${flowId}`)
                .emit('admin:conversation_completed', {
                    conversationId,
                    status: 'abandoned',
                });
        }
    }

    // Handle human takeover
    async handleHumanTakeover(conversationId) {
        
        global.slashLogs(`Human takeover initiated for conversationId: ${conversationId}`, true, true);
    
        await this.conversationRepository.setHumanTakeover(conversationId);
    }

}

module.exports = FlowExecutor;
