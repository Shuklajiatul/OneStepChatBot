const logger = require('../config/logger');
const { NODE_TYPES, CONVERSATION_STATUS, MESSAGE_SENDER } = require('../config/constants');
const VariableResolver = require('./VariableResolver');
const ConditionEvaluator = require('./ConditionEvaluator');
const WebhookService = require('./WebhookService');
const { sleep } = require('../utils/helpers');
const { setSessionVariable, updateSessionData } = require('../models/Conversation');

// Global map of pending agent timers: conversationId → { timerId, flowId }
// Allows socketHandlers to cancel the timeout when an admin accepts
global.pendingAgentTimers = global.pendingAgentTimers || new Map();

/**
 * Node Processor Service
 * Processes different node types and determines next actions
 */
class NodeProcessor {
    constructor(whatsappService, messageRepository, collectedDataRepository) {
        this.whatsappService = whatsappService;
        this.messageRepository = messageRepository;
        this.collectedDataRepository = collectedDataRepository;
    }

    /**
     * Process a node and return next node ID
     */
    async processNode(node, conversation, flow, userInput = null) {

        global.slashLogs(`Processing node: ${node.id} for conversationId: ${conversation.conversation_id}`, true, true);

        switch (node.type) {
            case NODE_TYPES.MESSAGE:
                return await this.processMessageNode(node, conversation, flow);

            case NODE_TYPES.QUESTION:
                return await this.processQuestionNode(node, conversation, flow, userInput);

            case NODE_TYPES.BUTTONS:
                return await this.processButtonsNode(node, conversation, flow, userInput);

            case NODE_TYPES.LIST:
                return await this.processListNode(node, conversation, flow, userInput);

            case NODE_TYPES.CONDITION:
                return await this.processConditionNode(node, conversation, flow);

            case NODE_TYPES.WEBHOOK:
                return await this.processWebhookNode(node, conversation, flow);

            case NODE_TYPES.DELAY:
                return await this.processDelayNode(node, conversation, flow);

            case NODE_TYPES.END:
                return await this.processEndNode(node, conversation, flow);

            case NODE_TYPES.TALK_TO_AGENT:
                return await this.processTalkToAgentNode(node, conversation, flow);

            default:
                global.slashLogs(`Unknown node type ${node.type }`, true, true);
                return { nextNodeId: null, shouldWaitForInput: false };
        }
    }

    /**
     * Process MESSAGE node
     */
    async processMessageNode(node, conversation, flow) {
        const message = VariableResolver.resolve(node.data.message, conversation);

        // Send message based on media type
        if (node.data.media_url) {
            if (node.data.media_type === 'image') {
                await this.whatsappService.sendImageMessage(
                    conversation.user_phone,
                    node.data.media_url,
                    message
                );
            } else if (node.data.media_type === 'document') {
                await this.whatsappService.sendDocumentMessage(
                    conversation.user_phone,
                    node.data.media_url,
                    node.data.filename || 'document',
                    message
                );
            } else if (node.data.media_type === 'video') {
                await this.whatsappService.sendVideoMessage(
                    conversation.user_phone,
                    node.data.media_url,
                    message
                );
            }
        } else {
            await this.whatsappService.sendTextMessage(conversation.user_phone, message);
        }

        // Save message to database
        await this.messageRepository.createMessage({
            conversation_id: conversation.conversation_id,
            flow_id: flow.flow_id,
            sender: 'bot',
            message_type: node.data.media_type || 'text',
            message_text: message,
            node_id: node.id,
        });

        return {
            nextNodeId: node.next,
            shouldWaitForInput: false,
        };
    }

    /**
     * Process QUESTION node
     */
    async processQuestionNode(node, conversation, flow, userInput) {
        // If no user input, send the question and wait
        if (!userInput) {
            const question = VariableResolver.resolve(node.data.question, conversation);
            await this.whatsappService.sendTextMessage(conversation.user_phone, question);

            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flow.flow_id,
                sender: 'bot',
                message_type: 'question',
                message_text: question,
                node_id: node.id,
            });

