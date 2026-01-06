const Joi = require('joi');

/**
 * User Validators
 * Joi schemas for user and authentication requests
 */

const registerSchema = {
    body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        company_name: Joi.string().required().min(1).max(255),
    }),
};

const loginSchema = {
    body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
    }),
};

const refreshTokenSchema = {
    body: Joi.object({
        refresh_token: Joi.string().required(),
    }),
};

const updateProfileSchema = {
    body: Joi.object({
        company_name: Joi.string().min(1).max(255),
        whatsapp_api_key: Joi.string(),
        whatsapp_phone_number_id: Joi.string(),
        whatsapp_business_account_id: Joi.string(),
        instagram_access_token: Joi.string(),
        instagram_page_id: Joi.string(),
    }),
};

module.exports = {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    updateProfileSchema,
};
