const { v4: uuidv4, validate: validateUUID } = require('uuid');

// Generate a new UUID v4
const generateUUID = () => {
    return uuidv4();
};

// Validate if a string is a valid UUID
const isValidUUID = (uuid) => {
    return validateUUID(uuid);
};

// Generate multiple UUIDs
const generateUUIDs = (count) => {
    return Array.from({ length: count }, () => generateUUID());
};

module.exports = {
    generateUUID,
    isValidUUID,
    generateUUIDs,
};
