const express = require('express');
const flowRoutes = require('./flows');
const userRoutes = require('./users');
const webhookRoutes = require('./webhooks');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

// routes
router.use('/flows', flowRoutes);
router.use('/auth', userRoutes);
router.use('/users', userRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
