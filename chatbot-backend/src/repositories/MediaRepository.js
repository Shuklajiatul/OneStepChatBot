const { v4: uuidv4 } = require('uuid');
const databaseConfig = require('../config/database');
const logger = require('../config/logger');

// Media Repository
// Handles CRUD operations for the media_assets table in ScyllaDB
class MediaRepository {
    // Save a new media asset to the database
    async save({ userId, fileName, mimeType, fileSize, fileData }) {
        try {
            const mediaId   = uuidv4();
            const createdAt = new Date();

            const query = `
                INSERT INTO media_assets (media_id, user_id, file_name, mime_type, file_size, file_data, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            await databaseConfig.execute(query, [
                mediaId,
                userId,
                fileName,
                mimeType,
                fileSize,
                fileData,
                createdAt,
            ], { prepare: true });

            global.slashLogs(`Media saved: ${mediaId}`, true, true);

            return {
                mediaId,
                userId,
                fileName,
                mimeType,
                fileSize,
                createdAt,
            };
        } catch (error) {
            global.slashLogs(`Media save error: ${error.message}`, true, true);
            throw error;
        }
    }

    // Find a media asset by its UUID
    async findById(mediaId) {
        try {
            const query  = 'SELECT * FROM media_assets WHERE media_id = ?';
            const result = await databaseConfig.execute(query, [mediaId], { prepare: true });

            if (!result.rows || result.rows.length === 0) return null;

            const row = result.rows[0];
            return {
                mediaId   : row.media_id,
                userId    : row.user_id,
                fileName  : row.file_name,
                mimeType  : row.mime_type,
                fileSize  : row.file_size,
                fileData  : row.file_data,   // Buffer
                createdAt : row.created_at,
            };
        } catch (error) {
            global.slashLogs(`Media findById error: ${error.message}`, true, true);
            throw error;
        }
    }

    // List all media assets for a given user 
     
    async findByUser(userId) {
        try {
            const query  = 'SELECT media_id, user_id, file_name, mime_type, file_size, created_at FROM media_assets WHERE user_id = ? allow filtering';
            const result = await databaseConfig.execute(query, [userId], { prepare: true });

            if (!result.rows || result.rows.length === 0) return [];

            return result.rows.map((row) => ({
                mediaId   : row.media_id,
                userId    : row.user_id,
                fileName  : row.file_name,
                mimeType  : row.mime_type,
                fileSize  : row.file_size,
                createdAt : row.created_at,
            }));
        } catch (error) {
            global.slashLogs(`Media findByUser error: ${error.message}`, true, true);
            throw error;
        }
    }

    // Delete a media asset by ID
    async deleteById(mediaId) {
        try {
            const query = 'DELETE FROM media_assets WHERE media_id = ?';
            await databaseConfig.execute(query, [mediaId], { prepare: true });
            global.slashLogs(`Media deleted: ${mediaId}`, true, true);
            return true;
        } catch (error) {
            global.slashLogs(`Media deleteById error: ${error.message}`, true, true);
            throw error;
        }
    }
}

module.exports = MediaRepository;
