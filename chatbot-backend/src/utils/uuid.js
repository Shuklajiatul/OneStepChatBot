const { v4: uuidv4, validate: validateUUID } = require('uuid');

/**
 * Generate a new UUID v4
 * @returns {string} UUID string
 */
const generateUUID = () => {
    return uuidv4();
};

/**
 * Validate if a string is a valid UUID
 * @param {string} uuid - UUID string to validate
 * @returns {boolean}
 */
const isValidUUID = (uuid) => {
    return validateUUID(uuid);
};

/**
 * Generate multiple UUIDs
 * @param {number} count - Number of UUIDs to generate
 * @returns {string[]}
 */
const generateUUIDs = (count) => {
    return Array.from({ length: count }, () => generateUUID());
};

module.exports = {
    generateUUID,
    isValidUUID,
    generateUUIDs,
};
