const express          = require('express');
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validation');
const FlowController   = require('../controllers/FlowController');
const { createFlowSchema, updateFlowSchema, getFlowSchema, deleteFlowSchema, publishFlowSchema, unpublishFlowSchema } = require('../validators/flowValidators');

const router = express.Router();
const flowController = new FlowController();

// Flow Routes


// Create flow
router.post('/', authenticate, validate(createFlowSchema), async (req, res, next) => {
    try {
        await flowController.createFlow(req, res);
    } catch (error) {
        next(error);
    }
}
);

// Get all flows
router.get('/', authenticate, async (req, res, next) => {
    try {
        await flowController.getFlows(req, res);
    } catch (error) {
        next(error);
    }
}
);

// Get flow by ID
router.get('/:id', authenticate, validate(getFlowSchema), async (req, res, next) => {
    try {
        await flowController.getFlow(req, res);
    } catch (error) {
        next(error);
    }
}
);

// Update flow
router.put('/:id', authenticate, validate(updateFlowSchema), async (req, res, next) => {
    try {
        await flowController.updateFlow(req, res);
    } catch (error) {
        next(error);
    }
}
);

// Delete flow
router.delete('/:id', authenticate, validate(deleteFlowSchema), async (req, res, next) => {
    try {
        await flowController.deleteFlow(req, res);
    } catch (error) {
        next(error);
    }
}
);

// Publish flow
router.post('/:id/publish', authenticate, validate(publishFlowSchema), async (req, res, next) => {
    try {
        await flowController.publishFlow(req, res);
    } catch (error) {
        next(error);
    }
}
);

// Unpublish flow
router.post('/:id/unpublish', authenticate, validate(unpublishFlowSchema), async (req, res, next) => {
    try {
        await flowController.unpublishFlow(req, res);
    } catch (error) {
        next(error);
    }
}
);

module.exports = router;
