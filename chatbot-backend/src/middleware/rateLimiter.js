const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

// Rate Limiter Middleware
// Prevents abuse by limiting requests per IP

// General API rate limiter

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
        },
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    handler: (req, res) => {
        global.slashLogs(`Rate limit exceeded ${req.ip} ${req.path}`, true, true);

        res.status(429).json({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
            },
        });
    },
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
        global.slashLogs(`Auth rate limit exceeded ${req.ip} ${req.path}`, true, true);

        res.status(429).json({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many authentication attempts, please try again later',
            },
        });
    },
});

/**
 * Webhook rate limiter (more permissive)
 */
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many webhook requests',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    authLimiter,
    webhookLimiter,
};
