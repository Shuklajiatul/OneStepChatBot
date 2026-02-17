const { FLOW_STATUS, CHANNELS } = require('../config/constants');


/**
 *  whatsapp_number - WhatsApp number if channel is whatsapp
 *  instagram_username - Instagram username if channel is instagram
 *  webhook_url - Webhook URL for external notifications
 *  status - Flow status (draft, active, paused, archived)
 *  total_conversations - Total conversations count
 *  total_messages - Total messages count
 */

// Create a new flow object

const createFlow = (data) => {
    return {
        flow_id            :  data.flow_id || null,
        user_id            :  data.user_id,
        flow_name          :  data.flow_name,
        flow_description   :  data.flow_description || '',
        flow_data          :  typeof data.flow_data === 'string' ? data.flow_data : JSON.stringify(data.flow_data),
        channel            :  data.channel || CHANNELS.WHATSAPP,
        whatsapp_number    :  data.whatsapp_number || null,
        instagram_username :  data.instagram_username || null,
        webhook_url        :  data.webhook_url || null,
        status             :  data.status || FLOW_STATUS.DRAFT,
        is_published       :  data.is_published || false,
        total_conversations:  data.total_conversations || 0,
        total_messages     :  data.total_messages || 0,
        created_at         :  data.created_at || new Date(),
        updated_at         :  data.updated_at || new Date(),
        published_at       :  data.published_at || null,
    };
};


// Parse flow data from JSON string
const parseFlowData = (flow) => {
    if (typeof flow.flow_data === 'string') {
        return JSON.parse(flow.flow_data);
    }
    return flow.flow_data;
};

// Validate flow structure
const validateFlowStructure = (flowData) => {
    const errors = [];

    if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
        errors.push('Flow must have a nodes array');
        return { isValid: false, errors };
    }

    if (flowData.nodes.length === 0) {
        errors.push('Flow must have at least one node');
        return { isValid: false, errors };
    }

    // Check for start node
    // Check for start node - REMOVED strict 'start' ID check to support UUIDs
    // const hasStartNode = flowData.nodes.some((node) => node.id === 'start');
    // if (!hasStartNode) {
    //     errors.push('Flow must have a start node with id "start"');
    // }

    // Validate each node
    flowData.nodes.forEach((node, index) => {
        if (!node.id) {
            errors.push(`Node at index ${index} must have an id`);
        }
        if (!node.type) {
            errors.push(`Node ${node.id || index} must have a type`);
        }
        if (!node.data) {
            errors.push(`Node ${node.id || index} must have data`);
        }
    });

    // Check for orphaned nodes (except end nodes)
    const nodeIds = new Set(flowData.nodes.map((n) => n.id));
    const referencedNodes = new Set();

    flowData.nodes.forEach((node) => {
        if (node.next) {
            if (Array.isArray(node.next)) {
                node.next.forEach((nextId) => referencedNodes.add(nextId));
            } else {
                referencedNodes.add(node.next);
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
    };
};

module.exports = {
    createFlow,
    parseFlowData,
    validateFlowStructure,
};
