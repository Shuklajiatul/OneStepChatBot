const logger = require('../config/logger');
const { AppError } = require('../utils/errors');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate responses
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    
    global.slashLogs('Error occurred in errorHandler middleware', true, true);

    // Handle known application errors
    if (err instanceof AppError) {
        global.slashLogs('Error occurred in appError middleware', true, true);
        return res.status(err.statusCode).json(err.toJSON());
    }

    // Handle validation errors from Joi
    if (err.name === 'ValidationError' && err.isJoi) {
        global.slashLogs('Error occurred in Joi middleware', true, true);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: err.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                })),
            },
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        global.slashLogs('Error occurred in jwt middleware', true, true);
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            },
        });
    }

    if (err.name === 'TokenExpiredError') {
        global.slashLogs('Error occurred in jwt middleware', true, true);
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Token expired',
            },
        });
    }

    // Handle Cassandra/ScyllaDB errors
    if (err.name === 'ResponseError') {
        global.slashLogs('Error occurred in scylladb middleware', true, true);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: {
                code: 'DATABASE_ERROR',
                message: 'Database operation failed',
                ...(process.env.NODE_ENV === 'development' && { details: err.message }),
            },
        });
    }

    // Handle unknown errors
    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    return res.status(statusCode).json({
        error: {
            code: 'INTERNAL_ERROR',
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
};

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res) => {
    global.slashLogs('Error occurred in notFoundHandler middleware', true, true);
    res.status(HTTP_STATUS.NOT_FOUND).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
