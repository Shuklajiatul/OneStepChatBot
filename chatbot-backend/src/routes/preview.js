const express          = require('express');
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validation');
const PreviewController = require('../controllers/PreviewController');
const { 
    startPreviewSchema, 
    sendMessageSchema, 
    getMessagesSchema, 
    resetPreviewSchema, 
    endPreviewSchema 
} = require('../validators/previewValidators');

const router            = express.Router();
const previewController = new PreviewController();

// Preview Routes

// Start a new preview session
router.post('/start', authenticate, validate(startPreviewSchema), async (req, res, next) => {
    try {
        await previewController.startPreview(req, res);
    } catch (error) {
        next(error);
    }
});

// Send a message in preview mode
router.post('/:sessionId/message', authenticate, validate(sendMessageSchema), async (req, res, next) => {
    try {
        await previewController.sendMessage(req, res);
    } catch (error) {
        next(error);
    }
});

// Get all messages from a preview session
router.get('/:sessionId/messages', authenticate, validate(getMessagesSchema), async (req, res, next) => {
    try {
        await previewController.getMessages(req, res);
    } catch (error) {
        next(error);
    }
});

// Reset a preview session
router.post('/:sessionId/reset', authenticate, validate(resetPreviewSchema), async (req, res, next) => {
    try {
        await previewController.resetPreview(req, res);
    } catch (error) {
        next(error);
    }
});

// End a preview session
router.delete('/:sessionId', authenticate, validate(endPreviewSchema), async (req, res, next) => {
    try {
        await previewController.endPreview(req, res);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
