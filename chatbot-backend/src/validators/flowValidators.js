const Joi = require('joi');

/**
 * Flow Validators
 * Joi schemas for flow-related requests
 */

const createFlowSchema = {
    body: Joi.object({
        flow_name: Joi.string().required().min(1).max(255),
        flow_description: Joi.string().allow('').max(1000),
        flow_data: Joi.object().required(),
        channel: Joi.string().valid('whatsapp', 'instagram', 'web').required(),
        whatsapp_number: Joi.string().when('channel', {
            is: 'whatsapp',
            then: Joi.required().allow('', null),
            otherwise: Joi.optional().allow('', null),
        }),
        instagram_username: Joi.string().when('channel', {
            is: 'instagram',
            then: Joi.required(),
            otherwise: Joi.optional(),
        }),
        webhook_url: Joi.string().uri().allow(''),
    }),
};

const updateFlowSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required(),
    }),
    body: Joi.object({
        flow_name: Joi.string().min(1).max(255),
        flow_description: Joi.string().allow('').max(1000),
        flow_data: Joi.object(),
        webhook_url: Joi.string().uri().allow(''),
        status: Joi.string().valid('draft', 'active', 'paused', 'archived'),
    }),
};

const getFlowSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required(),
    }),
};

const deleteFlowSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required(),
    }),
};

const publishFlowSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required(),
    }),
    body: Joi.object({
        whatsapp_number: Joi.string().required(),
    }),
};

const unpublishFlowSchema = {
    params: Joi.object({
        id: Joi.string().uuid().required(),
    }),
};



module.exports = {
    createFlowSchema,
    updateFlowSchema,
    getFlowSchema,
    deleteFlowSchema,
    publishFlowSchema,
    unpublishFlowSchema,
};