            return {
                nextNodeId: node.id, // Stay on same node
                shouldWaitForInput: true,
            };
        }

        // Validate input if validation type is specified
        if (node.data.validation_type) {
            const isValid = this.validateInput(userInput, node.data.validation_type);
            if (!isValid) {
                const errorMessage = node.data.error_message || 'Invalid input. Please try again.';
                await this.whatsappService.sendTextMessage(conversation.user_phone, errorMessage);

                return {
                    nextNodeId: node.id, // Stay on same node
                    shouldWaitForInput: true,
                };
            }
        }

        // Normalize email to lowercase
        if (node.data.validation_type === 'email') {
            global.slashLogs(`Normalizing email to lowercase: ${userInput}`, true, true);
            userInput = userInput.toLowerCase();
        }

        // Only save if a variable name is defined
        const variableName = node.data.variable_name;
        let updatedSessionData;

        if (variableName) {
            await this.collectedDataRepository.saveVariable(
                conversation.conversation_id,
                variableName,
                userInput,
                node.id
            );

            updatedSessionData = setSessionVariable(
                conversation,
                variableName,
                userInput
            );
        } else {
            global.slashLogs(`Question node ${node.id} has no variable_name set; skipping session save.`, true, true);
        }

        return {
            nextNodeId: node.next,
            shouldWaitForInput: false,
            updatedSessionData,
        };
    }

    /**
     * Process BUTTONS node
     */
    async processButtonsNode(node, conversation, flow, userInput) {
        // If no user input, send the buttons and wait
        if (!userInput) {
            const message = VariableResolver.resolve(node.data.message, conversation);
            const buttons = node.data.buttons.map((btn) => ({
                id: btn.id,
                title: VariableResolver.resolve(btn.title, conversation),
            }));

            await this.whatsappService.sendButtonMessage(conversation.user_phone, message, buttons);

            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flow.flow_id,
                sender: 'bot',
                message_type: 'interactive',
                message_text: message,
                message_data: { type: 'button', buttons },
                node_id: node.id,
            });

            return {
                nextNodeId: node.id, // Stay on same node
                shouldWaitForInput: true,
            };
        }

        // Find the selected button
        const selectedButton = node.data.buttons.find((btn) => btn.id === userInput);

        if (!selectedButton) {
            global.slashLogs(`Invalid button selection: ${userInput} for nodeId: ${node.id} — resending buttons`, true, true);
            // Resend the button message so the user sees the options again
            const message = VariableResolver.resolve(node.data.message, conversation);
            const buttons = node.data.buttons.map((btn) => ({
                id: btn.id,
                title: VariableResolver.resolve(btn.title, conversation),
            }));
            await this.whatsappService.sendButtonMessage(conversation.user_phone, message, buttons);
            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flow.flow_id,
                sender: 'bot',
                message_type: 'interactive',
                message_text: message,
                message_data: { type: 'button', buttons },
                node_id: node.id,
            });
            return {
                nextNodeId: node.id,
                shouldWaitForInput: true,
            };
        }

        // Save selection if variable name is specified
        if (node.data.variable_name) {
            await this.collectedDataRepository.saveVariable(
                conversation.conversation_id,
                node.data.variable_name,
                selectedButton.title,
                node.id
            );

            const updatedSessionData = setSessionVariable(
                conversation,
                node.data.variable_name,
                selectedButton.title
            );

            return {
                nextNodeId: selectedButton.next,
                shouldWaitForInput: false,
                updatedSessionData,
            };
        }

        return {
            nextNodeId: selectedButton.next,
            shouldWaitForInput: false,
        };
    }

    /**
     * Process LIST node
     */
    async processListNode(node, conversation, flow, userInput) {
        // If no user input, send the list and wait
        if (!userInput) {
            const message = VariableResolver.resolve(node.data.message, conversation);
            const buttonText = VariableResolver.resolve(node.data.button_text, conversation);

            await this.whatsappService.sendListMessage(
                conversation.user_phone,
                message,
                buttonText,
                node.data.sections
            );

            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flow.flow_id,
                sender: 'bot',
                message_type: 'interactive',
                message_text: message,
                message_data: { type: 'list', sections: node.data.sections },
                node_id: node.id,
            });

            return {
                nextNodeId: node.id, // Stay on same node
                shouldWaitForInput: true,
            };
        }

        // Find the selected list item
        let selectedItem = null;
        for (const section of node.data.sections) {
            selectedItem = section.rows.find((row) => row.id === userInput);
            if (selectedItem) break;
        }

        if (!selectedItem) {
            global.slashLogs(`Invalid list selection: ${userInput} for nodeId: ${node.id} — resending list`, true, true);
            // Resend the list message so the user sees the options again
            const message = VariableResolver.resolve(node.data.message, conversation);
            const buttonText = VariableResolver.resolve(node.data.button_text, conversation);
            await this.whatsappService.sendListMessage(
                conversation.user_phone,
                message,
                buttonText,
                node.data.sections
            );
            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flow.flow_id,
                sender: 'bot',
                message_type: 'interactive',
                message_text: message,
                message_data: { type: 'list', sections: node.data.sections },
                node_id: node.id,
            });
            return {
                nextNodeId: node.id,
                shouldWaitForInput: true,
            };
        }

        // Save selection if variable name is specified
        if (node.data.variable_name) {
            global.slashLogs(`Saving variable: ${node.data.variable_name} for nodeId: ${node.id}`, true, true);
            await this.collectedDataRepository.saveVariable(
                conversation.conversation_id,
                node.data.variable_name,
                selectedItem.title,
                node.id
            );

            const updatedSessionData = setSessionVariable(
                conversation,
                node.data.variable_name,
                selectedItem.title
            );

            return {
                nextNodeId: selectedItem.next,
                shouldWaitForInput: false,
                updatedSessionData,
            };
        }

        return {
            nextNodeId: selectedItem.next,
            shouldWaitForInput: false,
        };
    }

    /**
     * Process CONDITION node
     */
    async processConditionNode(node, conversation, flow) {
        const nextNodeId = ConditionEvaluator.evaluateConditions(
            node.data.conditions,
            node.data.default_next,
            conversation
        );

        return {
            nextNodeId,
            shouldWaitForInput: false,
        };
    }

    /**
     * Process WEBHOOK node 
     */
    async processWebhookNode(node, conversation, flow) {
        try {
            // Get collected data
            const collectedData = await this.collectedDataRepository.getAsObject(
                conversation.conversation_id
            );

            // Resolve variables in webhook config
            const webhookConfig = VariableResolver.resolveObject(
                {
                    url: node.data.url,
                    method: node.data.method || 'POST',
                    headers: node.data.headers || {},
                    body: node.data.body || {},
                    params: node.data.params || {},
                    path_variables: node.data.path_variables || {},
                },
                conversation
            );

            // Call webhook
            const response = await WebhookService.callWithContext(
                webhookConfig,
                conversation,
                collectedData
            );

            // Save response to session if variable name is specified
            let updatedSessionData;
            if (node.data.response_variable) {
                updatedSessionData = setSessionVariable(
                    conversation,
                    node.data.response_variable,
                    response.data
                );
            }

            return {
                nextNodeId: node.next,
                shouldWaitForInput: false,
                updatedSessionData,
            };
        } catch (error) {
            global.slashLogs(`Webhook node processing failed: ${error.message} for nodeId: ${node.id}`, true, true);

            // Continue to next node even if webhook fails
            return {
                nextNodeId: node.next,
                shouldWaitForInput: false,
            };
        }
    }

    /**
     * Process DELAY node
     */
    async processDelayNode(node, conversation, flow) {
        const delayMs = node.data.delay_seconds * 1000;
        global.slashLogs(`Delaying for ${node.data.delay_seconds} seconds for conversationId: ${conversation.conversation_id}`, true, true);
        await sleep(delayMs);

        return {
            nextNodeId: node.next,
            shouldWaitForInput: false,
        };
    }

    /**
     * Process END node
     */
    async processEndNode(node, conversation, flow) {
        // Send final message if specified
        if (node.data.message) {
            const message = VariableResolver.resolve(node.data.message, conversation);
            await this.whatsappService.sendTextMessage(conversation.user_phone, message);

            await this.messageRepository.createMessage({
                conversation_id: conversation.conversation_id,
                flow_id: flow.flow_id,
                sender: 'bot',
                message_type: 'text',
                message_text: message,
                node_id: node.id,
            });
        }

        return {
            nextNodeId: null, // End of flow
            shouldWaitForInput: false,
        };
    }

    /**
     * Validate user input
     */
    validateInput(input, validationType) {
        switch (validationType) {
            case 'email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

            case 'phone':
                return /^\+?[1-9]\d{1,14}$/.test(input);

            case 'number':
                return !isNaN(parseFloat(input));

            case 'text':
                return input.trim().length > 0;

            default:
                return true;
        }
    }

    /**
     * Process TALK_TO_AGENT node
     */
    async processTalkToAgentNode(node, conversation, flow) {
        const ConversationRepository = require('../repositories/ConversationRepository');
        const MessageRepository      = require('../repositories/MessageRepository');
        const conversationRepo       = new ConversationRepository();
        const messageRepo            = new MessageRepository();

        const waitMessage    = node.data?.waitMessage    || 'Please wait, connecting you to a support agent...';
        const timeoutMessage = node.data?.timeoutMessage || 'Sorry, no agents are available right now. We will get back to you soon.';
        const timeoutMs      = (node.data?.timeoutSeconds || 60) * 1000;
        const fallbackNodeId = node.data?.fallbackNodeId || null;

        // Send wait message to customer
        await this.whatsappService.sendTextMessage(conversation.user_phone, waitMessage);
        await messageRepo.createMessage({
            conversation_id: conversation.conversation_id,
            flow_id:         flow.flow_id,
            sender:          MESSAGE_SENDER.BOT,
            message_type:    'text',
            message_text:    waitMessage,
            node_id:         node.id,
        });

        // Update conversation status → PENDING_AGENT
        await conversationRepo.setPendingAgent(conversation.conversation_id, fallbackNodeId);

        // Store fallbackNodeId in session_data so socketHandlers can retrieve it later
        const sessionData = conversation.session_data
            ? (typeof conversation.session_data === 'string'
                ? JSON.parse(conversation.session_data)
                : { ...conversation.session_data })
            : {};
        sessionData.__pendingAgentFallbackNodeId = fallbackNodeId;
        await conversationRepo.updateSessionData(conversation.conversation_id, JSON.stringify(sessionData));

        // Load last few messages as preview for admin
        const previewMessages = await messageRepo.getByConversation(conversation.conversation_id, 5);

        // Broadcast agent request to ALL admins in the flow's live room
        if (global.io) {
            global.io
                .to(`admin:live:${flow.flow_id}`)
                .emit('admin:agent_request', {
                    conversationId:  conversation.conversation_id,
                    flowId:          flow.flow_id,
                    customerPhone:   conversation.user_phone,
                    customerName:    conversation.user_name || conversation.user_phone,
                    nodeId:          node.id,
                    fallbackNodeId,
                    previewMessages,
                    requestedAt:     new Date().toISOString(),
                });
        }

        global.slashLogs(
            `[TalkToAgent] Agent request emitted for conversation: ${conversation.conversation_id}, ` +
            `timeout in ${timeoutMs / 1000}s, fallback: ${fallbackNodeId || 'end'}`,
            true, true
        );

        // Schedule 60-second timeout
        const timerId = setTimeout(async () => {
            try {
                global.pendingAgentTimers.delete(conversation.conversation_id);

                //Verify the conversation is still PENDING (admin may have accepted just now)
                const freshConvo = await conversationRepo.findById(conversation.conversation_id);
                if (!freshConvo || freshConvo.status !== CONVERSATION_STATUS.PENDING_AGENT) {
                    global.slashLogs(
                        `[TalkToAgent] Timeout fired but conversation ${conversation.conversation_id} is no longer PENDING_AGENT — skipping.`,
                        true, true
                    );
                    return;
                }

                global.slashLogs(
                    `[TalkToAgent] Timeout: no admin accepted conversation ${conversation.conversation_id}. Running fallback.`,
                    true, true
                );

                // Send timeout message to customer
                await this.whatsappService.sendTextMessage(conversation.user_phone, timeoutMessage);
                await messageRepo.createMessage({
                    conversation_id: conversation.conversation_id,
                    flow_id:         flow.flow_id,
                    sender:          MESSAGE_SENDER.BOT,
                    message_type:    'text',
                    message_text:    timeoutMessage,
                });

                if (fallbackNodeId) {
                    // Resume from fallback node — reset status to ACTIVE and set node
                    await conversationRepo.updateStatus(conversation.conversation_id, CONVERSATION_STATUS.ACTIVE);
                    await conversationRepo.updateCurrentNode(conversation.conversation_id, fallbackNodeId);

                    // Notify admin panel that the request timed out
                    if (global.io) {
                        global.io
                            .to(`admin:live:${flow.flow_id}`)
                            .emit('admin:agent_request_timeout', {
                                conversationId: conversation.conversation_id,
                                reason: 'timeout',
                            });
                    }

                    // Trigger bot to execute from the fallback node
                    const FlowExecutor = require('./FlowExecutor');
                    const executor = new FlowExecutor();
                    await executor.executeFlow(
                        { ...freshConvo, status: CONVERSATION_STATUS.ACTIVE, current_node_id: fallbackNodeId },
                        flow.flow_id,
                        null  // no user input — bot auto-runs from fallback node
                    );
                } else {
                    // No fallback — end the conversation
                    await conversationRepo.completeConversation(conversation.conversation_id);
                    if (global.io) {
                        global.io
                            .to(`admin:live:${flow.flow_id}`)
                            .emit('admin:agent_request_timeout', {
                                conversationId: conversation.conversation_id,
                                reason: 'timeout',
                            });
                        global.io
                            .to(`admin:live:${flow.flow_id}`)
                            .emit('admin:conversation_completed', {
                                conversationId: conversation.conversation_id,
                                status: 'completed',
                            });
                    }
                }
            } catch (err) {
                global.slashLogs(`[TalkToAgent] Error during timeout handler: ${err.message}`, true, true);
            }
        }, timeoutMs);

        // Store timer so socketHandlers can clear it on accept/reject
        global.pendingAgentTimers.set(conversation.conversation_id, {
            timerId,
            flowId: flow.flow_id,
        });

        // Return: pause flow execution until admin accepts or timeout fires
        return {
            nextNodeId:        null, // do NOT auto-continue — agent or timeout drives next step
            shouldWaitForInput: true,
        };
    }
}

module.exports = NodeProcessor;
