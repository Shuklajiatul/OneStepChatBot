const multer = require('multer');

// Allowed MIME types for media upload
// Covers WhatsApp-supported images, documents, and videos
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
]);

// Max file size in bytes
// Default: 10 MB (configurable via MAX_MEDIA_SIZE_MB env)
const MAX_FILE_SIZE = (parseInt(process.env.MAX_MEDIA_SIZE_MB, 10) || 10) * 1024 * 1024;

// File type filter
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                `Unsupported file type: ${file.mimetype}. Allowed types: jpeg, png, gif, webp, pdf, docx, mp4`
            ),
            false
        );
    }
};

// Multer instance — keeps files in memory
const upload = multer({
    storage : multer.memoryStorage(),
    limits  : { fileSize: MAX_FILE_SIZE },
    fileFilter,
});

module.exports = upload;
