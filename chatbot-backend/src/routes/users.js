const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { registerSchema, loginSchema, refreshTokenSchema, updateProfileSchema } = require('../validators/userValidators');
const UserController = require('../controllers/UserController');

const router = express.Router();
const userController = new UserController();

/**
 * User & Auth Routes
 */

// Register
router.post(
    '/register',
    authLimiter,
    validate(registerSchema),
    async (req, res, next) => {
        try {
            await userController.register(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Login
router.post(
    '/login',
    authLimiter,
    validate(loginSchema),
    async (req, res, next) => {
        try {
            await userController.login(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Refresh token
router.post(
    '/refresh',
    validate(refreshTokenSchema),
    async (req, res, next) => {
        try {
            await userController.refreshToken(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Get profile
router.get(
    '/me',
    authenticate,
    async (req, res, next) => {
        try {
            await userController.getProfile(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Update profile
router.put(
    '/me',
    authenticate,
    validate(updateProfileSchema),
    async (req, res, next) => {
        try {
            await userController.updateProfile(req, res);
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
