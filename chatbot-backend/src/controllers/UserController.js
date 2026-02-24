const UserRepository = require('../repositories/UserRepository');
const { hashPassword, comparePassword } = require('../utils/crypto');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { AuthenticationError, ConflictError, ValidationError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * User Controller
 * Handles user authentication and profile management
 */
class UserController {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Register a new user
     */
    async register(req, res) {
        try {
            const { email, password, company_name } = req.body;

            // Check if user already exists
            const existingUser = await this.userRepository.findByEmail(email);
            if (existingUser) {
                throw new ConflictError('User with this email already exists');
            }

            // Hash password
            const passwordHash = await hashPassword(password);

            // Create user
            const user = await this.userRepository.createUser({
                email,
                password_hash: passwordHash,
                company_name,
            });

            // Generate tokens
            const accessToken = generateAccessToken({ userId: user.user_id, email: user.email });
            const refreshToken = generateRefreshToken({ userId: user.user_id });

            global.slashLogs("User registered", true, true);

            res.status(201).json({
                user,
                tokens: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                },
            });
        } catch (error) {
            global.slashLogs(`Error in register: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Find user
            const user = await this.userRepository.findByEmail(email);
            if (!user) {
                throw new AuthenticationError('Invalid email or password');
            }

            // Verify password
            const isValidPassword = await comparePassword(password, user.password_hash);
            if (!isValidPassword) {
                throw new AuthenticationError('Invalid email or password');
            }

            // Generate tokens
            const accessToken = generateAccessToken({ userId: user.user_id, email: user.email });
            const refreshToken = generateRefreshToken({ userId: user.user_id });

            global.slashLogs("User logged in", true, true);

            const { password_hash, ...safeUser } = user;

            res.json({
                user: safeUser,
                tokens: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                },
            });
        } catch (error) {
            global.slashLogs(`Error in login: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async refreshToken(req, res) {
        try {
            const { refresh_token } = req.body;

            // Verify refresh token
            const decoded = verifyRefreshToken(refresh_token);

            // Generate new access token
            const user = await this.userRepository.findById(decoded.userId);
            if (!user) {
                throw new AuthenticationError('User not found');
            }

            const accessToken = generateAccessToken({ userId: user.user_id, email: user.email });

            res.json({
                access_token: accessToken,
            });
        } catch (error) {
            global.slashLogs(`Error in refreshToken: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            const user = await this.userRepository.getSafeUserById(req.user.id);

            if (!user) {
                throw new AuthenticationError('User not found');
            }

            res.json({ user });
        } catch (error) {
            global.slashLogs(`Error in getProfile: ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(req, res) {
        try {
            const updates = req.body;

            const user = await this.userRepository.update(req.user.id, updates);
            const safeUser = await this.userRepository.getSafeUserById(req.user.id);

            global.slashLogs("User profile updated", true, true);

            res.json({ user: safeUser });
        } catch (error) {
            global.slashLogs(`Error in updateProfile: ${error.message}`, true, true);
            throw error;
        }
    }
}

module.exports = UserController;
