const { HTTP_STATUS, ERROR_CODES } = require('../config/constants');

// Base Error class for all custom errors

class AppError extends Error {
    constructor(message, statusCode, errorCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            error: {
                code: this.errorCode,
                message: this.message,
                timestamp: this.timestamp,
                ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
            },
        };
    }
}

// Validation Error - 400

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
        this.details = details;
    }

    toJSON() {
        return {
            error: {
                code: this.errorCode,
                message: this.message,
                details: this.details,
                timestamp: this.timestamp,
            },
        };
    }
}

// Not Found Error - 404

class NotFoundError extends AppError {
    constructor(resource, identifier = null) {
        const message = identifier
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;
        super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
        this.resource = resource;
        this.identifier = identifier;
    }
}

// Authentication Error - 401

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }
}

// Authorization Error - 403

class AuthorizationError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }
}

// Conflict Error - 409

class ConflictError extends AppError {
    constructor(message) {
        super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
    }
}

// Rate Limit Error - 429

class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMIT_EXCEEDED);
    }
}

// Database Error - 500

class DatabaseError extends AppError {
    constructor(message, originalError = null) {
        super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_ERROR);
        this.originalError = originalError;
    }
}

// External API Error - 500

class ExternalAPIError extends AppError {
    constructor(service, message, statusCode = null) {
        super(
            `External API error from ${service}: ${message}`,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            ERROR_CODES.EXTERNAL_API_ERROR
        );
        this.service = service;
        this.externalStatusCode = statusCode;
    }
}

// Internal Error - 500

class InternalError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR);
    }
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ExternalAPIError,
    InternalError,
};
