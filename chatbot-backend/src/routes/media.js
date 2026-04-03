const express          = require('express');
const { authenticate } = require('../middleware/auth');
const upload           = require('../middleware/upload');
const MediaController  = require('../controllers/MediaController');

const router           = express.Router();
const mediaController  = new MediaController();

// upload media
router.post(
    '/upload',
    authenticate,
    (req, res, next) => {
        // Use multer as a middleware
        upload.single('file')(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success : false,
                    error   : {
                        code    : 'UPLOAD_ERROR',
                        message : err.message,
                    },
                });
            }
            next();
        });
    },
    async (req, res, next) => {
        try {
            await mediaController.upload(req, res);
        } catch (error) {
            next(error);
        }
    }
);

//list all media uploaded by the logged-in user
router.get(
    '/',
    authenticate,
    async (req, res, next) => {
        try {
            await mediaController.list(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// serves raw file bytes
router.get(
    '/:id',
    async (req, res, next) => {
        try {
            await mediaController.serve(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// delete a media asset
router.delete(
    '/:id',
    authenticate,
    async (req, res, next) => {
        try {
            await mediaController.delete(req, res);
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
