const morgan = require('morgan');
const logger = require('../config/logger');
const { generateUUID } = require('../utils/uuid');

/**
 * Request Logger Middleware
 * Logs HTTP requests using Morgan and Winston
 */

/**
 * Add request ID to all requests
 */
const addRequestId = (req, res, next) => {
    req.id = generateUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
};

/**
 * Morgan stream to Winston
 */
const stream = {
    write: (message) => {
        global.slashLogs(message.trim(), false, false);
    },
};

/**
 * Morgan format for development
 */
const devFormat = morgan('dev', { stream });

/**
 * Morgan format for production
 */
const prodFormat = morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
    { stream }
);

/**
 * Get appropriate logger based on environment
 */
const requestLogger = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

module.exports = {
    addRequestId,
    requestLogger,
};
