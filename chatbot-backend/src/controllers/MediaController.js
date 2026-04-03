const MediaRepository    = require('../repositories/MediaRepository');
const logger             = require('../config/logger');

const mediaRepository = new MediaRepository();

//Builds the public serve URL for a given mediaId

const buildMediaUrl = (req, mediaId) => {
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/api/media/${mediaId}`;
};
 
class MediaController {

    async upload(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success : false,
                    error   : { code: 'NO_FILE', message: 'No file provided in the request.' },
                });
            }

            const { originalname, mimetype, size, buffer } = req.file;
            const userId = req.user.id;

            global.slashLogs(
                `[MediaController] Upload: user=${userId} file=${originalname} size=${size} type=${mimetype}`,
                true, true
            );

            const saved = await mediaRepository.save({
                userId,
                fileName : originalname,
                mimeType : mimetype,
                fileSize : size,
                fileData : buffer,
            });

            const url = buildMediaUrl(req, saved.mediaId);

            return res.status(201).json({
                success : true,
                data    : {
                    mediaId   : saved.mediaId,
                    fileName  : saved.fileName,
                    mimeType  : saved.mimeType,
                    fileSize  : saved.fileSize,
                    url,
                    createdAt : saved.createdAt,
                },
            });
        } catch (error) {
            logger.error(`[MediaController] upload error: ${error.message}`);
            return res.status(500).json({
                success : false,
                error   : { code: 'UPLOAD_FAILED', message: error.message },
            });
        }
    }

    // Image get api
    async serve(req, res) {
        try {
            const { id } = req.params;

            global.slashLogs(`[MediaController] Serve request: mediaId=${id}`, true, true);

            const media = await mediaRepository.findById(id);

            if (!media) {
                return res.status(404).json({
                    success : false,
                    error   : { code: 'NOT_FOUND', message: 'Media not found.' },
                });
            }

            // Set proper headers so browsers and WhatsApp display inline
            res.setHeader('Content-Type', media.mimeType);
            res.setHeader('Content-Length', media.fileSize);
            res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
            res.setHeader('Cache-Control', 'public, max-age=604800');

            return res.send(media.fileData);
        } catch (error) {
            logger.error(`[MediaController] serve error: ${error.message}`);
            return res.status(500).json({
                success : false,
                error   : { code: 'SERVE_FAILED', message: error.message },
            });
        }
    }

    // list all media uploaded by the logged-in user
    async list(req, res) {
        try {

            global.slashLogs(`Media list request`, true, true);
            const userId = req.user.id;

            const assets = await mediaRepository.findByUser(userId);

            // Enrich each asset with its public URL
            const data = assets.map((asset) => ({
                ...asset,
                url : buildMediaUrl(req, asset.mediaId),
            }));

            return res.status(200).json({
                success : true,
                data,
            });
        } catch (error) {
            global.slashLogs(`Media list error: ${error.message}`, true, true);
            return res.status(500).json({
                success : false,
                error   : { code: 'LIST_FAILED', message: error.message },
            });
        }
    }

    // delete a media asset (ownership verified)
    async delete(req, res) {
        try {
            const { id }   = req.params;
            const userId   = req.user.id;

            const media = await mediaRepository.findById(id);

            if (!media) {
                return res.status(404).json({
                    success : false,
                    error   : { code: 'NOT_FOUND', message: 'Media not found.' },
                });
            }

            // Ownership check — only uploader can delete
            if (String(media.userId) !== String(userId)) {
                return res.status(403).json({
                    success : false,
                    error   : { code: 'FORBIDDEN', message: 'You do not own this media asset.' },
                });
            }

            await mediaRepository.deleteById(id);

            global.slashLogs(`[MediaController] Deleted mediaId=${id} by user=${userId}`, true, true);

            return res.status(200).json({
                success : true,
                message : 'Media deleted successfully.',
            });
        } catch (error) {
            logger.error(`[MediaController] delete error: ${error.message}`);
            return res.status(500).json({
                success : false,
                error   : { code: 'DELETE_FAILED', message: error.message },
            });
        }
    }
}

module.exports = MediaController;
