const express             = require('express');
const { authenticate }    = require('../middleware/auth');
const LiveChatController  = require('../controllers/LiveChatController');

const router             = express.Router();
const liveChatController = new LiveChatController();

/**
 * These endpoints hydrate the admin UI on page load / refresh.
 * Real-time updates are handled by Socket.IO in socketHandlers.js
 */

// GET  /api/live/conversations?flowId=?         → list active conversations
router.get('/conversations', authenticate, async (req, res, next) => {
    try {
        await liveChatController.getConversations(req, res);
    } catch (error) {
        next(error);
    }
});

// GET  /api/live/conversations/:id/messages       → full message history
router.get('/conversations/:id/messages', authenticate, async (req, res, next) => {
    try {
        await liveChatController.getMessages(req, res);
    } catch (error) {
        next(error);
    }
});

// POST /api/live/conversations/:id/takeover       → trigger human takeover
router.post('/conversations/:id/takeover', authenticate, async (req, res, next) => {
    try {
        await liveChatController.takeover(req, res);
    } catch (error) {
        next(error);
    }
});

// POST /api/live/conversations/:id/handback       → hand control back to bot
router.post('/conversations/:id/handback', authenticate, async (req, res, next) => {
    try {
        await liveChatController.handback(req, res);
    } catch (error) {
        next(error);
    }
});

// POST /api/live/conversations/:id/message        → send agent message
router.post('/conversations/:id/message', authenticate, async (req, res, next) => {
    try {
        await liveChatController.sendAgentMessage(req, res);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
