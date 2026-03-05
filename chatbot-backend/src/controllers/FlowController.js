const FlowRepository            = require('../repositories/FlowRepository');
const UserRepository            = require('../repositories/UserRepository');
const { validateFlowStructure } = require('../models/Flow');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');

class FlowController {
    constructor() {
        this.flowRepository = new FlowRepository();
        this.userRepository = new UserRepository();
    }

    /**
     * Create a new flow
     */
    async createFlow(req, res) {
        try {
            const { flow_name, flow_description, flow_data, channel, whatsapp_number, instagram_username, webhook_url } = req.body;

            // Validate flow structure
            const validation = validateFlowStructure(flow_data);
            if (!validation.isValid) {
                global.slashLogs("Invalid flow structure", true, true);
                throw new ValidationError('Invalid flow structure', validation.errors);
            }

            // Create flow
            const flow = await this.flowRepository.createFlow({
                user_id: req.user.id,
                flow_name,
                flow_description,
                flow_data,
                channel,
                whatsapp_number,
                instagram_username,
                webhook_url,
            }); 

            // Increment user's flow count
            await this.userRepository.incrementFlowCount(req.user.id);

            global.slashLogs("Flow created successfully", true, true);

            res.status(201).json({ flow });
        } catch (error) {
            global.slashLogs(`Error in createFlow: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Get all flows for current user
     */
    async getFlows(req, res) {
        try {
            global.slashLogs("Fetching flows for user", true, true);
            const flows = await this.flowRepository.getFlowsByUser(req.user.id);
            res.json({ flows });
        } catch (error) {
            global.slashLogs(`Error in getFlows: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Get flow by ID
     */
    async getFlow(req, res) {
        try {
            global.slashLogs("Fetching flow by ID", true, true);
            const { id } = req.params;

            const flow = await this.flowRepository.findById(id);
            if (!flow) {
                throw new NotFoundError('Flow', id);
            }

            // Check ownership
            // if (flow.user_id !== req.user.id) {
            //     throw new AuthorizationError('You do not have access to this flow');
            // }

            res.json({ flow });
        } catch (error) {
            global.slashLogs(`Error in getFlow: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Update flow
     */
    async updateFlow(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            global.slashLogs("Updating flow", true, true);
            // Get existing flow
            const flow = await this.flowRepository.findById(id);
            if (!flow) {
                throw new NotFoundError('Flow', id);
            }

            // Check ownership
            // if (flow.user_id !== req.user.id) {
            //     throw new AuthorizationError('You do not have access to this flow');
            // }

            // Validate flow structure if updating flow_data
            if (updates.flow_data) {
                const validation = validateFlowStructure(updates.flow_data);
                if (!validation.isValid) {
                    throw new ValidationError('Invalid flow structure', validation.errors);
                }
            }

            // Stringify flow_data to JSON string for Cassandra TEXT column
            if (updates.flow_data && typeof updates.flow_data !== 'string') {
                updates.flow_data = JSON.stringify(updates.flow_data);
            }

            // Update flow
            const updatedFlow = await this.flowRepository.update(id, updates);

            global.slashLogs("Flow updated", true, true);

            res.json({ flow: updatedFlow });
        } catch (error) {
            global.slashLogs(`Error in updateFlow: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Delete flow
     */
    async deleteFlow(req, res) {
        try {
            global.slashLogs("Deleting flow", true, true);
            
            const { id } = req.params;

            // Get existing flow
            const flow = await this.flowRepository.findById(id);
            if (!flow) {
                throw new NotFoundError('Flow', id);
            }

            // Check ownership
            // if (flow.user_id !== req.user.id) {
            //     throw new AuthorizationError('You do not have access to this flow');
            // }

            // Delete flow
            await this.flowRepository.delete(id);

            // Decrement user's flow count
            await this.userRepository.decrementFlowCount(req.user.id);

            global.slashLogs("Flow deleted successfully", true, true);

            res.status(200).json({"message": "Flow deleted successfully"});
        } catch (error) {
            global.slashLogs(`Error in deleteFlow: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Publish flow
     */
    async publishFlow(req, res) {
        try {
            global.slashLogs("Publishing flow", true, true);

            const { id } = req.params;
            const { whatsapp_number } = req.body;

            // Get existing flow
            const flow = await this.flowRepository.findById(id);
            if (!flow) {
                throw new NotFoundError('Flow', id);
            }

            // Check ownership
            // if (flow.user_id !== req.user.id) {
            //     throw new AuthorizationError('You do not have access to this flow');
            // }

            // Check if whatsapp_number is already mapped to another active flow
            const isTaken = await this.flowRepository.isWhatsAppNumberTaken(whatsapp_number, id);
            if (isTaken) {
                throw new ValidationError(`WhatsApp number ${whatsapp_number} is already mapped to another active flow`);
            }

            // Publish flow
            const publishedFlow = await this.flowRepository.publishFlow(id, whatsapp_number);

            global.slashLogs("Flow published successfully", true, true);

            res.json({ flow: publishedFlow });
        } catch (error) {
            global.slashLogs(`Error in publishFlow: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Unpublish flow
     */
    async unpublishFlow(req, res) {
        try {
            global.slashLogs("Unpublishing flow", true, true);

            const { id } = req.params;

            // Get existing flow
            const flow = await this.flowRepository.findById(id);
            if (!flow) {
                throw new NotFoundError('Flow', id);
            }

            // // Check ownership
            // if (flow.user_id !== req.user.id) {
            //     throw new AuthorizationError('You do not have access to this flow');
            // }

            // Unpublish flow and clear whatsapp_number
            const unpublishedFlow = await this.flowRepository.unpublishFlow(id);

            global.slashLogs("Flow unpublished", true, true);

            res.json({ flow: unpublishedFlow });
        } catch (error) {
            global.slashLogs(`Error in unpublishFlow: ${error.message}`, true, true);
            throw error;
        }
    }
}

module.exports = FlowController;
