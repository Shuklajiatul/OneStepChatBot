const Joi = require('joi');

/**
 * Preview Validators
 * Joi schemas for preview-related requests
 */

const startPreviewSchema = {
    body: Joi.object({
        flow_id: Joi.string().uuid().required(),
    }),
};

const sendMessageSchema = {
    params: Joi.object({
        sessionId: Joi.string().uuid().required(),
    }),
    body: Joi.object({
        message: Joi.string().required().max(4096),
        type: Joi.string().valid('text', 'interactive').optional(),
        interactive: Joi.object({
            button_reply: Joi.object({
                id: Joi.string().required(),
            }).optional(),
            list_reply: Joi.object({
                id: Joi.string().required(),
            }).optional(),
        }).optional(),
    }),
};

const getMessagesSchema = {
    params: Joi.object({
        sessionId: Joi.string().uuid().required(),
    }),
};

const resetPreviewSchema = {
    params: Joi.object({
        sessionId: Joi.string().uuid().required(),
    }),
};

const endPreviewSchema = {
    params: Joi.object({
        sessionId: Joi.string().uuid().required(),
    }),
};

module.exports = {
    startPreviewSchema,
    sendMessageSchema,
    getMessagesSchema,
    resetPreviewSchema,
    endPreviewSchema,
};
