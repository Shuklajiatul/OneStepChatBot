const express = require('express');
const { webhookLimiter } = require('../middleware/rateLimiter');
const WebhookController = require('../controllers/WebhookController');

const router = express.Router();
const webhookController = new WebhookController();

/**
 * Webhook Routes
 */

// WhatsApp webhook verification (GET)
router.get('/whatsapp', async (req, res, next) => {
    try {
        await webhookController.verifyWhatsApp(req, res);
    } catch (error) {
        next(error);
    }
});

// WhatsApp webhook handler (POST)
router.post('/whatsapp', webhookLimiter, async (req, res, next) => {
    try {
        await webhookController.handleWhatsApp(req, res);
    } catch (error) {
        next(error);
    }
});

// Instagram webhook verification (GET)
router.get('/instagram', async (req, res, next) => {
    try {
        await webhookController.verifyInstagram(req, res);
    } catch (error) {
        next(error);
    }
});

// Instagram webhook handler (POST)
router.post('/instagram', webhookLimiter, async (req, res, next) => {
    try {
        await webhookController.handleInstagram(req, res);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
