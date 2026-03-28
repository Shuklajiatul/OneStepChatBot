const FlowExecutor = require('../services/FlowExecutor');
const FlowRepository = require('../repositories/FlowRepository');
const WhatsAppService = require('../services/WhatsAppService');
const MessageRepository = require('../repositories/MessageRepository');
const logger = require('../config/logger');
const { HTTP_STATUS } = require('../config/constants');


/**
 * Webhook Controller
 * Handles incoming webhooks from WhatsApp and Instagram
 */
class WebhookController {
    constructor() {
        this.flowExecutor = new FlowExecutor();
        this.flowRepository = new FlowRepository();
        this.messageRepository = new MessageRepository();
    }

    /**
     * Verify WhatsApp webhook when we add it in whatsapp for the first time 
     */
    async verifyWhatsApp(req, res) {
        try {
            global.slashLogs('WhatsApp webhook verification', true, true);
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
    
            const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
            if (mode === 'subscribe' && token === verifyToken) {
                global.slashLogs('WhatsApp webhook verified', true, true);
                res.status(200).send(challenge);
            } else {
                global.slashLogs('WhatsApp webhook verification failed', true, true);
                res.status(403).send('Forbidden');
            }
        } catch (error) {
            global.slashLogs(`Error verifying WhatsApp webhook: ${error.message}`, true, true);
            res.status(500).send('Error');
        }
    }

    /**
     * Handle WhatsApp webhook (POST request)
     */
    async handleWhatsApp(req, res) {
        try {
            const webhookData = req.body;

            // Response to WhatsApp
            res.status(200).send('OK');

            // Process webhook asynchronously
            this.processWhatsAppWebhook(webhookData).catch((error) => {
                global.slashLogs(`Error processing WhatsApp webhook: ${error.message}`, true, true);
            });
        } catch (error) {
            global.slashLogs(`Error handling WhatsApp webhook: ${error.message}`, true, true);
            res.status(500).send('Error');
        }
    }

    /**
     * Process WhatsApp webhook data
     */
    async processWhatsAppWebhook(webhookData) {
        try {
            // Parse incoming message  
            const messageData = WhatsAppService.parseIncomingMessage(webhookData);

            if (messageData) {

                global.slashLogs(`Received WhatsApp message: ${JSON.stringify(messageData)}`, true, true);

                // Find flow for this WhatsApp number
                const entry          = webhookData.entry?.[0];
                const change         = entry?.changes?.[0];
                const value          = change?.value;
                const phoneNumberId  = value?.metadata?.phone_number_id;

                // Get flow by phone number ID or business phone
                const flow = await this.findFlowByWhatsApp(phoneNumberId);

                if (!flow) {
                    global.slashLogs(`No active flow found for WhatsApp number: ${phoneNumberId}`, true, true);
                    return;
                }

                // Extract user input based on message type
                let userInput = null;
                let displayText = null; // Human-readable label for admin panel
                if (messageData.type === 'text') {
                    userInput = messageData.text;
                    displayText = messageData.text;
                } else if (messageData.type === 'interactive') {
                    // id  → used by the flow engine to match button/list options
                    // title → shown to the admin in the live panel
                    const buttonReply = messageData.interactive?.button_reply;
                    const listReply   = messageData.interactive?.list_reply;
                    userInput   = buttonReply?.id    || listReply?.id    || '';
                    displayText = buttonReply?.title || listReply?.title || userInput;
                }
                // Process message through flow executor
                await this.flowExecutor.processMessage(
                    flow.flow_id,
                    messageData.from,
                    messageData.name,
                    userInput || messageData.text || '',
                    messageData.from,
                    'whatsapp',
                    false,
                    null,
                    displayText || userInput || messageData.text || ''
                );
            }

            // Parse status update
            const statusData = WhatsAppService.parseStatusUpdate(webhookData);

            if (statusData) {

                global.slashLogs(`Received WhatsApp status update: ${JSON.stringify(statusData)}`, true, true);

                // Update message delivery status
                await this.messageRepository.updateByWhatsAppMessageId(
                    statusData.messageId,
                    statusData.status
                );
            }
        } catch (error) {
            global.slashLogs(`Error processing WhatsApp webhook: ${error.message}`, true, true);
        }
    }

    /**
     * Find flow by WhatsApp phone number ID
     */
    async findFlowByWhatsApp(phoneNumberId) {
        try {
            // This is a simplified version - in production, you'd need to map phone_number_id to whatsapp_number
    //         const query = `
    //     SELECT * FROM flows 
    //     WHERE whatsapp_phone_number_id = ? 
    //     AND status = 'active' 
    //     AND is_published = true 
    //     ALLOW FILTERING
    //   `;

            const query = `
        SELECT * FROM flows 
        WHERE whatsapp_number = ?
        ALLOW FILTERING
      `;

            // For now, just get any active WhatsApp flow (you should improve this logic)
            const flows = await this.flowRepository.getFlowsByStatus(query, [phoneNumberId]);
            const whatsappFlows = flows.filter(f => f.channel === 'whatsapp');

            return whatsappFlows[0] || null;
        } catch (error) {
            global.slashLogs(`Error finding flow by WhatsApp: ${error.message}`, true, true);
            return null;
        }
    }

    /**
     * Verify Instagram webhook (GET request)
     */
    async verifyInstagram(req, res) {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN; // Same token for Instagram

            if (mode === 'subscribe' && token === verifyToken) {
                global.slashLogs('Instagram webhook verified', true, true);
                res.status(200).send(challenge);
            } else {
                global.slashLogs('Instagram webhook verification failed', true, true);
                res.status(403).send('Forbidden');
            }
        } catch (error) {
            global.slashLogs(`Error verifying Instagram webhook: ${error.message}`, true, true);
            res.status(500).send('Error');
        }
    }

    /**
     * Handle Instagram webhook (POST request)
     */
    async handleInstagram(req, res) {
        try {
            const webhookData = req.body;

            global.slashLogs(`Received Instagram webhook: ${JSON.stringify(webhookData)}`, true, true);

            // Respond quickly
            res.status(200).send('OK');

            // TODO: Implement Instagram message processing similar to WhatsApp
        } catch (error) {
            global.slashLogs(`Error handling Instagram webhook: ${error.message}`, true, true);
            res.status(500).send('Error');
        }
    }
}

module.exports = WebhookController;
