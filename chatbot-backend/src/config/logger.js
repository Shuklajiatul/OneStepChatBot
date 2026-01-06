const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

/**
 * Winston logger configuration
 * Provides structured logging with different levels and transports
 */

const logDir = process.env.LOG_FILE_PATH || './logs';
const logLevel = process.env.LOG_LEVEL || 'info';

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Create transports array
const transports = [];

// Console transport (always enabled)
transports.push(
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    })
);

// File transports (only in production or when LOG_FILE_PATH is set)
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE_PATH) {
    // All logs
    transports.push(
        new DailyRotateFile({
            filename: path.join(logDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: logFormat,
        })
    );

    // Error logs
    transports.push(
        new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d',
            format: logFormat,
        })
    );
}

// Create logger instance
const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports,
    exitOnError: false,
});

/**
 * Create a child logger with additional context
 * param {Object} meta - Additional metadata to include in all logs
 * returns {Object} Child logger instance
 */
logger.createChild = (meta) => {
    return logger.child(meta);
};

/**
 * Log with request context
 * param {Object} req - Express request object
 * param {string} level - Log level
 * param {string} message - Log message
 * param {Object} meta - Additional metadata
 */
logger.logRequest = (req, level, message, meta = {}) => {
    logger[level](message, {
        requestId: req.id,
        userId: req.user?.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        ...meta,
    });
};

module.exports = logger;
