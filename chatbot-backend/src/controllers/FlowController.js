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
        const { flow_name, flow_description, flow_data, channel, whatsapp_number, instagram_username, webhook_url } = req.body;

        // Validate flow structure
        const validation = validateFlowStructure(flow_data);
        if (!validation.isValid) {
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
    }

    /**
     * Get all flows for current user
     */
    async getFlows(req, res) {

        global.slashLogs("Fetching flows for user", true, true);
        const flows = await this.flowRepository.getFlowsByUser(req.user.id);
        res.json({ flows });
    }

    /**
     * Get flow by ID
     */
    async getFlow(req, res) {

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
    }

    /**
     * Update flow
     */
    async updateFlow(req, res) {

        const { id } = req.params;
        const updates = req.body;
        
        global.slashLogs("Updating flow", true, true);
        // Get existing flow
        const flow = await this.flowRepository.findById(id);
        if (!flow) {
            throw new NotFoundError('Flow', id);
        }

        // Check ownership
        if (flow.user_id !== req.user.id) {
            throw new AuthorizationError('You do not have access to this flow');
        }

        // Validate flow structure if updating flow_data
        if (updates.flow_data) {
            const validation = validateFlowStructure(updates.flow_data);
            if (!validation.isValid) {
                throw new ValidationError('Invalid flow structure', validation.errors);
            }
        }

        // Update flow
        const updatedFlow = await this.flowRepository.update(id, updates);

        global.slashLogs("Flow updated", true, true);

        res.json({ flow: updatedFlow });
    }

    /**
     * Delete flow
     */
    async deleteFlow(req, res) {

        global.slashLogs("Deleting flow", true, true);
        
        const { id } = req.params;

        // Get existing flow
        const flow = await this.flowRepository.findById(id);
        if (!flow) {
            throw new NotFoundError('Flow', id);
        }

        // Check ownership
        if (flow.user_id !== req.user.id) {
            throw new AuthorizationError('You do not have access to this flow');
        }

        // Delete flow
        await this.flowRepository.delete(id);

        // Decrement user's flow count
        await this.userRepository.decrementFlowCount(req.user.id);

        global.slashLogs("Flow deleted successfully", true, true);

        res.status(204).send();
    }

    /**
     * Publish flow
     */
    async publishFlow(req, res) {

        global.slashLogs("Publishing flow", true, true);

        const { id } = req.params;

        // Get existing flow
        const flow = await this.flowRepository.findById(id);
        if (!flow) {
            throw new NotFoundError('Flow', id);
        }

        // Check ownership
        if (flow.user_id !== req.user.id) {
            throw new AuthorizationError('You do not have access to this flow');
        }

        // Publish flow
        const publishedFlow = await this.flowRepository.publishFlow(id);

        global.slashLogs("Flow published successfully", true, true);

        res.json({ flow: publishedFlow });
    }

    /**
     * Unpublish flow
     */
    async unpublishFlow(req, res) {

        global.slashLogs("Unpublishing flow", true, true);

        const { id } = req.params;

        // Get existing flow
        const flow = await this.flowRepository.findById(id);
        if (!flow) {
            throw new NotFoundError('Flow', id);
        }

        // Check ownership
        if (flow.user_id !== req.user.id) {
            throw new AuthorizationError('You do not have access to this flow');
        }

        // Unpublish flow
        const unpublishedFlow = await this.flowRepository.unpublishFlow(id);

        global.slashLogs("Flow unpublished", true, true);

        res.json({ flow: unpublishedFlow });
    }
}

module.exports = FlowController;
