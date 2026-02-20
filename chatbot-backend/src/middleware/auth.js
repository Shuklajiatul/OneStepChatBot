const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../config/logger');

// Generate access token
const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '5h',
    });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });
};

// Verify access token
const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
        throw new AuthenticationError('Invalid or expired token');
    }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        throw new AuthenticationError('Invalid or expired refresh token');
    }
};

// Authentication middleware

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('No token provided');
        }

        const token = authHeader.substring(7);
        const decoded = verifyAccessToken(token);

        // Attach user info to request
        req.user = {
            id: decoded.userId,
            email: decoded.email,
        };

        next();
    } catch (error) {
        global.slashLogs(`Authentication failed ${error.message}`, true, true);
        if (error instanceof AuthenticationError) {
            return res.status(401).json(error.toJSON());
        }

        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication failed',
            },
        });
    }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyAccessToken(token);

            req.user = {
                id: decoded.userId,
                email: decoded.email,
            };
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

module.exports = {
    authenticate,
    optionalAuthenticate,
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};
