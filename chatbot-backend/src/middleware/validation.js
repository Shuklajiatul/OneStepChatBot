const { ValidationError } = require('../utils/errors');

// Validation Middleware
// Validates request data against Joi schemas

// Create validation middleware
const validate = (schema) => {
    return (req, res, next) => {
        const validationOptions = {
            abortEarly: false, // Return all errors
            allowUnknown: true, // Allow unknown keys
            stripUnknown: true, // Remove unknown keys
        };

        // Validate request body
        if (schema.body) {
            const { error, value } = schema.body.validate(req.body, validationOptions);
            if (error) {
                const details = error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                }));
                throw new ValidationError('Request body validation failed', details);
            }
            req.body = value;
        }

        // Validate query parameters
        if (schema.query) {
            const { error, value } = schema.query.validate(req.query, validationOptions);
            if (error) {
                const details = error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                }));
                throw new ValidationError('Query parameters validation failed', details);
            }
            req.query = value;
        }

        // Validate URL parameters
        if (schema.params) {
            const { error, value } = schema.params.validate(req.params, validationOptions);
            if (error) {
                const details = error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                }));
                throw new ValidationError('URL parameters validation failed', details);
            }
            req.params = value;
        }

        next();
    };
};

module.exports = { validate };
